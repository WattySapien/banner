import { createHash, randomBytes } from "node:crypto";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { ZodError } from "zod";
import { accountNumberSchema, createInternalTransferSchema, createPeerTransferSchema, createTransferSchema, updateCardSchema } from "@clipx/contracts/banking";
import { createAdminAccountSchema, createAdminCardSchema, createAdminCustomerSchema, updateAdminAccountSchema, updateAdminUserSchema } from "@clipx/contracts/admin";
import { changePasswordSchema, updatePreferencesSchema, updateProfileSchema } from "@clipx/contracts/settings";
import { localAuthSchema, localSignupSchema, type LocalAuthUser } from "@clipx/contracts/auth";
import { config } from "./config.js";
import { atStage } from "./diagnostics.js";
import { isLocalRequest } from "./network-access.js";
import type { IStorage } from "./storage.js";

const SESSION_COOKIE="clipx_session";
const MAX_AVATAR_BYTES=2*1024*1024;
const avatarBodyParser=express.raw({type:["image/jpeg","image/png","image/webp"],limit:MAX_AVATAR_BYTES});
const unsafeMethods=new Set(["POST","PUT","PATCH","DELETE"]);
type AuthenticatedRequest=Request & { authUser:LocalAuthUser };

const asyncRoute=(handler:(req:AuthenticatedRequest,res:Response)=>Promise<void>)=>(req:Request,res:Response,next:NextFunction)=>{Promise.resolve(handler(req as AuthenticatedRequest,res)).catch(next);};
const hashToken=(token:string)=>createHash("sha256").update(token).digest("hex");
const readCookie=(req:Request,name:string)=>req.headers.cookie?.split(";").map((part)=>part.trim()).find((part)=>part.startsWith(`${name}=`))?.slice(name.length+1);
const cookieOptions=(expires?:Date)=>["Path=/","HttpOnly","SameSite=Lax",config.isProduction?"Secure":"",expires?`Expires=${expires.toUTCString()}`:""].filter(Boolean).join("; ");

async function issueSession(storage:IStorage,userId:string,res:Response){
  const token=randomBytes(32).toString("base64url");
  const expiresAt=new Date(Date.now()+config.sessionDays*86_400_000);
  await atStage("auth.session.create",()=>storage.createSession(userId,hashToken(token),expiresAt));
  res.setHeader("Set-Cookie",`${SESSION_COOKIE}=${token}; ${cookieOptions(expiresAt)}`);
}

function assertLocalAdminRequest(req:Request){
  if(!isLocalRequest(req))throw Object.assign(new Error("Administrator access is limited to local network connections"),{status:403});
}

function avatarContentType(data:Buffer){
  if(data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff)return "image/jpeg" as const;
  if(data.length>=8&&data.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])))return "image/png" as const;
  if(data.length>=12&&data.subarray(0,4).toString("ascii")==="RIFF"&&data.subarray(8,12).toString("ascii")==="WEBP")return "image/webp" as const;
  return undefined;
}

function readAvatarUpload(req:Request){
  const data=Buffer.isBuffer(req.body)?req.body:undefined;
  if(!data||data.byteLength===0)throw Object.assign(new Error("Choose a JPEG, PNG, or WebP profile image"),{status:415});
  const contentType=avatarContentType(data);
  if(!contentType||contentType!==req.header("content-type")?.split(";")[0]?.trim().toLowerCase())throw Object.assign(new Error("The uploaded file is not a valid JPEG, PNG, or WebP image"),{status:415});
  return {contentType,data};
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

  app.get("/api/health",asyncRoute(async(_req,res)=>{await atStage("health.database.ping",()=>storage.ping());res.json({status:"ok",storage:storage.kind,timestamp:new Date().toISOString()});}));
  app.get("/api",asyncRoute(async(_req,res)=>{res.json({name:"ClipX Banking API",status:"production-ready"});}));

  app.post("/api/auth/local/signup",asyncRoute(async(req,res)=>{
    const {email,password,firstName,lastName}=localSignupSchema.parse(req.body);
    const user=await atStage("signup.user.create",()=>storage.createLocalUser(email,password,firstName,lastName));
    await issueSession(storage,user.id,res);
    res.status(201).json(user);
  }));
  app.post("/api/auth/local/login",asyncRoute(async(req,res)=>{
    const {email,password}=localAuthSchema.parse(req.body);
    const user=await atStage("login.credentials.verify",()=>storage.authenticateLocalUser(email,password));
    if(!user) throw Object.assign(new Error("Invalid email or password"),{status:401});
    await issueSession(storage,user.id,res);
    res.json(user);
  }));
  app.post("/api/auth/admin/login",asyncRoute(async(req,res)=>{
    assertLocalAdminRequest(req);
    const {email,password}=localAuthSchema.parse(req.body);
    const user=await atStage("admin_login.credentials.verify",()=>storage.authenticateLocalUser(email,password));
    if(!user||!user.isAdmin) throw Object.assign(new Error("Invalid administrator credentials"),{status:401});
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

  const assertAdmin=(req:AuthenticatedRequest)=>{assertLocalAdminRequest(req);if(!req.authUser.isAdmin) throw Object.assign(new Error("Administrator access required"),{status:403});};
  const adminOnly=(req:Request,_res:Response,next:NextFunction)=>{try{assertAdmin(req as AuthenticatedRequest);next();}catch(error){next(error);}};

  app.get("/api/auth/user",asyncRoute(async(req,res)=>{const user=await storage.getUser(req.authUser.id);if(!user){res.status(404).json({message:"User not found"});return;}res.json(user);}));
  app.get("/api/avatars/:userId",asyncRoute(async(req,res)=>{
    if(req.params.userId!==req.authUser.id)assertAdmin(req);
    const avatar=await storage.getUserAvatar(req.params.userId);
    if(!avatar)throw Object.assign(new Error("Profile image not found"),{status:404});
    const etag=`"${createHash("sha256").update(avatar.data).digest("base64url")}"`;
    res.setHeader("Cache-Control","private, max-age=300");
    res.setHeader("Content-Type",avatar.contentType);
    res.setHeader("Content-Length",avatar.data.byteLength);
    res.setHeader("ETag",etag);
    res.setHeader("Last-Modified",new Date(avatar.updatedAt).toUTCString());
    if(req.header("if-none-match")===etag){res.status(304).end();return;}
    res.send(avatar.data);
  }));
  app.put("/api/settings/avatar",avatarBodyParser,asyncRoute(async(req,res)=>{
    res.json(await storage.updateUserAvatar(req.authUser.id,readAvatarUpload(req)));
  }));
  app.get("/api/overview",asyncRoute(async(req,res)=>{res.json(await storage.getOverview(req.authUser.id));}));
  app.get("/api/accounts",asyncRoute(async(req,res)=>{res.json(await storage.getAccounts(req.authUser.id));}));
  app.get("/api/transactions",asyncRoute(async(req,res)=>{res.json(await storage.getTransactions(req.authUser.id));}));
  app.get("/api/transactions/:transactionId",asyncRoute(async(req,res)=>{res.json(await storage.getTransaction(req.authUser.id,req.params.transactionId));}));
  app.get("/api/cards",asyncRoute(async(req,res)=>{res.json(await storage.getCards(req.authUser.id));}));
  app.get("/api/cards/:cardId/details",asyncRoute(async(req,res)=>{res.setHeader("Cache-Control","no-store, private");res.json(await storage.getCardDetails(req.authUser.id,req.params.cardId));}));
  app.patch("/api/cards/:cardId",asyncRoute(async(req,res)=>{res.json(await storage.updateCard(req.authUser.id,req.params.cardId,updateCardSchema.parse(req.body)));}));
  app.get("/api/notifications",asyncRoute(async(req,res)=>{res.json(await storage.getNotifications(req.authUser.id));}));
  app.patch("/api/notifications/read-all",asyncRoute(async(req,res)=>{await storage.markAllNotificationsRead(req.authUser.id);res.status(204).end();}));
  app.patch("/api/notifications/:notificationId/read",asyncRoute(async(req,res)=>{res.json(await storage.markNotificationRead(req.authUser.id,req.params.notificationId));}));
  app.get("/api/beneficiaries",asyncRoute(async(req,res)=>{res.json(await storage.getBeneficiaries(req.authUser.id));}));
  app.post("/api/transfers",asyncRoute(async(req,res)=>{res.status(201).json(await storage.createTransfer(req.authUser.id,createTransferSchema.parse(req.body)));}));
  app.post("/api/transfers/internal",asyncRoute(async(req,res)=>{res.status(201).json(await storage.createInternalTransfer(req.authUser.id,createInternalTransferSchema.parse(req.body)));}));
  app.post("/api/transfers/recipient/lookup",asyncRoute(async(req,res)=>{res.json(await storage.lookupPeerRecipient(req.authUser.id,accountNumberSchema.parse(req.body?.accountNumber)));}));
  app.post("/api/transfers/peer",asyncRoute(async(req,res)=>{res.status(201).json(await storage.createPeerTransfer(req.authUser.id,createPeerTransferSchema.parse(req.body)));}));
  app.get("/api/settings",asyncRoute(async(req,res)=>{res.json(await storage.getSettings(req.authUser.id));}));
  app.patch("/api/settings/profile",asyncRoute(async(req,res)=>{res.json(await storage.updateProfile(req.authUser.id,updateProfileSchema.parse(req.body)));}));
  app.patch("/api/settings/preferences",asyncRoute(async(req,res)=>{res.json(await storage.updatePreferences(req.authUser.id,updatePreferencesSchema.parse(req.body)));}));
  app.patch("/api/settings/password",asyncRoute(async(req,res)=>{await storage.changePassword(req.authUser.id,changePasswordSchema.parse(req.body));await storage.deleteUserSessions(req.authUser.id);await issueSession(storage,req.authUser.id,res);res.status(204).end();}));

  app.get("/api/admin/access",asyncRoute(async(req,res)=>{assertAdmin(req);res.json({allowed:true});}));
  app.get("/api/admin/stats",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminStats());}));
  app.get("/api/admin/users",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminUsers());}));
  app.post("/api/admin/users",asyncRoute(async(req,res)=>{assertAdmin(req);res.status(201).json(await storage.createAdminUser(createAdminCustomerSchema.parse(req.body)));}));
  app.get("/api/admin/users/:userId",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminUserDetails(req.params.userId));}));
  app.patch("/api/admin/users/:userId",asyncRoute(async(req,res)=>{assertAdmin(req);const update=updateAdminUserSchema.parse(req.body);if(req.params.userId===req.authUser.id&&update.isActive===false)throw Object.assign(new Error("You cannot suspend your own administrator account"),{status:422});if(req.params.userId===req.authUser.id&&update.isAdmin===false)throw Object.assign(new Error("You cannot remove your own administrator access"),{status:422});res.json(await storage.updateAdminUser(req.params.userId,update));}));
  app.put("/api/admin/users/:userId/avatar",adminOnly,avatarBodyParser,asyncRoute(async(req,res)=>{await storage.updateUserAvatar(req.params.userId,readAvatarUpload(req));res.json((await storage.getAdminUserDetails(req.params.userId)).customer);}));
  app.post("/api/admin/users/:userId/accounts",asyncRoute(async(req,res)=>{assertAdmin(req);res.status(201).json(await storage.createAdminAccount(req.params.userId,createAdminAccountSchema.parse(req.body)));}));
  app.patch("/api/admin/users/:userId/accounts/:accountId",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.updateAdminAccount(req.params.userId,req.params.accountId,updateAdminAccountSchema.parse(req.body)));}));
  app.post("/api/admin/users/:userId/accounts/:accountId/number",asyncRoute(async(req,res)=>{assertAdmin(req);res.status(201).json(await storage.assignAdminAccountNumber(req.params.userId,req.params.accountId));}));
  app.post("/api/admin/users/:userId/cards",asyncRoute(async(req,res)=>{assertAdmin(req);res.status(201).json(await storage.createAdminCard(req.params.userId,createAdminCardSchema.parse(req.body)));}));
  app.get("/api/admin/transactions",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminTransactions());}));
  app.get("/api/admin/transactions/:transactionId",asyncRoute(async(req,res)=>{assertAdmin(req);res.json(await storage.getAdminTransaction(req.params.transactionId));}));

  app.use((error:unknown,_req:Request,res:Response,next:NextFunction)=>{
    if(error instanceof ZodError){res.status(400).json({message:"Check the highlighted details",issues:error.issues});return;}
    if(error instanceof Error&&"status" in error&&typeof error.status==="number"){res.status(error.status).json({message:error.message});return;}
    next(error);
  });
}
