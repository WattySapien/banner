import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, Check, Copy, Landmark, PiggyBank, WalletCards } from "lucide-react";
import type { Account, BankTransaction } from "@clipx/contracts/banking";
import { TransactionList } from "@/components/TransactionList";
import { formatAccountNumber, formatCurrency } from "@/lib/banking";
import { useToast } from "@/hooks/use-toast";

export default function Accounts() {
  const { data: accounts = [], isLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: transactions = [] } = useQuery<BankTransaction[]>({ queryKey: ["/api/transactions"] });
  const { toast } = useToast();
  const [copiedAccountId,setCopiedAccountId]=useState<string>();
  const copyAccountNumber=async(account:Account)=>{if(!account.accountNumber)return;try{await navigator.clipboard.writeText(account.accountNumber);setCopiedAccountId(account.id);window.setTimeout(()=>setCopiedAccountId((current)=>current===account.id?undefined:current),1800);toast({title:"Account number copied",description:"It is ready to paste."});}catch{toast({title:"Could not copy account number",description:"Copy permission was denied by the browser.",variant:"destructive"});}};
  const recentTransactions=transactions.length>6&&transactions.some((item)=>item.direction==="debit")&&!transactions.slice(0,6).some((item)=>item.direction==="debit")?[...transactions.slice(0,5),transactions.find((item)=>item.direction==="debit")!]:transactions.slice(0,6);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>

        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Accounts</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">See every balance and the activity connected to it.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Bank accounts">
        {isLoading ? [0, 1].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-muted" />) : accounts.length === 0 ? <div className="grid min-h-56 place-items-center rounded-2xl bg-muted/55 p-8 text-center lg:col-span-2"><div><WalletCards className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold">No accounts opened</h2><p className="mt-1 text-sm text-muted-foreground">Bank accounts will appear here after they are created.</p></div></div> : accounts.map((account) => (
          <article key={account.id} className="relative overflow-hidden rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                {account.type === "savings" ? <PiggyBank className="size-5" strokeWidth={1.8} /> : <WalletCards className="size-5" strokeWidth={1.8} />}
              </div>
              <span className="text-xs font-medium capitalize text-muted-foreground">{account.type}</span>
            </div>
            <h2 className="mt-7 text-base font-semibold">{account.name}</h2>
            <div className="mt-1 flex items-center gap-2"><p className="font-mono text-sm tracking-[0.08em] text-muted-foreground tabular-nums">{!account.accountNumber&&<span className="mr-2 font-sans text-xs tracking-normal">Pending</span>}{formatAccountNumber(account.accountNumber,account.maskedNumber)}</p>{account.accountNumber&&<button type="button" onClick={()=>copyAccountNumber(account)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Copy full account number for ${account.name}`}>{copiedAccountId===account.id?<Check className="size-3.5 text-primary"/>:<Copy className="size-3.5"/>}</button>}</div>
            <p className="mt-6 truncate font-mono text-2xl font-semibold tracking-[-0.035em] tabular-nums sm:text-3xl">{formatCurrency(account.balance)}</p>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-medium tabular-nums">{formatCurrency(account.availableBalance)}</span>
            </div>
            {account.interestRate && <p className="mt-2 text-right text-xs text-primary">{account.interestRate}% APY</p>}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <ArrowDownLeft className="size-5 text-primary" />
          <div><h2 className="text-lg font-semibold tracking-tight">Recent account activity</h2><p className="mt-1 text-sm text-muted-foreground">Movements across all balances</p></div>
        </div>
        <TransactionList transactions={recentTransactions} />
      </section>
    </div>
  );
}
