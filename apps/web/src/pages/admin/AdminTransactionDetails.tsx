import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import type { AdminTransactionDetails as AdminTransactionDetailsContract } from "@clipx/contracts/admin";
import { TransactionDetailsView } from "@/components/TransactionDetailsView";
import { MissingTransaction } from "@/pages/TransactionDetails";

export default function AdminTransactionDetails(){
  const {transactionId=""}=useParams();
  const endpoint=`/api/admin/transactions/${encodeURIComponent(transactionId)}`;
  const {data:transaction,isLoading,isError}=useQuery<AdminTransactionDetailsContract>({queryKey:[endpoint],enabled:Boolean(transactionId)});

  return <div className="space-y-7">
    <header>
      <p className="text-sm text-muted-foreground">Money movement</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Transaction details</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Operational context with sensitive account and authentication data excluded.</p>
    </header>
    {isLoading?<div className="h-[430px] animate-pulse rounded-2xl bg-muted"/>:isError||!transaction?<MissingTransaction backTo="/admin/transactions"/>:<TransactionDetailsView transaction={transaction} customerName={transaction.customerName} risk={transaction.risk}/>} 
  </div>;
}
