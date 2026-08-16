import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeftRight, ArrowUpRight, Check, Copy, CreditCard, Plus, WalletCards } from "lucide-react";
import type { BankingOverview, BankCard, BankTransaction } from "@clipx/contracts/banking";
import type { AccountSettings } from "@clipx/contracts/settings";
import type { User } from "@clipx/contracts/schema";
import { Button } from "@/components/ui/button";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/banking";

export default function Dashboard() {
  const { toast } = useToast();
  const [copiedAccountId, setCopiedAccountId] = useState<string>();
  const { data: overview, isLoading } = useQuery<BankingOverview>({ queryKey: ["/api/overview"] });
  const { data: transactions = [] } = useQuery<BankTransaction[]>({ queryKey: ["/api/transactions"] });
  const { data: cards = [] } = useQuery<BankCard[]>({ queryKey: ["/api/cards"] });
  const { data: accountUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });
  const { data: settings } = useQuery<AccountSettings>({ queryKey: ["/api/settings"] });

  if (isLoading || !overview) {
    return <DashboardSkeleton />;
  }
  const netCashFlow = overview.monthlyIncome - overview.monthlySpending;
  const copyAccountNumber = async (accountId:string, accountNumber:string) => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      setCopiedAccountId(accountId);
      window.setTimeout(() => setCopiedAccountId((current) => current === accountId ? undefined : current), 1800);
      toast({ title: "Account number copied", description: "It is ready to paste." });
    } catch {
      toast({ title: "Could not copy account number", description: "Copy permission was denied by the browser.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-muted-foreground">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Good morning, {accountUser?.firstName ?? "there"}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">Your money is organized. Here is what changed since your last visit.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr]" aria-label="Balance and actions">
        <div className="relative overflow-hidden rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] shadow-[0_22px_60px_rgba(14,45,35,0.18)] sm:p-8">
          <div className="absolute -right-14 -top-16 size-56 rounded-full border border-white/8" />
          <div className="absolute -right-4 -top-4 size-32 rounded-full border border-white/8" />
          <p className="text-sm text-white/65">Total balance</p>
          <p className="mt-3 font-mono text-4xl font-semibold tracking-[-0.04em] tabular-nums sm:text-5xl">{settings?.preferences.showBalances === false ? "••••••" : formatCurrency(overview.totalBalance)}</p>
          <div className="mt-9 grid max-w-lg grid-cols-2 gap-6 border-t border-white/12 pt-5">
            <div>
              <p className="text-xs text-white/55">Income this month</p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums">+{formatCurrency(overview.monthlyIncome)}</p>
            </div>
            <div>
              <p className="text-xs text-white/55">Spent this month</p>
              <p className="mt-1 font-mono text-sm font-medium tabular-nums">{formatCurrency(overview.monthlySpending)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-muted/55 p-5 sm:p-6">
          <h2 className="font-semibold tracking-tight">Move money</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <QuickAction to="/transfer" icon={ArrowUpRight} label="Send" />
            <QuickAction to="/transfer" icon={ArrowLeftRight} label="Transfer" />
            <QuickAction to="/accounts" icon={Plus} label="Add money" />
            <QuickAction to="/cards" icon={CreditCard} label="Card controls" />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cash flow</h2>
              <p className="mt-1 text-sm text-muted-foreground">Income and spending over six months</p>
            </div>
            <span className="rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{overview.cashFlow.length === 0 ? "No activity" : `${netCashFlow >= 0 ? "+" : "−"}${formatCurrency(Math.abs(netCashFlow))}`}</span>
          </div>
          {overview.cashFlow.length === 0 ? <div className="mt-6 grid h-64 place-items-center rounded-xl bg-muted/45 text-center"><div><p className="text-sm font-medium">No cash-flow data</p><p className="mt-1 text-xs text-muted-foreground">Income and spending will appear after account activity begins.</p></div></div> : <div className="mt-6 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={overview.cashFlow} margin={{ top: 8, right: 0, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(161 57% 28%)" stopOpacity={0.22}/><stop offset="100%" stopColor="hsl(161 57% 28%)" stopOpacity={0}/></linearGradient>
                </defs>
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(215 14% 46%)" }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(215 14% 46%)" }} tickFormatter={(value) => `$${value / 1000}k`} />
                <Tooltip formatter={(value: number) => formatCurrency(value)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(214 20% 88%)", boxShadow: "0 14px 40px rgba(26,55,45,.12)" }} />
                <Area type="monotone" dataKey="income" stroke="hsl(161 57% 28%)" strokeWidth={2.5} fill="url(#incomeFill)" />
                <Area type="monotone" dataKey="spending" stroke="hsl(215 14% 58%)" strokeWidth={2} fill="transparent" strokeDasharray="4 5" />
              </AreaChart>
            </ResponsiveContainer>
          </div>}
        </div>

        <div className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Accounts</h2>
              <p className="mt-1 text-sm text-muted-foreground">Available across your accounts</p>
            </div>
            <Link to="/accounts" className="text-sm font-medium text-primary hover:underline">View all</Link>
          </div>
          <div className="mt-6 space-y-5">
            {overview.accounts.length === 0 && <div className="rounded-xl bg-muted/55 p-6 text-center"><p className="text-sm font-medium">No accounts yet</p><p className="mt-1 text-xs text-muted-foreground">Opened accounts will appear here.</p></div>}
            {overview.accounts.map((account) => (
              <div key={account.id} className="flex items-center gap-4">
                <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><WalletCards className="size-5" strokeWidth={1.8} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{account.name}</p>
                  {account.accountNumber?<div className="mt-1 flex items-center gap-1.5"><span className="font-mono text-xs tracking-[0.08em] text-muted-foreground tabular-nums">{account.accountNumber}</span><button type="button" onClick={()=>copyAccountNumber(account.id,account.accountNumber!)} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Copy account number for ${account.name}`} title="Copy account number">{copiedAccountId===account.id?<Check className="size-3.5 text-primary"/>:<Copy className="size-3.5"/>}</button></div>:<p className="mt-0.5 text-xs text-muted-foreground">Account number pending · ending in {account.maskedNumber}</p>}
                </div>
                <p className="font-mono text-sm font-semibold tabular-nums">{settings?.preferences.showBalances === false ? "••••" : formatCurrency(account.balance)}</p>
              </div>
            ))}
          </div>
          {cards[0] && <div className="mt-7 rounded-xl bg-muted/60 p-4 text-sm"><span className="text-muted-foreground">Primary card</span><span className="float-right font-mono font-medium">Visa {cards[0].lastFour}</span></div>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div><h2 className="text-lg font-semibold tracking-tight">Recent activity</h2><p className="mt-1 text-sm text-muted-foreground">Latest account movements</p></div>
          <Button asChild variant="outline" size="sm"><Link to="/activity">All activity</Link></Button>
        </div>
        <TransactionList transactions={transactions.slice(0, 5)} />
      </section>
    </div>
  );
}

function QuickAction({ to, icon: Icon, label }: { to: string; icon: typeof ArrowUpRight; label: string }) {
  return <Link to={to} className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/30 hover:bg-primary/[0.03] active:translate-y-px"><Icon className="size-5 text-primary" strokeWidth={1.8} /><p className="mt-4 text-sm font-semibold">{label}</p></Link>;
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-8"><div className="space-y-3"><div className="h-4 w-32 rounded bg-muted"/><div className="h-10 w-72 rounded bg-muted"/></div><div className="grid gap-4 lg:grid-cols-[1.45fr_0.8fr]"><div className="h-64 rounded-2xl bg-muted"/><div className="h-64 rounded-2xl bg-muted"/></div><div className="h-80 rounded-2xl bg-muted"/></div>;
}
