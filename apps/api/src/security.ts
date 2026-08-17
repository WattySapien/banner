import type { NextFunction, Request, Response } from "express";

type Bucket={count:number;resetAt:number};
const buckets=new Map<string,Bucket>();

const clientKey=(req:Request)=>{
  const forwarded=req.header("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim()||req.socket.remoteAddress||"unknown";
};

export function rateLimit(options:{windowMs:number;max:number;name:string}){
  return (req:Request,res:Response,next:NextFunction)=>{
    const key=`${options.name}:${clientKey(req)}`;
    const now=Date.now();
    const current=buckets.get(key);
    const bucket=!current||current.resetAt<=now?{count:0,resetAt:now+options.windowMs}:current;
    bucket.count+=1;
    buckets.set(key,bucket);
    if(bucket.count>options.max){
      res.setHeader("Retry-After",Math.ceil((bucket.resetAt-now)/1000));
      res.status(429).json({message:"Too many requests. Try again later."});
      return;
    }
    next();
  };
}

// Prevent unbounded growth in long-lived local/API processes.
setInterval(()=>{const now=Date.now();for(const [key,bucket] of buckets)if(bucket.resetAt<=now)buckets.delete(key);},60_000).unref();
