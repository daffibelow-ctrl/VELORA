import { Router } from "express";
import { z } from "zod";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

const schema = z.object({
  name: z.string().min(2).max(200),
  slug: z.string().regex(/^[a-z0-9-]{2,160}$/),
  description: z.string().max(10000).optional(),
  price: z.number().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
  product_type: z.enum(["DIGITAL","PHYSICAL","SERVICE"]).default("DIGITAL"),
  image_url: z.string().url().max(1000).optional()
});

router.get("/mine", requireAuth, async (req,res)=>{
  const r = await query(
    `SELECT p.* FROM products p
     JOIN stores s ON s.id=p.store_id
     WHERE s.user_id=$1
     ORDER BY p.created_at DESC`,
    [req.user.sub]
  );
  res.json(r.rows);
});

router.post("/", requireAuth, validate(schema), async (req,res)=>{
  const s = await query(`SELECT id FROM stores WHERE user_id=$1`,[req.user.sub]);
  if (!s.rows.length) return res.status(404).json({error:"Store not found"});
  const b=req.body;
  const r=await query(
    `INSERT INTO products
      (store_id,name,slug,description,price,stock,product_type,image_url)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING *`,
    [s.rows[0].id,b.name,b.slug,b.description||"",b.price,b.stock,b.product_type,b.image_url||null]
  );
  res.status(201).json(r.rows[0]);
});

router.patch("/:id/publish", requireAuth, async (req,res)=>{
  const r = await query(
    `UPDATE products p
     SET status='ACTIVE', updated_at=now()
     FROM stores s
     WHERE p.id=$1
       AND p.store_id=s.id
       AND s.user_id=$2
       AND p.status='DRAFT'
     RETURNING p.*`,
    [req.params.id,req.user.sub]
  );

  if(!r.rows.length) {
    return res.status(404).json({error:"Draft product not found"});
  }

  res.json(r.rows[0]);
});
router.delete("/:id", requireAuth, async (req,res)=>{
  const r=await query(
    `UPDATE products p SET status='ARCHIVED',updated_at=now()
     FROM stores s
     WHERE p.id=$1 AND p.store_id=s.id AND s.user_id=$2
     RETURNING p.id`,
    [req.params.id,req.user.sub]
  );
  if(!r.rows.length) return res.status(404).json({error:"Product not found"});
  res.json({success:true});
});

export default router;
