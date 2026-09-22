import { Router } from "express";
import { pool } from "../config/db.js";
import { verifyWebhookToken } from "../services/payment/xendit.js";

const router=Router();

router.post("/", async (req,res)=>{
  try {
    const token = req.headers["x-callback-token"];
    if(!verifyWebhookToken(token)) {
      return res.status(401).json({error:"Invalid webhook token"});
    }

    const event = req.body;
    const eventId = event.event_id || event.id;
    const paymentId = event.data?.payment_request_id || event.payment_request_id;
    const status = String(event.data?.status || event.status || "").toUpperCase();

    if(!eventId || !paymentId) {
      return res.status(400).json({error:"Invalid webhook payload"});
    }

    const client=await pool.connect();
    try {
      await client.query("BEGIN");

      const duplicate=await client.query(
        `SELECT 1 FROM payment_events WHERE provider_event_id=$1`,
        [eventId]
      );
      if(duplicate.rows.length) {
        await client.query("ROLLBACK");
        return res.json({ok:true,duplicate:true});
      }

      const p=await client.query(
        `SELECT * FROM payments WHERE provider_payment_id=$1 FOR UPDATE`,
        [paymentId]
      );
      if(!p.rows.length) throw new Error("Payment not found");

      await client.query(
        `INSERT INTO payment_events(provider_event_id,payment_id,payload)
         VALUES($1,$2,$3)`,
        [eventId,p.rows[0].id,event]
      );

      if(["SUCCEEDED","COMPLETED","PAID"].includes(status)) {
        const order=await client.query(
          `UPDATE orders SET status='PAID',paid_at=COALESCE(paid_at,now()),updated_at=now()
           WHERE id=$1 AND status='PENDING'
           RETURNING *`,
          [p.rows[0].order_id]
        );

        await client.query(
          `UPDATE payments SET status='PAID',paid_at=COALESCE(paid_at,now())
           WHERE id=$1`,
          [p.rows[0].id]
        );

        if(order.rows.length) {
          const o=order.rows[0];
          const platformFee=Number(o.total_amount) *
            (Number(process.env.PLATFORM_FEE_PERCENT || 5)/100);
          const sellerAmount=Number(o.total_amount)-platformFee;

          await client.query(
            `UPDATE wallets
             SET pending_balance=pending_balance+$1,updated_at=now()
             WHERE user_id=$2`,
            [sellerAmount,o.seller_id]
          );

          await client.query(
            `INSERT INTO wallet_transactions
             (user_id,type,amount,reference_id,status,description)
             VALUES($1,'SALE',$2,$3,'PENDING','Marketplace sale')`,
            [o.seller_id,sellerAmount,o.id]
          );
        }
      } else if(["FAILED","EXPIRED","CANCELLED"].includes(status)) {
        await client.query(
          `UPDATE payments SET status=$2 WHERE id=$1`,
          [p.rows[0].id,status]
        );
      }

      await client.query("COMMIT");
      res.json({ok:true});
    } catch(e) {
      await client.query("ROLLBACK");
      console.error(e);
      res.status(500).json({error:"Webhook processing failed"});
    } finally {
      client.release();
    }
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"Webhook error"});
  }
});

export default router;
