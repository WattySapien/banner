import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeftRight, Check, Copy, CreditCard, MoveUpRight, Plus, WalletCards } from "lucide-react";
import type { BankingOverview, BankCard, BankTransaction } from "@clipx/contracts/banking";
import type { AccountSettings } from "@clipx/contracts/settings";
import type { User } from "@clipx/contracts/schema";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/hooks/use-toast";
import { formatAccountNumber, formatCurrency } from "@/lib/banking";

export default function Dashboard() {
  const { toast } = useToast();
  const [copiedAccountId, setCopiedAccountId] = useState<string>();
  const { data: overview, isLoading } = useQuery<BankingOverview>({ queryKey: ["/api/overview"] });
  const { data: transactions = [] } = useQuery<BankTransaction[]>({ queryKey: ["/api/transactions"] });
  const { data: cards = [] } = useQuery<BankCard[]>({ queryKey: ["/api/cards"], staleTime: 0, refetchOnMount: "always" });
  const { data: accountUser } = useQuery<User>({ queryKey: ["/api/auth/user"], staleTime: 15_000, refetchInterval: 30_000, refetchOnMount: true });
  const { data: settings } = useQuery<AccountSettings>({ queryKey: ["/api/settings"] });

  if (isLoading || !overview) return <DashboardSkeleton />;

  const balancesVisible = settings?.preferences.showBalances !== false;
  const fullName = [accountUser?.firstName, accountUser?.lastName].filter(Boolean).join(" ") || "Account holder";
  const initials = `${accountUser?.firstName?.[0] ?? ""}${accountUser?.lastName?.[0] ?? ""}` || "CX";
  const recentTransactions = transactions.length > 5 && transactions.some((item) => item.direction === "debit") && !transactions.slice(0, 5).some((item) => item.direction === "debit")
    ? [...transactions.slice(0, 4), transactions.find((item) => item.direction === "debit")!]
    : transactions.slice(0, 5);

  const copyAccountNumber = async (accountId: string, accountNumber: string) => {
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
    <div className="space-y-4 sm:space-y-5">
      <header className="flex items-center justify-between gap-4 px-0.5">
        <div>
          <p className="text-xs font-medium text-primary">Overview</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-[-0.035em] sm:text-3xl">Welcome, {accountUser?.firstName ?? "there"}</h1>
        </div>
          </header>

      <section className="grid gap-4 lg:grid-cols-2" aria-label="Balance summary">
        <article className="rounded-2xl border bg-card p-5 shadow-[0_14px_40px_hsl(248_20%_12%/.045)] sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground">My balance</p>
              <p className="mt-2 truncate font-mono text-3xl font-semibold tracking-[-0.045em] tabular-nums sm:text-4xl">
                {balancesVisible ? formatCurrency(overview.totalBalance) : "••••••"}
              </p>
            <div className="mt-2 flex items-center gap-2"><p className="truncate text-xs text-muted-foreground">{fullName}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-xl bg-accent text-primary">
                <WalletCards className="size-5" strokeWidth={1.8} />
              </div>
              
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button asChild size="sm" className="min-w-28"><Link to="/transfer"><ArrowLeftRight />Transfer</Link></Button>
            <Button asChild size="sm" variant="secondary" className="min-w-28"><Link to="/cards"><CreditCard />My cards</Link></Button>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-5">
            <div className="rounded-xl bg-muted/70 p-3.5">
              <p className="text-[11px] text-muted-foreground">Income this month</p>
              <p className="mt-1.5 truncate font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">+{balancesVisible ? formatCurrency(overview.monthlyIncome) : "••••"}</p>
            </div>
            <div className="rounded-xl bg-muted/70 p-3.5">
              <p className="text-[11px] text-muted-foreground">Spent this month</p>
              <p className="mt-1.5 truncate font-mono text-sm font-semibold tabular-nums">{balancesVisible ? formatCurrency(overview.monthlySpending) : "••••"}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border bg-card p-5 shadow-[0_14px_40px_hsl(248_20%_12%/.045)] sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold tracking-tight">Account overview</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your available accounts</p>
            </div>
            <Link to="/accounts" className="text-xs font-semibold text-primary hover:underline">See all</Link>
          </div>

          <div className="mt-5 divide-y">
            {overview.accounts.length === 0 && <EmptyState title="No accounts yet" description="Opened accounts will appear here." />}
            {overview.accounts.slice(0, 3).map((account) => (
              <div key={account.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 first:pt-0 last:pb-0">
                <div className="grid size-9 place-items-center rounded-xl bg-accent text-primary"><WalletCards className="size-4" strokeWidth={1.8} /></div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{account.name}</p>
                  {account.accountNumber ? (
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="truncate font-mono text-[11px] tracking-[0.07em] text-muted-foreground tabular-nums">{formatAccountNumber(account.accountNumber, account.maskedNumber)}</span>
                      <button type="button" onClick={() => copyAccountNumber(account.id, account.accountNumber!)} className="grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Copy full account number for ${account.name}`}>
                        {copiedAccountId === account.id ? <Check className="size-3 text-primary" /> : <Copy className="size-3" />}
                      </button>
                    </div>
                  ) : <p className="mt-0.5 text-[11px] text-muted-foreground">Number pending</p>}
                </div>
                <p className="max-w-28 truncate font-mono text-xs font-semibold tabular-nums sm:text-sm">{balancesVisible ? formatCurrency(account.balance) : "••••"}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="min-w-0 rounded-2xl border bg-card p-5 shadow-[0_14px_40px_hsl(248_20%_12%/.045)] sm:p-6">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-semibold tracking-tight">Recent transactions</h2>
              <p className="mt-1 text-xs text-muted-foreground">Your latest account activity</p>
            </div>
            <Button asChild variant="ghost" size="sm"><Link to="/activity">See all<MoveUpRight className="size-3.5" /></Link></Button>
          </div>
          <TransactionList transactions={recentTransactions} compact />
        </article>

        <aside className="rounded-2xl border bg-card p-5 shadow-[0_14px_40px_hsl(248_20%_12%/.045)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold tracking-tight">My cards</h2>
              <p className="mt-1 text-xs text-muted-foreground">Payment cards</p>
            </div>
            <Link to="/cards" className="text-xs font-semibold text-primary hover:underline">See all</Link>
          </div>

          <div className="mt-5 space-y-3">
            {cards.length === 0 && <EmptyState title="No cards yet" description="New cards will appear here." />}
            {cards.slice(0, 3).map((card) => (
              <Link key={card.id} to="/cards" className="group block overflow-hidden rounded-xl border bg-gradient-to-br from-accent via-card to-secondary/50 p-4 transition-transform hover:-translate-y-0.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary"><CreditCard className="size-4" /></div>
                  <img src={card.network === "Mastercard" ? "/icons/mastercard.svg?v=2" : "/icons/visa.svg"} alt={card.network} className="size-10 object-contain" />
                </div>
                <p className="mt-6 font-mono text-sm tracking-[0.1em] tabular-nums">**** **** **** {card.lastFour}</p>
                <div className="mt-3 flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium">{card.holderName}</p>
                    <p className="mt-0.5 text-[10px] capitalize text-muted-foreground">{card.type} card</p>
                  </div>
                  <span className={`size-2 rounded-full ${card.status === "active" ? "bg-emerald-500" : "bg-amber-500"}`} aria-label={card.status} />
                </div>
              </Link>
            ))}
            {cards.length === 0 && <Button asChild variant="secondary" size="sm" className="w-full"><Link to="/cards"><Plus />View card options</Link></Button>}
          </div>
        </aside>
      </section>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl bg-muted/60 p-5 text-center"><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>;
}

function DashboardSkeleton() {
  return <div className="animate-pulse space-y-5"><div className="space-y-2"><div className="h-3 w-20 rounded bg-muted"/><div className="h-9 w-56 rounded bg-muted"/></div><div className="grid gap-4 lg:grid-cols-2"><div className="h-72 rounded-2xl bg-card"/><div className="h-72 rounded-2xl bg-card"/></div><div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]"><div className="h-96 rounded-2xl bg-card"/><div className="h-96 rounded-2xl bg-card"/></div></div>;
}
