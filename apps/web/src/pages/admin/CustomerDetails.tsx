import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, CreditCard, Mail, UserRound, WalletCards } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { AdminCustomer, AdminCustomerDetails, UpdateAdminUser } from "@clipx/contracts/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/banking";
import { queryClient } from "@/lib/queryClient";

export default function CustomerDetails() {
  const { userId = "" } = useParams();
  const { toast } = useToast();
  const { data, isLoading, error } = useQuery<AdminCustomerDetails>({ queryKey: [`/api/admin/users/${userId}`], enabled: Boolean(userId) });
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!data) return;
    setEmail(data.customer.email);
    setFirstName(data.customer.firstName);
    setLastName(data.customer.lastName);
    setIsActive(data.customer.isActive);
    setIsAdmin(data.customer.isAdmin);
  }, [data]);

  const save = useMutation({
    mutationFn: (update: UpdateAdminUser) => apiRequest(`/api/admin/users/${userId}`, "PATCH", update) as Promise<AdminCustomer>,
    onSuccess: (customer) => {
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`], (current) => current ? { ...current, customer } : current);
      queryClient.setQueryData<AdminCustomer[]>(["/api/admin/users"], (current = []) => current.map((item) => item.id === customer.id ? customer : item));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Account details saved", description: `${customer.firstName || customer.email} was updated.` });
    },
    onError: (saveError: Error) => toast({ title: "Account update failed", description: saveError.message, variant: "destructive" }),
  });

  if (isLoading) return <CustomerDetailsSkeleton />;
  if (error || !data) return <div className="rounded-2xl bg-muted/55 p-10 text-center"><h1 className="text-xl font-semibold">Customer not found</h1><p className="mt-2 text-sm text-muted-foreground">This account may have been removed.</p><Button asChild variant="outline" className="mt-6"><Link to="/admin/users"><ArrowLeft className="mr-2 size-4"/>Back to customers</Link></Button></div>;

  const { customer, accounts, cards, transactions, preferences } = data;

  return (
    <div className="space-y-8">
      <header>
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4"/>Back to customers</Link>
        <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4"><div className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-base font-semibold text-primary">{customer.initials}</div><div><p className="text-sm text-muted-foreground">Customer record</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{customer.firstName} {customer.lastName}</h1><p className="mt-1 text-sm text-muted-foreground">{customer.email}</p></div></div>
          <span className={`w-fit rounded-md px-2.5 py-1.5 text-xs font-medium ${customer.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{customer.isActive ? "Active account" : "Suspended account"}</span>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Customer summary">
        <Summary icon={WalletCards} label="Total balance" value={formatCurrency(customer.balance)} />
        <Summary icon={WalletCards} label="Accounts" value={accounts.length.toLocaleString()} />
        <Summary icon={CreditCard} label="Cards" value={cards.length.toLocaleString()} />
        <Summary icon={CalendarDays} label="Joined" value={new Date(customer.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <section className="rounded-2xl border bg-card p-5 sm:p-7">
          <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5"/></div><div><h2 className="font-semibold">Identity and contact</h2><p className="mt-1 text-sm text-muted-foreground">Edit the information attached to this local account.</p></div></div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            <div><Label htmlFor="customerFirstName">First name</Label><Input id="customerFirstName" className="mt-2" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div>
            <div><Label htmlFor="customerLastName">Last name</Label><Input id="customerLastName" className="mt-2" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label htmlFor="customerEmail">Email address</Label><div className="relative mt-2"><Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input id="customerEmail" type="email" className="pl-9" value={email} onChange={(event) => setEmail(event.target.value)} /></div></div>
          </div>

          <div className="mt-8 border-t pt-7"><h3 className="text-sm font-semibold">Access controls</h3><div className="mt-4 divide-y rounded-xl bg-muted/45 px-4"><ControlRow title="Account active" description="Allow this customer to access the account." checked={isActive} onCheckedChange={setIsActive}/><ControlRow title="Administrator access" description="Allow access to customer and transaction operations." checked={isAdmin} onCheckedChange={setIsAdmin}/></div></div>
          <div className="mt-7 flex flex-wrap items-center gap-3"><Button disabled={!email.trim() || !firstName.trim() || save.isPending} onClick={() => save.mutate({ email, firstName, lastName, isActive, isAdmin })}>{save.isPending ? "Saving…" : "Save account details"}</Button><p className="text-xs text-muted-foreground">Changes are saved securely to the customer record.</p></div>
        </section>

        <aside className="space-y-6">
          <section className="rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] sm:p-7"><p className="text-sm text-white/55">Account configuration</p><dl className="mt-7 space-y-4 text-sm"><DetailRow label="Transaction alerts" value={preferences.transactionAlerts ? "Enabled" : "Disabled"}/><DetailRow label="Monthly summary" value={preferences.monthlySummary ? "Enabled" : "Disabled"}/><DetailRow label="Balance visibility" value={preferences.showBalances ? "Visible" : "Hidden"}/><DetailRow label="Last active" value={new Date(customer.lastActiveAt).toLocaleString()}/></dl></section>
          <section className="rounded-2xl border bg-card p-6"><h2 className="font-semibold">Bank accounts</h2><div className="mt-5 space-y-3">{accounts.length === 0 ? <p className="rounded-xl bg-muted/55 p-5 text-sm text-muted-foreground">No bank accounts have been opened.</p> : accounts.map((account) => <div key={account.id} className="rounded-xl bg-muted/45 p-4"><div className="flex justify-between gap-4"><div><p className="text-sm font-semibold">{account.name}</p><p className="mt-1 text-xs text-muted-foreground">Ending in {account.maskedNumber}</p></div><p className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(account.balance)}</p></div></div>)}</div></section>
        </aside>
      </div>

      <section className="rounded-2xl border bg-card p-5 sm:p-6"><div className="mb-6"><h2 className="text-lg font-semibold">Recent activity</h2><p className="mt-1 text-sm text-muted-foreground">Transactions belonging to this customer</p></div><TransactionList transactions={transactions.slice(0, 8)} /></section>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return <article className="rounded-2xl bg-muted/55 p-5"><div className="flex items-center justify-between"><p className="text-sm text-muted-foreground">{label}</p><Icon className="size-[18px] text-primary" strokeWidth={1.8}/></div><p className="mt-5 font-mono text-2xl font-semibold tracking-[-0.03em] tabular-nums">{value}</p></article>;
}

function ControlRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-5 py-4"><div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title}/></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-5 border-b border-white/10 pb-4 last:border-0 last:pb-0"><dt className="text-white/55">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}

function CustomerDetailsSkeleton() {
  return <div className="animate-pulse space-y-8"><div className="h-4 w-36 rounded bg-muted"/><div className="flex gap-4"><div className="size-14 rounded-2xl bg-muted"/><div className="space-y-3"><div className="h-8 w-64 rounded bg-muted"/><div className="h-4 w-44 rounded bg-muted"/></div></div><div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]"><div className="h-96 rounded-2xl bg-muted"/><div className="h-72 rounded-2xl bg-muted"/></div></div>;
}
