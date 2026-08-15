import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Activity, ArrowUpRight, CircleCheck, Clock3, Landmark, Users } from "lucide-react";
import type { AdminCustomer, AdminStats, AdminTransaction } from "@clipx/contracts/admin";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/banking";

export default function AdminDashboard() {
  const { data: stats, isLoading } = useQuery<AdminStats>({ queryKey: ["/api/admin/stats"] });
  const { data: users = [] } = useQuery<AdminCustomer[]>({ queryKey: ["/api/admin/users"] });
  const { data: transactions = [] } = useQuery<AdminTransaction[]>({ queryKey: ["/api/admin/transactions"] });

  if (isLoading || !stats) return <AdminDashboardSkeleton />;

  const inactiveUsers = users.filter((user) => !user.isActive);
  const reviewQueue = transactions.filter((transaction) => transaction.risk === "review" || transaction.status === "pending");

  return (
    <div className="space-y-9">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Banking operations</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Control room</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Monitor customer access, money movement, and the health of the ClipX development environment.</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
          <CircleCheck className="size-4" />All systems operational
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_1fr_1fr]" aria-label="Platform summary">
        <article className="relative overflow-hidden rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] md:row-span-2 sm:p-7">
          <div className="absolute -right-12 -top-16 size-52 rounded-full border border-white/10" />
          <Landmark className="size-5 text-white/65" />
          <p className="mt-16 text-sm text-white/55">Managed customer balance</p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-[-0.04em] tabular-nums sm:text-4xl">{formatCurrency(stats.managedBalance)}</p>
          <div className="mt-8 border-t border-white/12 pt-5">
            <p className="text-xs text-white/50">Processed in this environment</p>
            <p className="mt-1 font-mono text-sm font-medium tabular-nums">{formatCurrency(stats.processedVolume)}</p>
          </div>
        </article>
        <Metric label="Customers" value={stats.totalCustomers.toLocaleString()} detail={`${stats.activeCustomers} currently active`} icon={Users} />
        <Metric label="Pending review" value={reviewQueue.length.toLocaleString()} detail="Transactions requiring attention" icon={Clock3} />
        <Metric label="Transactions" value={transactions.length.toLocaleString()} detail="Recorded account movements" icon={Activity} />
        <Metric label="Inactive accounts" value={inactiveUsers.length.toLocaleString()} detail="Customer access suspended" icon={Users} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div><h2 className="text-lg font-semibold">Recent money movement</h2><p className="mt-1 text-sm text-muted-foreground">Latest transactions across monitored accounts</p></div>
            <Button asChild variant="outline" size="sm"><Link to="/admin/transactions">View ledger</Link></Button>
          </div>
          <div className="mt-6 divide-y">
            {transactions.length === 0 && <div className="rounded-xl bg-muted/55 p-8 text-center"><p className="text-sm font-medium">No transactions recorded</p><p className="mt-1 text-xs text-muted-foreground">New account movements will appear here.</p></div>}
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-primary"><ArrowUpRight className="size-[18px]" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{transaction.merchant}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{transaction.customerName} · {transaction.reference}</p></div>
                <div className="text-right"><p className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(transaction.amount)}</p><p className="mt-0.5 text-xs capitalize text-muted-foreground">{transaction.status}</p></div>
              </div>
            ))}
          </div>
        </article>

        <aside className="rounded-2xl bg-muted/55 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">Customer access</h2><p className="mt-1 text-sm text-muted-foreground">Recently active accounts</p></div><Button asChild variant="ghost" size="sm"><Link to="/admin/users">Manage</Link></Button></div>
          <div className="mt-6 space-y-3">
            {users.filter((user) => !user.isAdmin).length === 0 && <div className="rounded-xl bg-card p-8 text-center"><p className="text-sm font-medium">No customers yet</p><p className="mt-1 text-xs text-muted-foreground">Registered customers will appear here.</p></div>}
            {users.filter((user) => !user.isAdmin).slice(0, 5).map((user) => (
              <div key={user.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
                <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">{user.initials}</div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</p><p className="truncate text-xs text-muted-foreground">{user.email}</p></div>
                <span className={`size-2 rounded-full ${user.isActive ? "bg-emerald-500" : "bg-muted-foreground/40"}`} aria-label={user.isActive ? "Active" : "Inactive"} />
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string; detail: string; icon: typeof Users }) {
  return <article className="rounded-2xl border bg-card p-5 sm:p-6"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-[18px] text-primary" strokeWidth={1.8} /></div><p className="mt-6 font-mono text-3xl font-semibold tracking-[-0.04em] tabular-nums">{value}</p><p className="mt-2 text-xs text-muted-foreground">{detail}</p></article>;
}

function AdminDashboardSkeleton() {
  return <div className="animate-pulse space-y-8"><div className="space-y-3"><div className="h-4 w-36 rounded bg-muted"/><div className="h-10 w-72 rounded bg-muted"/></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><div className="h-72 rounded-2xl bg-muted"/><div className="h-32 rounded-2xl bg-muted"/><div className="h-32 rounded-2xl bg-muted"/></div></div>;
}
