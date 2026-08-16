import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Landmark, ReceiptText } from "lucide-react";
import type { TransactionDetails } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { formatAccountNumber, formatCurrency } from "@/lib/banking";
import { cn } from "@/lib/utils";

const transferKindLabels:Record<TransactionDetails["transferKind"],string>={
  standard:"Standard transaction",
  between_accounts:"Between your accounts",
  account_number:"Account-number transfer",
};

export function TransactionDetailsView({transaction,customerName,risk}:{transaction:TransactionDetails;customerName?:string;risk?:"standard"|"review"}){
  const [copied,setCopied]=useState(false);
  const isCredit=transaction.direction==="credit";
  const DirectionIcon=isCredit?ArrowDownLeft:ArrowUpRight;
  const copyReference=async()=>{
    try{
      if(!navigator.clipboard)return;
      await navigator.clipboard.writeText(transaction.reference);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1600);
    }catch{
      setCopied(false);
    }
  };

  return <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
    <section className="overflow-hidden rounded-2xl border bg-card">
      <div className="border-b p-5 sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-4">
            <div className={cn("grid size-12 shrink-0 place-items-center rounded-2xl",isCredit?"bg-primary/10 text-primary":"bg-muted text-foreground")}><DirectionIcon className="size-5"/></div>
            <div><p className="text-sm text-muted-foreground">{isCredit?"Money received":"Money sent"}</p><h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">{transaction.merchant}</h2></div>
          </div>
          <div className="min-w-0 sm:text-right"><p className={cn("truncate font-mono text-2xl font-semibold tracking-[-0.04em] tabular-nums sm:text-3xl",isCredit&&"text-primary")}>{isCredit?"+":"−"}{formatCurrency(transaction.amount)}</p><StatusBadge status={transaction.status}/></div>
        </div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <Detail label="Description" value={transaction.description}/>
        <Detail label="Transaction type" value={transferKindLabels[transaction.transferKind]}/>
        <Detail label="Category" value={transaction.category} capitalize/>
        <Detail label="Direction" value={transaction.direction} capitalize/>
        <Detail label="Date and time" value={new Intl.DateTimeFormat(undefined,{dateStyle:"long",timeStyle:"short"}).format(new Date(transaction.createdAt))}/>
        {customerName&&<Detail label="Customer" value={customerName}/>} 
        {risk&&<Detail label="Review level" value={risk==="review"?"Requires review":"Standard"}/>} 
      </div>
    </section>

    <aside className="space-y-6">
      <section className="rounded-2xl bg-muted/55 p-5 sm:p-6">
        <div className="flex items-center gap-3"><Landmark className="size-[18px] text-primary"/><h2 className="font-semibold">Account</h2></div>
        <dl className="mt-5 space-y-4">
          <Definition label="Account name" value={transaction.accountName}/>
          <Definition label="Account type" value={transaction.accountType} capitalize/>
          <Definition label="Account number" value={formatAccountNumber(undefined,transaction.accountMaskedNumber)}/>
        </dl>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-3"><ReceiptText className="size-[18px] text-primary"/><h2 className="font-semibold">Record</h2></div>
        <p className="mt-5 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Reference</p>
        <div className="mt-2 flex items-center gap-2 rounded-xl bg-muted/55 p-3">
          <code className="min-w-0 flex-1 truncate text-sm font-medium">{transaction.reference}</code>
          <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={copyReference} aria-label={copied?"Reference copied":"Copy transaction reference"}>{copied?<Check className="size-4 text-primary"/>:<Copy className="size-4"/>}</Button>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Use this reference when asking about this transaction. Full account numbers and private authentication data are never shown here.</p>
      </section>
    </aside>
  </div>;
}

function Detail({label,value,capitalize=false}:{label:string;value:string;capitalize?:boolean}){return <div className="bg-card p-4 sm:p-6"><p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">{label}</p><p className={cn("mt-2 break-words text-sm font-medium",capitalize&&"capitalize")}>{value}</p></div>;}
function Definition({label,value,capitalize=false}:{label:string;value:string;capitalize?:boolean}){return <div className="flex items-start justify-between gap-4"><dt className="text-sm text-muted-foreground">{label}</dt><dd className={cn("text-right text-sm font-medium",capitalize&&"capitalize")}>{value}</dd></div>;}
function StatusBadge({status}:{status:TransactionDetails["status"]}){return <span className={cn("mt-2 inline-flex rounded-md px-2 py-1 text-xs font-medium capitalize",status==="completed"?"bg-primary/10 text-primary":status==="pending"?"bg-amber-500/10 text-amber-700 dark:text-amber-300":"bg-destructive/10 text-destructive")}>{status}</span>;}
