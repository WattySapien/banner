import type { IncomingMessage, ServerResponse } from "node:http";

type ProxyRequest=IncomingMessage&{body?:unknown};
type ProxyResponse=ServerResponse&{status:(code:number)=>ProxyResponse;json:(body:unknown)=>void;send:(body:unknown)=>void};

export default async function proxy(request:ProxyRequest,response:ProxyResponse){
  const origin=process.env.API_ORIGIN?.replace(/\/$/,"");
  if(!origin){response.status(500).json({message:"API_ORIGIN is not configured"});return;}
  const target=new URL(request.url??"/api",origin);
  const headers=new Headers();
  for(const [name,value] of Object.entries(request.headers)){
    if(["host","connection","content-length"].includes(name)||value===undefined)continue;
    headers.set(name,Array.isArray(value)?value.join(","):value);
  }
  const hasBody=!["GET","HEAD"].includes(request.method??"GET");
  const body=hasBody?(Buffer.isBuffer(request.body)?request.body:typeof request.body==="string"?request.body:request.body===undefined?undefined:JSON.stringify(request.body)):undefined;
  const upstream=await fetch(target,{method:request.method,headers,body});
  response.status(upstream.status);
  upstream.headers.forEach((value,name)=>{if(!["content-encoding","content-length","transfer-encoding"].includes(name))response.setHeader(name,value);});
  response.send(Buffer.from(await upstream.arrayBuffer()));
}
