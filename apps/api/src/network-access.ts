import { isIP } from "node:net";
import type { Request } from "express";

function firstAddress(value:string|string[]|undefined){
  const raw=Array.isArray(value)?value[0]:value;
  return raw?.split(",")[0]?.trim();
}

function normalizeAddress(value:string|undefined){
  if(!value)return undefined;
  const withoutZone=value.trim().replace(/^\[|\]$/g,"").split("%")[0]?.toLowerCase();
  return withoutZone?.startsWith("::ffff:")?withoutZone.slice(7):withoutZone;
}

export function isLocalIpAddress(value:string|undefined){
  const address=normalizeAddress(value);
  if(!address)return false;
  if(address==="::1")return true;
  if(isIP(address)===6){
    return address.startsWith("fc")||address.startsWith("fd")||/^fe[89ab]/.test(address);
  }
  if(isIP(address)!==4)return false;
  const octets=address.split(".").map(Number);
  const [first,second]=octets;
  return first===127||first===10||(first===172&&second>=16&&second<=31)||(first===192&&second===168)||(first===169&&second===254);
}

export function getClientIp(req:Request){
  const netlifyClient=firstAddress(req.headers["x-nf-client-connection-ip"]);
  if(netlifyClient)return normalizeAddress(netlifyClient);

  const socketAddress=normalizeAddress(req.socket.remoteAddress);
  const forwardedClient=firstAddress(req.headers["x-forwarded-for"]);
  if(forwardedClient&&isLocalIpAddress(socketAddress))return normalizeAddress(forwardedClient);
  return socketAddress;
}

export function isLocalRequest(req:Request){
  return isLocalIpAddress(getClientIp(req));
}
