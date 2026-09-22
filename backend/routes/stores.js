import { Router } from "express";
import { query } from "../config/db.js";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { validate } from "../middleware/validate.js";

const router = Router();

const updateSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  bio: z.string().max(1000).optional(),
  avatar_url: z.string().url().max(1000).optional(),
  banner_url: z.string().url().max(1000).optional()
});

router.get("/:username", async (req,res)=>{
  const r = await query(
    `SELECT s.id,s.name,s.slug,s.bio,s.avatar_url,s.banner_url,s.created_at,
            u.username
     FROM stores s JOIN users u ON u.id=s.user_id
     WHERE u.username=$1`,
    [req.params.username]
  );
  if (!r.rows.length) return res.status(404).json({error:"Store not found"});
  const products = await query(
    `SELECT id,name,slug,description,price,currency,stock,product_type,
            image_url,status
     FROM products
     WHERE store_id=$1 AND status='ACTIVE'
     ORDER BY created_at DESC`,
    [r.rows[0].id]
  );
  res.json({store:r.rows[0],products:products.rows});
});

router.patch("/me", requireAuth, validate(updateSchema), async (req,res)=>{
  const r = await query(
    `UPDATE stores SET
      name=COALESCE($1,name),
      bio=COALESCE($2,bio),
      avatar_url=COALESCE($3,avatar_url),
      banner_url=COALESCE($4,banner_url),
      updated_at=now()
     WHERE user_id=$5
     RETURNING *`,
    [req.body.name,req.body.bio,req.body.avatar_url,req.body.banner_url,req.user.sub]
  );
  res.json(r.rows[0]);
});

export default router;
