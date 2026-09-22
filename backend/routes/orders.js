import { Router } from "express";
import { z } from "zod";
import { pool, query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const createSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().positive().max(100)
});

router.get("/mine", requireAuth, async (req,res)=>{
  const r=await query(
    `SELECT o.*, p.name product_name, s.name store_name
     FROM orders o
     JOIN products p ON p.id=o.product_id
     JOIN stores s ON s.id=o.store_id
     WHERE o.customer_id=$1 OR o.seller_id=$1
     ORDER BY o.created_at DESC`,
    [req.user.sub]
  );
  res.json(r.rows);
});

router.post("/", requireAuth, validate(createSchema), async (req,res)=>{
  const client=await pool.connect();
  try{
    await client.query("BEGIN");
    const p=await client.query(
      `SELECT p.*,s.user_id seller_id
       FROM products p JOIN stores s ON s.id=p.store_id
       WHERE p.id=$1 AND p.status='ACTIVE' FOR UPDATE`,
      [req.body.product_id]
    );
    if(!p.rows.length) throw Object.assign(new Error("Product not found"),{status:404});
    const product=p.rows[0];
    if(product.stock < req.body.quantity) throw Object.assign(new Error("Insufficient stock"),{status:409});
    const total=Number(product.price)*req.body.quantity;
    const o=await client.query(
      `INSERT INTO orders
       (customer_id,seller_id,store_id,product_id,quantity,unit_price,total_amount,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')
       RETURNING *`,
      [req.user.sub,product.seller_id,product.store_id,product.id,req.body.quantity,product.price,total]
    );
    await client.query(
      `UPDATE products SET stock=stock-$1,updated_at=now() WHERE id=$2`,
      [req.body.quantity,product.id]
    );
    await client.query("COMMIT");
    res.status(201).json(o.rows[0]);
  }catch(e){
    await client.query("ROLLBACK");
    res.status(e.status||500).json({error:e.status?e.message:"Order creation failed"});
  }finally{client.release();}
});

export default router;
