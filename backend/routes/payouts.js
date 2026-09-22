import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router=Router();

const schema=z.object({
  method:z.enum(["DANA","OVO","GOPAY","SHOPEEPAY","BANK"]),
  destination:z.string().min(6).max(100),
  amount:z.number().positive()
});

router.get("/mine",requireAuth,async(req,res)=>{
  const r=await query(
    `SELECT id,method,destination,amount,fee,status,created_at,completed_at
     FROM payouts WHERE user_id=$1 ORDER BY created_at DESC`,
    [req.user.sub]
  );
  res.json(r.rows);
});

router.post("/",requireAuth,validate(schema),async(req,res)=>{
  // Structure only: production payout must call a supported provider API.
  const w=await query(`SELECT available_balance FROM wallets WHERE user_id=$1`,[req.user.sub]);
  if(!w.rows.length || Number(w.rows[0].available_balance)<req.body.amount){
    return res.status(400).json({error:"Insufficient available balance"});
  }
  const r=await query(
    `INSERT INTO payouts(user_id,method,destination,amount,fee,status)
     VALUES($1,$2,$3,$4,0,'PENDING') RETURNING *`,
    [req.user.sub,req.body.method,req.body.destination,req.body.amount]
  );
  res.status(201).json({
    ...r.rows[0],
    message:"Payout request created. Provider integration is required for real transfer."
  });
});

export default router;
