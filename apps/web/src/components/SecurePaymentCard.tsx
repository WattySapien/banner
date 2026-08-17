import { useEffect,useRef,useState } from "react";
import { motion,useReducedMotion } from "framer-motion";
import { Eye,EyeOff,LoaderCircle,Snowflake,Wifi } from "lucide-react";
import type { BankCard,CardDetails } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/banking";

const formatCardNumber=(value:string)=>value.replace(/(.{4})/g,"$1 ").trim();

function NetworkMark({network}:{network:BankCard["network"]}){
  const isMastercard=String(network).toLowerCase()==="mastercard";
  return <div className="flex size-12 items-center justify-center" aria-label={isMastercard?"Mastercard":"Visa"}><img src={isMastercard?"/icons/mastercard.svg?v=2":"/icons/visa.svg"} alt="" className="size-full object-contain"/></div>;
}

export function SecurePaymentCard({card,index,onToggleStatus,isUpdating}:{card:BankCard;index:number;onToggleStatus:()=>void;isUpdating:boolean}){
  const [details,setDetails]=useState<CardDetails>();
  const [isLoading,setIsLoading]=useState(false);
  const [error,setError]=useState<string>();
  const hideTimer=useRef<number>();
  const reduceMotion=useReducedMotion();
  const isRevealed=Boolean(details);

  const hide=()=>{window.clearTimeout(hideTimer.current);setDetails(undefined);setError(undefined);};
  const reveal=async()=>{
    if(isRevealed){hide();return;}
    setIsLoading(true);setError(undefined);
    try{
      const value=await apiRequest(`/api/cards/${card.id}/details`) as CardDetails;
      setDetails(value);
      const remaining=Math.max(0,new Date(value.revealExpiresAt).getTime()-Date.now());
      hideTimer.current=window.setTimeout(()=>setDetails(undefined),remaining);
    }catch(revealError){setError(revealError instanceof Error?revealError.message:"Card details could not be shown");}
    finally{setIsLoading(false);}
  };

  useEffect(()=>()=>window.clearTimeout(hideTimer.current),[]);
  const surface=index%2===0?"from-[#2f2254] via-[#59409a] to-[#8f68ef]":"from-[#211a3a] via-[#4d3b7a] to-[#7561a9]";

  return <motion.article initial={reduceMotion?false:{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.65,delay:index*.08,ease:[.32,.72,0,1]}} className="w-full max-w-[25rem] rounded-[1.65rem] bg-foreground/[0.045] p-1.5 ring-1 ring-foreground/[0.06]">
    <div className="rounded-[calc(1.65rem-0.375rem)] bg-card p-3 shadow-[inset_0_1px_0_hsl(var(--background)/.7)] min-[380px]:p-4">
      <div className="[perspective:1200px]">
        <motion.div whileHover={reduceMotion?undefined:{rotateX:2.5,rotateY:-4,y:-4}} transition={{duration:.55,ease:[.32,.72,0,1]}} className={`relative aspect-[1.58/1] overflow-hidden rounded-[1.2rem] bg-gradient-to-br ${surface} p-4 text-white shadow-[0_22px_50px_hsl(258_60%_32%/.22)] [transform-style:preserve-3d] min-[380px]:rounded-[1.3rem] min-[380px]:p-5`}>
          <div className="absolute -right-16 -top-20 size-60 rounded-full border border-white/10"/><div className="absolute -bottom-24 -left-14 size-64 rounded-full border border-white/10"/><div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_22%,rgba(255,255,255,.13),transparent_28%)]"/>
          <div className="relative flex h-full flex-col [transform:translateZ(24px)]">
            <div className="flex items-start justify-between"><div><p className="text-sm font-semibold tracking-[-0.01em]">Ardenvia</p><p className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-white/45">{card.type} debit</p></div><div className="flex flex-col items-end gap-2"><Wifi className="size-5 rotate-90 text-white/70" strokeWidth={1.6}/><NetworkMark network={card.network}/></div></div>
            <div className="mt-auto">
              <motion.p key={isRevealed?"revealed":"masked"} initial={reduceMotion?false:{opacity:0,y:8}} animate={{opacity:1,y:0}} className="font-mono text-[0.82rem] tracking-[0.08em] tabular-nums min-[380px]:text-lg min-[380px]:tracking-[0.12em] sm:text-xl">{details?formatCardNumber(details.number):`**** **** **** ${card.lastFour}`}</motion.p>
              <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] items-end gap-2 min-[380px]:mt-4 min-[380px]:gap-4">
                <div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Card holder</p><p className="mt-1 truncate text-[11px] font-medium tracking-wide sm:text-xs">{card.holderName}</p></div>
                <div><p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Expires</p><p className="mt-1 font-mono text-xs">{isRevealed?card.expires:"••/••"}</p></div>
                <div><p className="text-[9px] uppercase tracking-[0.16em] text-white/45">Dynamic CVC</p><p className="mt-1 min-w-7 font-mono text-xs">{details?.securityCode??"•••"}</p></div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4"><div><h2 className="font-semibold capitalize">{card.type} card</h2><p className="mt-1 text-sm text-muted-foreground">{card.status==="frozen"?"Payments are currently blocked":`${formatCurrency(card.spendingLimit)} spending limit`}</p></div><span className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${card.status==="active"?"bg-primary/10 text-primary":"bg-muted text-muted-foreground"}`}>{card.status}</span></div>
      {error&&<p className="mt-3 text-xs text-destructive" role="alert">{error}</p>}
      <div className="mt-5 grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2 min-[380px]:gap-3">
        <Button className="px-2" variant="outline" onClick={reveal} disabled={isLoading||!card.hasSecureDetails}>{isLoading?<LoaderCircle className="mr-1.5 size-4 animate-spin"/>:isRevealed?<EyeOff className="mr-1.5 size-4"/>:<Eye className="mr-1.5 size-4"/>}{isRevealed?"Hide details":card.hasSecureDetails?"View details":"Details unavailable"}</Button>
        <Button className="px-2" variant={card.status==="active"?"outline":"default"} disabled={isUpdating} onClick={onToggleStatus}><Snowflake className="mr-1.5 size-4"/>{card.status==="active"?"Freeze":"Unfreeze"}</Button>
      </div>
      {isRevealed&&<p className="mt-3 text-center text-[11px] text-muted-foreground">Private details hide after 30 seconds. A new security code is generated on each reveal.</p>}
    </div>
  </motion.article>;
}
