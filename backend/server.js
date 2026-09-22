import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
dotenv.config();

import { securityMiddleware, apiLimiter } from "./middleware/security.js";
import auth from "./routes/auth.js";
import stores from "./routes/stores.js";
import products from "./routes/products.js";
import orders from "./routes/orders.js";
import payments from "./routes/payments.js";
import wallet from "./routes/wallet.js";
import payouts from "./routes/payouts.js";
import analytics from "./routes/analytics.js";
import paymentWebhook from "./webhooks/payment.js";

const app=express();
app.disable("x-powered-by");

app.use(...securityMiddleware);
app.use(express.json({limit:"1mb"}));
app.use("/api",apiLimiter);

app.get("/api/health",(req,res)=>res.json({ok:true,service:"VELORA"}));

app.use("/api/auth",auth);
app.use("/api/stores",stores);
app.use("/api/products",products);
app.use("/api/orders",orders);
app.use("/api/payments",payments);
app.use("/api/wallet",wallet);
app.use("/api/payouts",payouts);
app.use("/api/analytics",analytics);
app.use("/api/webhooks/payment",paymentWebhook);

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
app.use(express.static(path.join(__dirname,"../frontend")));

app.use((err,req,res,next)=>{
  console.error(err);
  res.status(500).json({error:"Internal server error"});
});

const port=process.env.PORT||3000;
app.listen(port,()=>console.log(`VELORA running on http://localhost:${port}`));
