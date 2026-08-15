import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Search } from "lucide-react";
import type { AdminTransaction } from "@clipx/contracts/admin";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/banking";
import { cn } from "@/lib/utils";

type TransactionFilter = "all" | "completed" | "pending" | "review";

export default function TransactionMonitor() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("all");
  const { data: transactions = [], isLoading } = useQuery<AdminTransaction[]>({ queryKey: ["/api/admin/transactions"] });

  const filtered = useMemo(() => transactions.filter((transaction) => {
    const matchesSearch = `${transaction.merchant} ${transaction.customerName} ${transaction.reference}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = filter === "all" || transaction.status === filter || (filter === "review" && transaction.risk === "review");
    return matchesSearch && matchesFilter;
  }), [filter, search, transactions]);

  const reviewCount = transactions.filter((transaction) => transaction.risk === "review").length;
  const completedVolume = transactions.filter((transaction) => transaction.status === "completed").reduce((sum, transaction) => sum + transaction.amount, 0);

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">Money movement</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Transaction ledger</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Inspect payment activity, pending movements, and transactions marked for review.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Transaction summary">
        <Summary label="Recorded transactions" value={transactions.length.toLocaleString()} />
        <Summary label="Completed volume" value={formatCurrency(completedVolume)} />
        <Summary label="Review queue" value={reviewCount.toLocaleString()} attention={reviewCount > 0} />
      </section>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchant, customer, reference" className="pl-9" aria-label="Search transactions"/></div>
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/70 p-1">
            {(["all", "completed", "pending", "review"] as TransactionFilter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("shrink-0 rounded-md px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground transition-colors", filter === item && "bg-card text-foreground shadow-sm")}>{item}</button>)}
          </div>
        </div>

        {isLoading ? <LedgerSkeleton /> : filtered.length === 0 ? <div className="px-6 py-16 text-center"><Search className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold">No transactions found</h2><p className="mt-1 text-sm text-muted-foreground">Adjust your search or ledger filter.</p></div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b bg-muted/35 text-xs text-muted-foreground"><tr><th className="px-5 py-3 font-medium">Transaction</th><th className="px-5 py-3 font-medium">Customer</th><th className="px-5 py-3 font-medium">Date</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Amount</th></tr></thead>
              <tbody className="divide-y">{filtered.map((transaction) => (
                <tr key={transaction.id} className="transition-colors hover:bg-muted/25">
                  <td className="px-5 py-4"><div className="flex items-center gap-3"><div className={cn("grid size-9 place-items-center rounded-lg", transaction.direction === "credit" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{transaction.direction === "credit" ? <ArrowDownLeft className="size-4"/> : <ArrowUpRight className="size-4"/>}</div><div><p className="font-semibold">{transaction.merchant}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">{transaction.reference}</p></div></div></td>
                  <td className="px-5 py-4"><p className="font-medium">{transaction.customerName}</p><p className="mt-0.5 text-xs text-muted-foreground">{transaction.category}</p></td>
                  <td className="px-5 py-4 text-muted-foreground">{new Date(transaction.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</td>
                  <td className="px-5 py-4"><div className="flex items-center gap-2"><span className={cn("rounded-md px-2 py-1 text-xs font-medium capitalize", transaction.status === "completed" ? "bg-primary/10 text-primary" : transaction.status === "pending" ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-destructive/10 text-destructive")}>{transaction.status}</span>{transaction.risk === "review" && <AlertTriangle className="size-4 text-amber-600" aria-label="Review required"/>}</div></td>
                  <td className="px-5 py-4 text-right font-mono font-semibold tabular-nums">{transaction.direction === "debit" ? "−" : "+"}{formatCurrency(transaction.amount)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value, attention = false }: { label: string; value: string; attention?: boolean }) {
  return <article className={cn("rounded-2xl bg-muted/55 p-5", attention && "bg-amber-500/10")}><p className="text-sm text-muted-foreground">{label}</p><p className={cn("mt-4 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums", attention && "text-amber-700 dark:text-amber-400")}>{value}</p></article>;
}

function LedgerSkeleton() {
  return <div className="divide-y animate-pulse">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="flex items-center gap-4 p-5"><div className="size-9 rounded-lg bg-muted"/><div className="space-y-2"><div className="h-4 w-36 rounded bg-muted"/><div className="h-3 w-24 rounded bg-muted"/></div></div>)}</div>;
}
