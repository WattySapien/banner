import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Camera, Database, Eye, Laptop, LoaderCircle, LockKeyhole, Moon, Palette, Sun, UserRound } from "lucide-react";
import type { AccountSettings, ChangePassword, UpdatePreferences, UpdateProfile } from "@clipx/contracts/settings";
import type { User } from "@clipx/contracts/schema";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, uploadAvatar } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { type ThemePreference, useTheme } from "@/contexts/ThemeContext";

export default function Account() {
  const { toast } = useToast();
  const { preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { data: settings, isLoading } = useQuery<AccountSettings>({ queryKey: ["/api/settings"] });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [monthlySummary, setMonthlySummary] = useState(true);
  const [showBalances, setShowBalances] = useState(true);
  const [currentPassword,setCurrentPassword]=useState("");
  const [newPassword,setNewPassword]=useState("");
  const [confirmPassword,setConfirmPassword]=useState("");
  const avatarInput=useRef<HTMLInputElement>(null);

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
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      toast({ title: "Profile saved", description: "Your account name was updated." });
    },
    onError: (error: Error) => toast({ title: "Profile update failed", description: error.message, variant: "destructive" }),
  });

  const avatarMutation=useMutation({
    mutationFn:(file:File)=>uploadAvatar(file) as Promise<User>,
    onSuccess:(user)=>{
      queryClient.setQueryData<User>(["/api/auth/user"],user);
      queryClient.setQueryData<AccountSettings>(["/api/settings"],(current)=>current?{...current,profile:{...current.profile,profileImageUrl:user.profileImageUrl}}:current);
      queryClient.invalidateQueries({queryKey:["/api/admin/users"]});
      toast({title:"Profile image updated",description:"Your new image now appears across your account."});
    },
    onError:(error:Error)=>toast({title:"Image upload failed",description:error.message,variant:"destructive"}),
  });

  const chooseAvatar=(file?:File)=>{
    if(!file)return;
    if(!["image/jpeg","image/png","image/webp"].includes(file.type)){toast({title:"Unsupported image",description:"Choose a JPEG, PNG, or WebP file.",variant:"destructive"});return;}
    if(file.size>2*1024*1024){toast({title:"Image is too large",description:"Choose an image smaller than 2 MB.",variant:"destructive"});return;}
    avatarMutation.mutate(file);
  };

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
    <div className="space-y-6 sm:space-y-8">
      <header><p className="text-sm text-muted-foreground">Profile and preferences</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Account</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Manage your identity, security, privacy, and notification preferences.</p></header>
      <section aria-labelledby="account-settings-heading" className="space-y-5">
        <div><p className="text-xs font-medium tracking-[0.08em] text-primary">Manage your account</p><h2 id="account-settings-heading" className="mt-1 text-xl font-semibold tracking-[-0.025em] sm:text-2xl">Account settings</h2><p className="mt-1 max-w-xl text-sm text-muted-foreground">Update how your account looks, works, and keeps you informed.</p></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.72fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><UserRound className="size-5" /></div><div><h2 className="font-semibold">Personal details</h2></div></div>
            <div className="mt-7 flex flex-col gap-4 rounded-xl bg-muted/45 p-4 sm:flex-row sm:items-center">
              <ProfileAvatar src={settings.profile.profileImageUrl} initials={`${settings.profile.firstName[0]??""}${settings.profile.lastName[0]??""}`||"CX"} alt={`${settings.profile.firstName} ${settings.profile.lastName} profile`} className="size-16"/>
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">Profile image</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">JPEG, PNG, or WebP. Maximum file size 2 MB.</p></div>
              <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event)=>{chooseAvatar(event.target.files?.[0]);event.currentTarget.value="";}} aria-label="Choose profile image"/>
              <Button className="w-full sm:w-auto" type="button" variant="outline" size="sm" disabled={avatarMutation.isPending} onClick={()=>avatarInput.current?.click()}>{avatarMutation.isPending?<LoaderCircle className="mr-2 size-4 animate-spin"/>:<Camera className="mr-2 size-4"/>}{avatarMutation.isPending?"Uploading…":settings.profile.profileImageUrl?"Replace image":"Upload image"}</Button>
            </div>
            <div className="mt-7 grid gap-5 sm:grid-cols-2"><div><Label htmlFor="firstName">First name</Label><Input id="firstName" className="mt-2" value={firstName} onChange={(event) => setFirstName(event.target.value)} /></div><div><Label htmlFor="lastName">Last name</Label><Input id="lastName" className="mt-2" value={lastName} onChange={(event) => setLastName(event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="email">Email address</Label><Input id="email" className="mt-2" value={settings.profile.email} disabled /><p className="mt-2 text-xs text-muted-foreground">Contact support to change the email tied to your account.</p></div></div>
            <Button className="mt-6 w-full sm:w-auto" disabled={!firstName.trim() || !lastName.trim() || profileMutation.isPending} onClick={() => profileMutation.mutate({ firstName, lastName })}>{profileMutation.isPending ? "Saving…" : "Save profile"}</Button>
          </section>

          <section className="rounded-2xl border bg-card p-5 sm:p-7">
            <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Bell className="size-5" /></div><div><h2 className="font-semibold">Notifications</h2><p className="mt-1 text-sm text-muted-foreground">Choose which account updates reach you.</p></div></div>
            <div className="mt-6 divide-y"><SettingRow title="Transaction alerts" description="Get an email when money enters or leaves your account." checked={transactionAlerts} onCheckedChange={setTransactionAlerts} /><SettingRow title="Monthly summary" description="Receive a monthly overview of income and spending." checked={monthlySummary} onCheckedChange={setMonthlySummary} /></div>
            <Button className="mt-6 w-full sm:w-auto" onClick={savePreferences} disabled={preferencesMutation.isPending}>{preferencesMutation.isPending ? "Saving…" : "Save preferences"}</Button>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border bg-card p-6">
            <div className="flex gap-3"><Palette className="mt-0.5 size-5 text-primary" /><div><h2 className="font-semibold">Appearance</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Choose a light or dark canvas, or follow your device.</p></div></div>
            <div className="mt-5 grid grid-cols-3 gap-2" aria-label="Choose appearance">
              {([
                { value: "light", label: "Light", icon: Sun },
                { value: "dark", label: "Dark", icon: Moon },
                { value: "system", label: "Device", icon: Laptop },
              ] as const).map(({ value, label, icon: Icon }) => <Button key={value} type="button" variant={themePreference === value ? "default" : "outline"} className="h-auto flex-col gap-1.5 px-2 py-3 text-xs" onClick={() => setThemePreference(value as ThemePreference)} aria-pressed={themePreference === value}><Icon className="size-4" />{label}</Button>)}
            </div>
          </section>
          <section className="rounded-2xl bg-[#211a3a] p-6 text-white shadow-[0_18px_48px_hsl(258_60%_32%/.16)] sm:p-7"><LockKeyhole className="size-5 text-white/70" /><h2 className="mt-8 font-semibold">Security</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Use a unique password with at least 12 characters.</p><div className="mt-5 space-y-3"><PasswordInput id="currentPassword" aria-label="Current password" autoComplete="current-password" placeholder="Current password" visibilityLabel="current password" value={currentPassword} onChange={(event)=>setCurrentPassword(event.target.value)} /><PasswordInput id="newPassword" aria-label="New password" autoComplete="new-password" placeholder="New password" visibilityLabel="new password" value={newPassword} onChange={(event)=>setNewPassword(event.target.value)} /><PasswordInput id="confirmNewPassword" aria-label="Confirm new password" autoComplete="new-password" placeholder="Confirm new password" visibilityLabel="new password confirmation" value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} /></div><Button variant="secondary" className="mt-5 w-full" disabled={currentPassword.length<8||newPassword.length<12||newPassword!==confirmPassword||passwordMutation.isPending} onClick={()=>passwordMutation.mutate({currentPassword,newPassword})}>{passwordMutation.isPending?"Changing…":"Change password"}</Button></section>
          <section className="rounded-2xl border bg-card p-6"><div className="flex gap-3"><Eye className="mt-0.5 size-5 text-primary" /><div className="flex-1"><h2 className="font-semibold">Balance visibility</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Show balances when you open the dashboard.</p></div><Switch checked={showBalances} onCheckedChange={setShowBalances} aria-label="Show account balances" /></div><Button variant="outline" size="sm" className="mt-5 w-full" onClick={savePreferences} disabled={preferencesMutation.isPending}>Save visibility</Button></section>
          <section className="rounded-2xl bg-muted/55 p-6"><div className="flex gap-3"><Database className="mt-0.5 size-5 text-primary"/><div><h2 className="font-semibold">Protected account data</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Account data is persisted in the managed PostgreSQL database.</p></div></div></section>
        </aside>
      </div>
      </section>
    </div>
  );
}

function SettingRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return <div className="flex items-center gap-3 py-5 first:pt-0 last:pb-0 sm:gap-5"><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{description}</p></div><Switch className="shrink-0" checked={checked} onCheckedChange={onCheckedChange} aria-label={title} /></div>;
}
