import { useQuery } from "@tanstack/react-query";
import { ReceiptText } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { TransactionDetails as TransactionDetailsContract } from "@clipx/contracts/banking";
import { TransactionDetailsView } from "@/components/TransactionDetailsView";
import { Button } from "@/components/ui/button";

export default function TransactionDetails(){
  const {transactionId=""}=useParams();
  const endpoint=`/api/transactions/${encodeURIComponent(transactionId)}`;
  const {data:transaction,isLoading,isError}=useQuery<TransactionDetailsContract>({queryKey:[endpoint],enabled:Boolean(transactionId)});

  return <div className="space-y-7">
    <header>
      <p className="text-sm text-muted-foreground">Account activity</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Transaction details</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">A display-safe record of this account movement.</p>
    </header>
    {isLoading?<DetailsSkeleton/>:isError||!transaction?<MissingTransaction backTo="/activity"/>:<TransactionDetailsView transaction={transaction}/>} 
  </div>;
}

function DetailsSkeleton(){return <div className="grid animate-pulse gap-6 xl:grid-cols-[1.15fr_0.85fr]"><div className="h-[430px] rounded-2xl bg-muted"/><div className="space-y-6"><div className="h-52 rounded-2xl bg-muted"/><div className="h-48 rounded-2xl bg-muted"/></div></div>;}
export function MissingTransaction({backTo}:{backTo:string}){return <div className="grid min-h-80 place-items-center rounded-2xl border bg-card p-8 text-center"><div><ReceiptText className="mx-auto size-7 text-muted-foreground"/><h2 className="mt-4 text-lg font-semibold">Transaction not found</h2><p className="mt-2 text-sm text-muted-foreground">This record may no longer be available, or you may not have access to it.</p><Button asChild className="mt-5"><Link to={backTo}>Return to transaction list</Link></Button></div></div>;}
