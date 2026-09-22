import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { createPayment } from "../services/payment/xendit.js";

const router=Router();

router.post("/create/:orderId", requireAuth, async (req,res)=>{
  try {
    const r=await query(
      `SELECT o.*, s.name store_name,
              s.provider_account_id, s.provider_split_rule_id
       FROM orders o
       JOIN stores s ON s.id=o.store_id
       WHERE o.id=$1 AND o.customer_id=$2`,
      [req.params.orderId,req.user.sub]
    );

    if(!r.rows.length) return res.status(404).json({error:"Order not found"});
    const order=r.rows[0];

    if(order.status !== "PENDING") {
      return res.status(409).json({error:"Order is not payable"});
    }

    if(process.env.PAYMENT_PROVIDER !== "xendit") {
      return res.status(500).json({error:"Payment provider is not configured"});
    }

    const channelCode = req.body.channel_code || "QRIS";
    const payment = await createPayment({
      referenceId: order.id,
      amount: Number(order.total_amount),
      channelCode,
      forUserId: order.provider_account_id,
      splitRuleId: order.provider_split_rule_id
    });

    await query(
      `INSERT INTO payments(order_id,provider,provider_payment_id,amount,status)
       VALUES($1,'xendit',$2,$3,'PENDING')
       ON CONFLICT (order_id)
       DO UPDATE SET provider_payment_id=EXCLUDED.provider_payment_id,
                     amount=EXCLUDED.amount,
                     status='PENDING'`,
      [order.id,payment.id,order.total_amount]
    );

    res.status(201).json({
      payment_id: payment.id,
      status: payment.status,
      actions: payment.actions || [],
      provider: "xendit"
    });
  } catch(e) {
    console.error(e.provider || e);
    res.status(e.status && e.status < 500 ? e.status : 502)
      .json({error:"Payment provider request failed"});
  }
});

export default router;
