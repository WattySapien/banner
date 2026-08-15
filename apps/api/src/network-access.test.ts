import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { getClientIp, isLocalIpAddress } from "./network-access.js";

test("accepts loopback and private network addresses",()=>{
  for(const address of ["127.0.0.1","127.12.0.4","10.0.0.8","172.16.0.1","172.31.255.254","192.168.1.20","169.254.2.3","::1","fd12::4","fc00::5","fe80::1","::ffff:192.168.0.12"]){
    assert.equal(isLocalIpAddress(address),true,address);
  }
});

test("rejects public, invalid, and unspecified addresses",()=>{
  for(const address of [undefined,"","0.0.0.0","8.8.8.8","172.15.0.1","172.32.0.1","192.169.1.1","1.1.1.1","::","2001:4860:4860::8888","fc-not-an-ip::1","not-an-ip"]){
    assert.equal(isLocalIpAddress(address),false,String(address));
  }
});

function request(headers:Record<string,string>,remoteAddress:string){
  return {headers,socket:{remoteAddress}} as unknown as Request;
}

test("prefers Netlify's client IP over forwarding and socket addresses",()=>{
  assert.equal(getClientIp(request({"x-nf-client-connection-ip":"203.0.113.8","x-forwarded-for":"127.0.0.1"},"::1")),"203.0.113.8");
});

test("trusts forwarding only from a local reverse proxy",()=>{
  assert.equal(getClientIp(request({"x-forwarded-for":"192.168.1.8, 127.0.0.1"},"::1")),"192.168.1.8");
  assert.equal(getClientIp(request({"x-forwarded-for":"127.0.0.1"},"203.0.113.8")),"203.0.113.8");
});
