import { createHash, randomBytes } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { createTransferSchema, updateCardSchema } from "@clipx/contracts/banking";
import { createAdminCustomerSchema, updateAdminUserSchema } from "@clipx/contracts/admin";
import { changePasswordSchema, updatePreferencesSchema, updateProfileSchema } from "@clipx/contracts/settings";
import { localAuthSchema, type LocalAuthUser } from "@clipx/contracts/auth";
import { config } from "./config.js";
import type { IStorage } from "./storage.js";

const SESSION_COOKIE="clipx_session";
const unsafeMethods=new Set(["POST","PUT","PATCH","DELETE"]);
type AuthenticatedRequest=Request & { authUser:LocalAuthUser };

const asyncRoute=(handler:(req:AuthenticatedRequest,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(handler(req as AuthenticatedRequest,res)).catch(next);};
const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
const readCookie=(req:Request,name:string)=>req.headers.cookie?.split(";").map((part)=>part.trim()).find((part)=>part.startsWith(`${name}=`))?.slice(name.length+1);
const cookieOptions=(expires?:Date)=>["Path=/","HttpOnly","SameSite=Lax",config.isProduction?"Secure":"",expires?`Expires=${expires.toUTCString()}`:""].filter(Boolean).join("; ");

async function issueSession(storage:IStorage,userId:string,res:Response){
  const token=randomBytes(32).toString("base64url");
  const expiresAt=new Date(Date.now()+config.sessionDays*86_400_000);
  await storage.createSession(userId,hashToken(token),expiresAt);
  res.setHeader("Set-Cookie",`${SESSION_COOKIE}=${token}; ${cookieOptions(expiresAt)}`);
}

export function registerRoutes(app:Express,storage:IStorage) {
  app.use((req,res,next)=>{
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("X-Frame-Options","DENY");
    res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");
    const forwardedHost=req.header("x-forwarded-host")?.split(",")[0]?.trim();
    const requestHost=forwardedHost??req.header("host");
    let isSameOrigin=false;
    try{isSameOrigin=Boolean(req.headers.origin&&requestHost&&new URL(req.headers.origin).host===requestHost);}catch{isSameOrigin=false;}
    if(unsafeMethods.has(req.method) && req.headers.origin && !isSameOrigin && !config.allowedOrigins.includes(req.headers.origin)){
      res.status(403).json({message:"Request origin is not allowed"});return;
    }
    next();
  });

  app.get("/api/health",asyncRoute(async(_req,res)=>{await storage.ping();res.json({status:"ok",storage:storage.kind,timestamp:new Date().toISOString()});}));
  app.get("/api",asyncRoute(async(_req,res)=>{res.json({name:"ClipX Banking API",status:"production-ready"});}));

  app.post("/api/auth/local/signup",asyncRoute(async(req,res)=>{
    const {email,password}=localAuthSchema.parse(req.body);
    const user=await storage.createLocalUser(email,password);
    await issueSession(storage,user.id,res);
    res.status(201).json(user);
  }));
  app.post("/api/auth/local/login",asyncRoute(async(req,res)=>{
    const {email,password}=localAuthSchema.parse(req.body);
    const user=await storage.authenticateLocalUser(email,password);
    if(!user) throw Object.assign(new Error("Invalid email or password"),{status:401});
    await issueSession(storage,user.id,res);
    res.json(user);
  }));
  app.post("/api/auth/logout",asyncRoute(async(req,res)=>{
    const token=readCookie(req,SESSION_COOKIE);
    if(token) await storage.deleteSession(hashToken(token));
    res.setHeader("Set-Cookie",`${SESSION_COOKIE}=; ${cookieOptions(new Date(0))}`);
    res.status(204).end();
  }));

  app.use("/api",(req,res,next)=>{
    const token=readCookie(req,SESSION_COOKIE);
    Promise.resolve(token?storage.getSessionUser(hashToken(token)):undefined)
      .then((user)=>{
        if(!user){res.status(401).json({message:"Authentication required"});return;}
        (req as AuthenticatedRequest).authUser=user;
        next();
      })
      .catch(next);
  });

  app.get("/api/auth/user",asyncRoute(async(req,res)=>{const user=await storage.getUser(req.authUser.id);if(!user){res.status(404).json({message:"User not found"});return;}res.json(user);}));
  app.get("/api/overview",asyncRoute(async(req,res)=>{res.json(await storage.getOverview(req.authUser.id));}));
  app.get("/api/accounts",asyncRoute(async(req,res)=>{res.json(await storage.getAccounts(req.authUser.id));}));
  app.get("/api/transactions",asyncRoute(async(req,res)=>{res.json(await storage.getTransactions(req.authUser.id));}));
  app.get("/api/cards",asyncRoute(async(req,res)=>{res.json(await storage.getCards(req.authUser.id));}));
  app.patch("/api/cards/:cardId",asyncRoute(async(req,res)=>{res.json(await storage.updateCard(req.authUser.id,req.params.cardId,updateCardSchema.parse(req.body)));}));
  app.get("/api/beneficiaries",asyncRoute(async(req,res)=>{res.json(await storage.getBeneficiaries(req.authUser.id));}));
  app.post("/api/transfers",asyncRoute(async(req,res)=>{res.status(201).json(await storage.createTransfer(req.authUser.id,createTransferSchema.parse(req.body)));}));
  app.get("/api/settings",asyncRoute(async(req,res)=>{res.json(await storage.getSettings(req.authUser.id));}));
  app.patch("/api/settings/profile",asyncRoute(async(req,res)=>{res.json(await storage.updateProfile(req.authUser.id,updateProfileSchema.parse(req.body)));}));
  app.patch("/api/settings/preferences",asyncRoute(async(req,res)=>{res.json(await storage.updatePreferences(req.authUser.id,updatePreferencesSchema.parse(req.body)));}));
  app.patch("/api/settings/password",asyncRoute(async(req,res)=>{await storage.changePassword(req.authUser.id,changePasswordSchema.parse(req.body));await storage.deleteUserSessions(req.authUser.id);await issueSession(storage,req.authUser.id,res);res.status(204).end();}));

  const assertAdmin=(req:AuthenticatedRequest)=>{if(!req.authUser.isAdmin) throw Object.assign(new Error("Administrator access required"),{status:403});};
  app.get("/api/admin/stats",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminStats());}));
  app.get("/api/admin/users",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminUsers());}));
  app.post("/api/admin/users",asyncRoute(async(req,res)=>{assertAdmin(req);res.status(201).json(await storage.createAdminUser(createAdminCustomerSchema.parse(req.body)));}));
  app.get("/api/admin/users/:userId",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminUserDetails(req.params.userId));}));
  app.patch("/api/admin/users/:userId",asyncRoute(async(req,res)=>{assertAdmin(req);const update=updateAdminUserSchema.parse(req.body);if(req.params.userId===req.authUser.id&&update.isActive===false)throw Object.assign(new Error("You cannot suspend your own administrator account"),{status:422});if(req.params.userId===req.authUser.id&&update.isAdmin===false)throw Object.assign(new Error("You cannot remove your own administrator access"),{status:422});res.json(await storage.updateAdminUser(req.params.userId,update));}));
  app.get("/api/admin/transactions",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminTransactions());}));

  app.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
    if(error instanceof ZodError){res.status(400).json({message:"Check the highlighted details",issues:error.issues});return;}
    if(error instanceof Error&&"status" in error&&typeof error.status==="number"){res.status(error.status).json({message:error.message});return;}
    next(error);
  });
}
