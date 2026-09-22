import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";

const router=Router();

router.get("/me",requireAuth,async(req,res)=>{
  const w=await query(
    `SELECT available_balance,pending_balance,updated_at
     FROM wallets WHERE user_id=$1`,
    [req.user.sub]
  );
  const tx=await query(
    `SELECT * FROM wallet_transactions
     WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.sub]
  );
  res.json({wallet:w.rows[0]||null,transactions:tx.rows});
});

export default router;
