import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, Search } from "lucide-react";
import type { BankTransaction } from "@clipx/contracts/banking";
import { TransactionList } from "@/components/TransactionList";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ActivityFilter = "all" | "credit" | "debit" | "pending";

export default function Activity() {
  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({ queryKey: ["/api/transactions"] });
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ActivityFilter>("all");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const matchesFilter = filter === "all" || (filter === "pending" ? transaction.status === "pending" : transaction.direction === filter);
      const matchesQuery = !normalized || [transaction.merchant, transaction.description, transaction.reference].some((value) => value.toLowerCase().includes(normalized));
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, transactions]);

  const exportCsv = () => {
    const rows = [["Date", "Merchant", "Description", "Direction", "Amount", "Status", "Reference"], ...filtered.map((item) => [item.createdAt, item.merchant, item.description, item.direction, item.amount.toFixed(2), item.status, item.reference])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    link.download = "clipx-activity.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Activity</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Search and review transactions across your accounts.</p></div>
        <Button className="w-full sm:w-auto" variant="outline" onClick={exportCsv} disabled={filtered.length === 0}><Download className="mr-2 size-4" />Export CSV</Button>
      </header>

      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search merchant or reference" className="pl-9" aria-label="Search activity" /></div>
          <div className="grid grid-cols-2 gap-2 min-[430px]:flex min-[430px]:flex-wrap" aria-label="Filter activity">
            {(["all", "credit", "debit", "pending"] as ActivityFilter[]).map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)} className="w-full capitalize min-[430px]:w-auto">{value === "credit" ? "Money in" : value === "debit" ? "Money out" : value}</Button>)}
          </div>
        </div>
        {isLoading ? <div className="h-80 animate-pulse rounded-xl bg-muted" /> : <TransactionList transactions={filtered} />}
      </section>
    </div>
  );
}
