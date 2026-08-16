import { randomUUID } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import { config } from "./config.js";
import { classifyError, errorType } from "./diagnostics.js";
import { logEvent } from "./logger.js";
import { registerRoutes } from "./routes.js";
import { storage as postgresStorage,type IStorage } from "./storage.js";

export function createApp(storage:IStorage=postgresStorage) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(cors({ origin: config.allowedOrigins, credentials: true, methods:["GET","POST","PUT","PATCH","OPTIONS"] }));
  app.use(express.json({ limit:"1mb" }));
  app.use(express.urlencoded({ extended:false, limit:"1mb" }));
  app.use((req,res,next)=>{
    const suppliedRequestId=req.header("x-request-id")?.trim();
    const requestId=suppliedRequestId&&/^[A-Za-z0-9._-]{1,128}$/.test(suppliedRequestId)?suppliedRequestId:randomUUID();
    const startedAt=performance.now();
    res.locals.requestId=requestId;
    res.setHeader("X-Request-Id",requestId);
    res.on("finish",()=>{
      if(req.path.startsWith("/api")) logEvent("request_completed",{requestId,method:req.method,path:req.path,status:res.statusCode,durationMs:Math.round(performance.now()-startedAt)},"http");
    });
    next();
  });
  registerRoutes(app,storage);
  app.use("/api",(_req,res)=>res.status(404).json({message:"API endpoint not found"}));
  app.use((error:unknown,req:Request,res:Response,_next:NextFunction)=>{
    const diagnostic=classifyError(error);
    const requestId=typeof res.locals.requestId==="string"?res.locals.requestId:"unknown";
    logEvent("request_failed",{requestId,method:req.method,path:req.path,status:diagnostic.status,code:diagnostic.code,stage:diagnostic.stage,errorType:errorType(error)},"error");
    if(!res.headersSent) res.status(diagnostic.status).json({message:diagnostic.message,code:diagnostic.code,stage:diagnostic.stage,requestId});
  });
  return app;
}
