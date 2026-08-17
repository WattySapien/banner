import { createCipheriv,createDecipheriv,createHmac,randomInt,randomBytes } from "node:crypto";

export type EncryptedPan={ciphertext:string;iv:string;authTag:string};

export function generateMastercardPan(){
  const prefix=randomInt(51,56);
  const digits=[Math.floor(prefix/10),prefix%10];
  while(digits.length<15)digits.push(randomInt(0,10));
  digits.push(luhnCheckDigit(digits));
  return digits.join("");
}

export function generateVisaPan(){
  const digits=[4];
  while(digits.length<15)digits.push(randomInt(0,10));
  digits.push(luhnCheckDigit(digits));
  return digits.join("");
}

function luhnCheckDigit(digits:number[]){
  const parity=(digits.length+1)%2;
  const sum=digits.reduce((total,digit,index)=>{
    if(index%2!==parity)return total+digit;
    const doubled=digit*2;
    return total+(doubled>9?doubled-9:doubled);
  },0);
  return(10-(sum%10))%10;
}

export function encryptPan(pan:string,key:Buffer):EncryptedPan{
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,iv);
  const ciphertext=Buffer.concat([cipher.update(pan,"utf8"),cipher.final()]);
  return{ciphertext:ciphertext.toString("base64"),iv:iv.toString("base64"),authTag:cipher.getAuthTag().toString("base64")};
}

export function decryptPan(value:EncryptedPan,key:Buffer){
  const decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(value.iv,"base64"));
  decipher.setAuthTag(Buffer.from(value.authTag,"base64"));
  return Buffer.concat([decipher.update(Buffer.from(value.ciphertext,"base64")),decipher.final()]).toString("utf8");
}

export const generateSecurityCode=()=>randomInt(100,1000).toString();
export const fingerprintPan=(pan:string,key:Buffer)=>createHmac("sha256",key).update(pan).digest("hex");

export function generateExpiry(){
  const date=new Date();
  date.setUTCFullYear(date.getUTCFullYear()+4);
  return`${String(date.getUTCMonth()+1).padStart(2,"0")}/${String(date.getUTCFullYear()).slice(-2)}`;
}
