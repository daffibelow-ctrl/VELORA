import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router=Router();

router.get("/summary",requireAuth,async(req,res)=>{
  const r=await query(
    `SELECT
       COUNT(*) FILTER (WHERE status='PAID') paid_orders,
       COALESCE(SUM(total_amount) FILTER (WHERE status='PAID'),0) gross_sales
     FROM orders
     WHERE seller_id=$1`,
    [req.user.sub]
  );
  res.json(r.rows[0]);
});

export default router;
