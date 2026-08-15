import { createContext, useContext, useEffect, useState } from "react";
import type { LocalAuthUser } from "@clipx/contracts/auth";

type AuthContextType={
  user:LocalAuthUser|null;
  signIn:(email:string,password:string)=>Promise<LocalAuthUser>;
  signInAdmin:(email:string,password:string)=>Promise<LocalAuthUser>;
  signUp:(email:string,password:string)=>Promise<LocalAuthUser>;
  signOut:()=>Promise<void>;
  isAuthenticated:boolean;
  isLoading:boolean;
};

export const AuthContext=createContext<AuthContextType|undefined>(undefined);

async function authRequest(path:string,options?:RequestInit){
  const response=await fetch(path,{...options,credentials:"include",headers:{...(options?.body?{"Content-Type":"application/json"}:{}),...options?.headers}});
  if(!response.ok){
    const error=await response.json().catch(()=>({message:response.statusText})) as {message?:string;code?:string;stage?:string;requestId?:string};
    const diagnostic=[error.code,error.stage,error.requestId?`request ${error.requestId}`:undefined].filter(Boolean).join(" · ");
    throw new Error(`${error.message??"Authentication failed"}${diagnostic?` (${diagnostic})`:""}`);
  }
  return response.status===204?null:response.json();
}

export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<LocalAuthUser|null>(null);
  const [isLoading,setIsLoading]=useState(true);
  useEffect(()=>{let active=true;authRequest("/api/auth/user").then((account)=>{if(active)setUser(account);}).catch(()=>{if(active)setUser(null);}).finally(()=>{if(active)setIsLoading(false);});return()=>{active=false;};},[]);
  const signIn=async(email:string,password:string)=>{const account=await authRequest("/api/auth/local/login",{method:"POST",body:JSON.stringify({email,password})});setUser(account);return account;};
  const signInAdmin=async(email:string,password:string)=>{const account=await authRequest("/api/auth/admin/login",{method:"POST",body:JSON.stringify({email,password})});setUser(account);return account;};
  const signUp=async(email:string,password:string)=>{const account=await authRequest("/api/auth/local/signup",{method:"POST",body:JSON.stringify({email,password})});setUser(account);return account;};
  const signOut=async()=>{await authRequest("/api/auth/logout",{method:"POST"});setUser(null);};
  return <AuthContext.Provider value={{user,signIn,signInAdmin,signUp,signOut,isAuthenticated:Boolean(user),isLoading}}>{children}</AuthContext.Provider>;
}

export function useAuth(){const context=useContext(AuthContext);if(!context)throw new Error("useAuth must be used within an AuthProvider");return context;}
