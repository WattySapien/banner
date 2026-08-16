import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, Landmark, PiggyBank, WalletCards } from "lucide-react";
import type { Account, BankTransaction } from "@clipx/contracts/banking";
import { TransactionList } from "@/components/TransactionList";
import { formatCurrency } from "@/lib/banking";

export default function Accounts() {
  const { data: accounts = [], isLoading } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: transactions = [] } = useQuery<BankTransaction[]>({ queryKey: ["/api/transactions"] });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Your money</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Accounts</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">See every balance and the activity connected to it.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Bank accounts">
        {isLoading ? [0, 1].map((item) => <div key={item} className="h-56 animate-pulse rounded-2xl bg-muted" />) : accounts.length === 0 ? <div className="grid min-h-56 place-items-center rounded-2xl bg-muted/55 p-8 text-center lg:col-span-2"><div><WalletCards className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold">No accounts opened</h2><p className="mt-1 text-sm text-muted-foreground">Bank accounts will appear here after they are created.</p></div></div> : accounts.map((account) => (
          <article key={account.id} className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                {account.type === "savings" ? <PiggyBank className="size-5" strokeWidth={1.8} /> : <WalletCards className="size-5" strokeWidth={1.8} />}
              </div>
              <span className="text-xs font-medium capitalize text-muted-foreground">{account.type}</span>
            </div>
            <h2 className="mt-7 text-base font-semibold">{account.name}</h2>
            {account.accountNumber?<p className="mt-1 font-mono text-sm tracking-[0.08em] text-muted-foreground tabular-nums">{account.accountNumber}</p>:<p className="mt-1 text-sm text-muted-foreground">Account number pending · ending in {account.maskedNumber}</p>}
            <p className="mt-6 font-mono text-3xl font-semibold tracking-[-0.035em] tabular-nums">{formatCurrency(account.balance)}</p>
            <div className="mt-5 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">Available</span>
              <span className="font-mono font-medium tabular-nums">{formatCurrency(account.availableBalance)}</span>
            </div>
            {account.interestRate && <p className="mt-2 text-right text-xs text-primary">{account.interestRate}% APY</p>}
          </article>
        ))}
      </section>

      <section className="grid gap-5 rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] sm:grid-cols-[auto_1fr] sm:items-center sm:p-7">
        <div className="grid size-12 place-items-center rounded-xl bg-white/10"><Landmark className="size-5" /></div>
        <div>
          <h2 className="font-semibold">Deposits are protected</h2>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-white/65">Eligible balances are held with our partner bank and covered up to the applicable deposit insurance limit.</p>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-6 flex items-center gap-3">
          <ArrowDownLeft className="size-5 text-primary" />
          <div><h2 className="text-lg font-semibold tracking-tight">Recent account activity</h2><p className="mt-1 text-sm text-muted-foreground">Movements across all balances</p></div>
        </div>
        <TransactionList transactions={transactions.slice(0, 6)} />
      </section>
    </div>
  );
}
