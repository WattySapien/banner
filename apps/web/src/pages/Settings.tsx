import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Database, Eye, LockKeyhole, UserRound } from "lucide-react";
import type { AccountSettings, ChangePassword, UpdatePreferences, UpdateProfile } from "@clipx/contracts/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function Settings() {
  const { toast } = useToast();
  const { data: settings, isLoading } = useQuery<AccountSettings>({ queryKey: ["/api/settings"] });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");

  useEffect(() => {
    if (!settings) return;
    setFirstName(settings.profile.firstName);
    setLastName(settings.profile.lastName);
    setTransactionAlerts(settings.preferences.transactionAlerts);
    setMonthlySummary(settings.preferences.monthlySummary);
    setShowBalances(settings.preferences.showBalances);
  }, [settings]);

  const profileMutation = useMutation({
    mutationFn: (update: UpdateProfile) => apiRequest("/api/settings/profile", "PATCH", update) as Promise<AccountSettings>,
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/settings"], updated);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cards"] });
      toast({ title: "Profile saved", description: "Your account name was updated." });
    },
    onError: (error: Error) => toast({ title: "Profile update failed", description: error.message, variant: "destructive" }),
  });

  const preferencesMutation = useMutation({
    mutationFn: (update: UpdatePreferences) => apiRequest("/api/settings/preferences", "PATCH", update) as Promise<AccountSettings>,
    onSuccess: (updated) => {
      queryClient.setQueryData(["/api/settings"], updated);
      toast({ title: "Preferences saved", description: "Your account preferences were updated." });
    },
    onError: (error: Error) => toast({ title: "Preference update failed", description: error.message, variant: "destructive" }),
  });

  const savePreferences = () => preferencesMutation.mutate({ transactionAlerts, monthlySummary, showBalances });
  const passwordMutation=useMutation({mutationFn:(update:ChangePassword)=>apiRequest("/api/settings/password","PATCH",update),onSuccess:()=>{setCurrentPassword("");setNewPassword("");setConfirmPassword("");toast({title:"Password changed",description:"Your other sessions were signed out."});},onError:(error:Error)=>toast({title:"Password change failed",description:error.message,variant:"destructive"})});

  if (isLoading || !settings) return <div className="h-96 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-8">
      <header><p className="text-sm text-muted-foreground">Account preferences</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Settings</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Manage your profile, privacy, and account notifications.</p></header>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></div><div><h2 className="font-semibold">Personal details</h2><p className="mt-1 text-sm text-muted-foreground">The name shown across your ClipX account.</p></div></div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2"><div><Label htmlFor="firstName">First name</Label><Input id="firstName" className="mt-2" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div><div><Label htmlFor="lastName">Last name</Label><Input id="lastName" className="mt-2" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="email">Email address</Label><Input id="email" className="mt-2" value={settings.profile.email} disabled /><p className="mt-2 text-xs text-muted-foreground">Contact support to change the email tied to your account.</p></div></div>
            <Button className="mt-6" disabled={!firstName.trim() || !lastName.trim() || profileMutation.isPending} onClick={() => profileMutation.mutate({ firstName, lastName })}>{profileMutation.isPending ? "Saving…" : "Save profile"}</Button>
          </section>

          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="size-5" /></div><div><h2 className="font-semibold">Notifications</h2><p className="mt-1 text-sm text-muted-foreground">Choose which account updates reach you.</p></div></div>
            <div className="mt-6 divide-y"><SettingRow title="Transaction alerts" description="Get an email when money enters or leaves your account." checked={transactionAlerts} onCheckedChange={setTransactionAlerts} /><SettingRow title="Monthly summary" description="Receive a monthly overview of income and spending." checked={monthlySummary} onCheckedChange={setMonthlySummary} /></div>
            <Button className="mt-6" onClick={savePreferences} disabled={preferencesMutation.isPending}>{preferencesMutation.isPending ? "Saving…" : "Save preferences"}</Button>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5] sm:p-7"><LockKeyhole className="size-5 text-white/70" /><h2 className="mt-8 font-semibold">Security</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Use a unique password with at least 12 characters.</p><div className="mt-5 space-y-3"><PasswordInput id="currentPassword" aria-label="Current password" autoComplete="current-password" placeholder="Current password" visibilityLabel="current password" value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)} /><PasswordInput id="newPassword" aria-label="New password" autoComplete="new-password" placeholder="New password" visibilityLabel="new password" value={newPassword} onChange={(event)=>setNewPassword(event.target.value)} /><PasswordInput id="confirmNewPassword" aria-label="Confirm new password" autoComplete="new-password" placeholder="Confirm new password" visibilityLabel="new password confirmation" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} /></div><Button variant="secondary" className="mt-5 w-full" disabled={currentPassword.length<8||newPassword.length<12||newPassword!==confirmPassword||passwordMutation.isPending} onClick={()=>passwordMutation.mutate({currentPassword,newPassword})}>{passwordMutation.isPending?"Changing…":"Change password"}</Button></section>
          <section className="rounded-2xl border bg-card p-6"><div className="flex gap-3"><Eye className="mt-0.5 size-5 text-primary" /><div className="flex-1"><h2 className="font-semibold">Balance visibility</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Show balances when you open the dashboard.</p></div><Switch checked={showBalances} onCheckedChange={setShowBalances} aria-label="Show account balances" /></div><Button variant="outline" size="sm" className="mt-5 w-full" onClick={savePreferences} disabled={preferencesMutation.isPending}>Save visibility</Button></section>
          <section className="rounded-2xl bg-muted/55 p-6"><div className="flex gap-3"><Database className="mt-0.5 size-5 text-primary"/><div><h2 className="font-semibold">Protected account data</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Account data is persisted in the managed PostgreSQL database.</p></div></div></section>
        </aside>
      </div>
    </div>
  );
}

function SettingRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center gap-5 py-5 first:pt-0 last:pb-0"><div className="flex-1"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title} /></div>;
}
