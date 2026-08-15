import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, LockKeyhole, ShieldCheck } from "lucide-react";
import { z } from "zod";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const adminLoginSchema=z.object({
  email:z.string().email("Enter a valid administrator email"),
  password:z.string().min(1,"Password is required"),
});

type AdminLoginForm=z.infer<typeof adminLoginSchema>;

export default function AdminLogin(){
  const {user,signInAdmin}=useAuth();
  const navigate=useNavigate();
  const {toast}=useToast();
  const [isSubmitting,setIsSubmitting]=useState(false);
  const {register,handleSubmit,formState:{errors}}=useForm<AdminLoginForm>({resolver:zodResolver(adminLoginSchema)});

  useEffect(()=>{
    if(!user?.isAdmin)return;
    fetch("/api/admin/access",{credentials:"include"}).then((response)=>{if(response.ok)navigate("/admin",{replace:true});}).catch(()=>undefined);
  },[navigate,user]);

  const onSubmit=async(values:AdminLoginForm)=>{
    setIsSubmitting(true);
    try{
      await signInAdmin(values.email,values.password);
      toast({title:"Administrator verified",description:"Opening the operations console."});
      navigate("/admin",{replace:true});
    }catch(error:unknown){
      toast({title:"Admin sign in failed",description:error instanceof Error?error.message:"Administrator access could not be verified.",variant:"destructive"});
    }finally{
      setIsSubmitting(false);
    }
  };

  return (
    <main id="main-content" className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-[#0d1714] px-5 py-10 text-white">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.04)_1px,transparent_1px)] [background-size:40px_40px]" />
      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#13221d]/95 p-6 shadow-2xl shadow-black/30 sm:p-9" aria-labelledby="admin-login-title">
        <div className="flex items-center justify-between gap-4">
          <Brand />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-emerald-200"><ShieldCheck className="size-3.5"/>Local access</span>
        </div>
        <div className="mt-10">
          <div className="mb-5 grid size-12 place-items-center rounded-xl border border-white/10 bg-white/5"><LockKeyhole className="size-5 text-emerald-300"/></div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-300">Operations console</p>
          <h1 id="admin-login-title" className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Administrator sign in</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">This console accepts authenticated administrators from loopback or private local-network addresses only.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div className="space-y-2">
            <label htmlFor="admin-email" className="text-sm font-medium text-white/80">Administrator email</label>
            <Input id="admin-email" type="email" autoComplete="username" placeholder="admin@example.com" className="border-white/10 bg-white/5 text-white placeholder:text-white/25" {...register("email")} error={errors.email?.message}/>
          </div>
          <div className="space-y-2">
            <label htmlFor="admin-password" className="text-sm font-medium text-white/80">Password</label>
            <PasswordInput id="admin-password" autoComplete="current-password" placeholder="Enter your password" visibilityLabel="administrator password" className="border-white/10 bg-white/5 text-white placeholder:text-white/25" {...register("password")} error={errors.password?.message}/>
          </div>
          <Button type="submit" className="w-full bg-emerald-300 text-[#102019] hover:bg-emerald-200" disabled={isSubmitting}>{isSubmitting?"Verifying access…":"Enter admin console"}</Button>
        </form>
        <div className="mt-7 border-t border-white/10 pt-5">
          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white"><ArrowLeft className="size-4"/>Return to customer sign in</Link>
        </div>
      </section>
    </main>
  );
}
