import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Landmark, UserPlus } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import type { AdminCustomer, CreateAdminCustomer } from "@clipx/contracts/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function CreateCustomer() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [createAccount, setCreateAccount] = useState(true);
  const [accountName, setAccountName] = useState("Everyday checking");
  const [accountType, setAccountType] = useState<"checking" | "savings">("checking");
  const [maskedNumber, setMaskedNumber] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0.00");

  const create = useMutation({
    mutationFn: (input: CreateAdminCustomer) => apiRequest("/api/admin/users", "POST", input) as Promise<AdminCustomer>,
    onSuccess: (customer) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Customer created", description: `${customer.firstName}'s local account is ready.` });
      navigate(`/admin/users/${customer.id}`, { replace: true });
    },
    onError: (error: Error) => toast({ title: "Customer creation failed", description: error.message, variant: "destructive" }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    create.mutate({
      email,
      firstName,
      lastName,
      password,
      isActive,
      isAdmin,
      ...(createAccount ? { account: { name: accountName, type: accountType, maskedNumber, openingBalance: Number(openingBalance) } } : {}),
    });
  };

  const accountIsValid = !createAccount || (accountName.trim().length > 0 && /^\d{4}$/.test(maskedNumber) && Number.isFinite(Number(openingBalance)) && Number(openingBalance) >= 0);
  const passwordIsValid = password.length >= 8 && password === confirmPassword;

  return (
    <div className="space-y-8">
      <header>
        <Link to="/admin/users" className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"><ArrowLeft className="size-4"/>Back to customers</Link>
        <p className="mt-6 text-sm text-muted-foreground">Customer onboarding</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Add a customer</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Create the user record and, when needed, open their first bank account in the same database transaction.</p>
      </header>

      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserPlus className="size-5"/></div><div><h2 className="font-semibold">Customer identity</h2><p className="mt-1 text-sm text-muted-foreground">Core information used throughout ClipX.</p></div></div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div><Label htmlFor="newFirstName">First name</Label><Input id="newFirstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} className="mt-2" autoComplete="off" required /></div>
              <div><Label htmlFor="newLastName">Last name <span className="text-muted-foreground">(optional)</span></Label><Input id="newLastName" value={lastName} onChange={(event) => setLastName(event.target.value)} className="mt-2" autoComplete="off" /></div>
              <div className="sm:col-span-2"><Label htmlFor="newEmail">Email address</Label><Input id="newEmail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2" autoComplete="off" required /></div>
              <div><Label htmlFor="newPassword">Account password</Label><Input id="newPassword" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2" autoComplete="new-password" minLength={8} error={password.length > 0 && password.length < 8 ? "Use at least 8 characters" : undefined} required /></div>
              <div><Label htmlFor="confirmNewPassword">Confirm password</Label><Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-2" autoComplete="new-password" minLength={8} error={confirmPassword.length > 0 && password !== confirmPassword ? "Passwords do not match" : undefined} required /></div>
              <p className="text-xs leading-relaxed text-muted-foreground sm:col-span-2">The password is converted to a salted hash before it is stored. Administrators cannot view it afterward.</p>
            </div>
            <div className="mt-7 divide-y rounded-xl bg-muted/45 px-4"><ToggleRow title="Account active" description="Allow this customer to sign in immediately." checked={isActive} onCheckedChange={setIsActive}/><ToggleRow title="Administrator access" description="Grant access to operations and customer management." checked={isAdmin} onCheckedChange={setIsAdmin}/></div>
          </section>

          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex items-start gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Landmark className="size-5"/></div><div className="flex-1"><h2 className="font-semibold">Opening account</h2><p className="mt-1 text-sm text-muted-foreground">Optionally create the first balance for this customer.</p></div><Switch checked={createAccount} onCheckedChange={setCreateAccount} aria-label="Create an opening account"/></div>
            {createAccount && <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label htmlFor="newAccountName">Account name</Label><Input id="newAccountName" value={accountName} onChange={(event) => setAccountName(event.target.value)} className="mt-2" required /></div>
              <div><Label htmlFor="newAccountType">Account type</Label><select id="newAccountType" value={accountType} onChange={(event) => setAccountType(event.target.value as "checking" | "savings")} className="mt-2 flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"><option value="checking">Checking</option><option value="savings">Savings</option></select></div>
              <div><Label htmlFor="newMaskedNumber">Final four digits</Label><Input id="newMaskedNumber" inputMode="numeric" maxLength={4} pattern="\d{4}" value={maskedNumber} onChange={(event) => setMaskedNumber(event.target.value.replace(/\D/g, "").slice(0, 4))} className="mt-2 font-mono" placeholder="0000" required /></div>
              <div className="sm:col-span-2"><Label htmlFor="newOpeningBalance">Opening balance</Label><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">$</span><Input id="newOpeningBalance" inputMode="decimal" value={openingBalance} onChange={(event) => setOpeningBalance(event.target.value)} className="pl-8 font-mono" required /></div></div>
            </div>}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="sticky top-28 rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] sm:p-7"><p className="text-sm text-white/55">Review</p><h2 className="mt-2 text-xl font-semibold">Create customer record</h2><dl className="mt-7 space-y-4 border-t border-white/12 pt-5 text-sm"><ReviewRow label="Customer" value={`${firstName || "Not entered"} ${lastName}`.trim()}/><ReviewRow label="Email" value={email || "Not entered"}/><ReviewRow label="Password" value={passwordIsValid ? "Ready" : "Required"}/><ReviewRow label="Access" value={isActive ? "Active" : "Suspended"}/><ReviewRow label="Role" value={isAdmin ? "Administrator" : "Customer"}/><ReviewRow label="Opening account" value={createAccount ? accountName || "Not entered" : "None"}/></dl><Button type="submit" variant="secondary" className="mt-7 w-full" disabled={!firstName.trim() || !email.trim() || !passwordIsValid || !accountIsValid || create.isPending}>{create.isPending ? "Creating…" : "Create customer"}</Button><p className="mt-3 text-xs leading-relaxed text-white/45">The user, credential, preferences, and optional account are saved together.</p></section>
        </aside>
      </form>
    </div>
  );
}

function ToggleRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-5 py-4"><div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title}/></div>;
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-5"><dt className="text-white/55">{label}</dt><dd className="max-w-[12rem] truncate text-right font-medium">{value}</dd></div>;
}
