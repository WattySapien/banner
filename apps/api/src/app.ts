import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { log } from "./logger.js";
import { registerRoutes } from "./routes.js";
import { storage as postgresStorage,type IStorage } from "./storage.js";

export function createApp(storage:IStorage=postgresStorage) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({ origin: config.allowedOrigins, credentials: true, methods:["GET","POST","PATCH","OPTIONS"] }));
  app.use(express.json({ limit:"1mb" }));
  app.use(express.urlencoded({ extended:false, limit:"1mb" }));
  app.use((req,res,next)=>{
    const startedAt=performance.now();
    res.on("finish",()=>{if(req.path.startsWith("/api")) log(`${req.method} ${req.path} ${res.statusCode} ${Math.round(performance.now()-startedAt)}ms`,"http");});
    next();
  });
  registerRoutes(app,storage);
  app.use("/api",(_req,res)=>res.status(404).json({message:"API endpoint not found"}));
  app.use((error:unknown,_req:Request,res:Response,_next:NextFunction)=>{
    if(error&&typeof error==="object"&&"code" in error&&error.code==="23505"){
      res.status(409).json({message:"A record with those details already exists"});
      return;
    }
    const message=error instanceof Error?error.message:"Internal Server Error";
    log(message,"error");
    if(!res.headersSent) res.status(500).json({message:"Internal Server Error"});
  });
  return app;
}
