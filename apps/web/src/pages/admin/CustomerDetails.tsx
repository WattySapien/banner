import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Ban, CalendarDays, Camera, Check, Copy, CreditCard, Hash, LoaderCircle, Mail, MessageCircle, PencilLine, Plus, Trash2, UserRound, WalletCards, X } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { AdminCustomer, AdminCustomerDetails, CreateAdminAccount, CreateAdminCard, UpdateAdminAccount, UpdateAdminUser } from "@clipx/contracts/admin";
import type { Account, BankCard } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TransactionList } from "@/components/TransactionList";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, uploadAdminAvatar } from "@/lib/api";
import { formatAccountNumber, formatCurrency } from "@/lib/banking";
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
  const avatarInput = useRef<HTMLInputElement>(null);
  const [avatarProgress, setAvatarProgress] = useState(0);

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
      const holderName=`${customer.firstName} ${customer.lastName}`.trim();
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`], (current) => current ? { ...current, customer, accounts:current.accounts.map((account)=>({...account,name:holderName})) } : current);
      queryClient.setQueryData<AdminCustomer[]>(["/api/admin/users"], (current = []) => current.map((item) => item.id === customer.id ? customer : item));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Account details saved", description: `${customer.firstName || customer.email} was updated.` });
    },
    onError: (saveError: Error) => toast({ title: "Account update failed", description: saveError.message, variant: "destructive" }),
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => uploadAdminAvatar(userId, file, setAvatarProgress) as Promise<AdminCustomer>,
    onSuccess: (customer) => {
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`], (current) => current ? { ...current, customer } : current);
      queryClient.setQueryData<AdminCustomer[]>(["/api/admin/users"], (current = []) => current.map((item) => item.id === customer.id ? customer : item));
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      setAvatarProgress(0);
      toast({ title: "Profile image updated", description: `${customer.firstName || customer.email}'s image now appears across their account.` });
    },
    onError: (uploadError: Error) => { setAvatarProgress(0); toast({ title: "Image upload failed", description: uploadError.message, variant: "destructive" }); },
  });

  const chooseAvatar = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Unsupported image", description: "Choose a JPEG, PNG, or WebP file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Image is too large", description: "Choose an image smaller than 2 MB.", variant: "destructive" });
      return;
    }
    avatarMutation.mutate(file);
  };

  if (isLoading) return <CustomerDetailsSkeleton />;
  if (error || !data) return <div className="rounded-2xl bg-muted/55 p-10 text-center"><h1 className="text-xl font-semibold">Customer not found</h1><p className="mt-2 text-sm text-muted-foreground">This account may have been removed.</p><Button asChild variant="outline" className="mt-6"><Link to="/admin/users"><ArrowLeft className="mr-2 size-4"/>Back to customers</Link></Button></div>;

  const { customer, accounts, cards, transactions, preferences } = data;

  return (
    <div className="space-y-6 sm:space-y-8">
      <header>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-center gap-4"><ProfileAvatar src={customer.profileImageUrl} userId={customer.id} initials={customer.initials} alt={`${customer.firstName} ${customer.lastName} profile`} className="size-14 rounded-2xl"/><div><p className="text-sm text-muted-foreground">Customer record</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{customer.firstName} {customer.lastName}</h1><p className="mt-1 text-sm text-muted-foreground">{customer.email}</p></div></div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => { chooseAvatar(event.target.files?.[0]); event.currentTarget.value = ""; }} aria-label={`Choose profile image for ${customer.firstName} ${customer.lastName}`} />
            <Button type="button" variant="outline" size="sm" className="flex-1 sm:flex-none" disabled={avatarMutation.isPending} onClick={() => avatarInput.current?.click()}>{avatarMutation.isPending ? <LoaderCircle className="mr-2 size-4 animate-spin" /> : <Camera className="mr-2 size-4" />}{avatarMutation.isPending ? `Uploading ${avatarProgress}%` : customer.profileImageUrl ? "Replace photo" : "Upload photo"}</Button>
            <Button asChild variant="outline" size="sm" className="flex-1 sm:flex-none"><Link to={`/admin/users/${userId}/communications`}><MessageCircle className="mr-2 size-4"/>Communications</Link></Button>
            <span className={`w-fit rounded-md px-2.5 py-1.5 text-xs font-medium ${customer.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{customer.isActive ? "Active account" : "Suspended account"}</span>
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4" aria-label="Customer summary">
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
          <section className="rounded-2xl bg-[#211a3a] p-6 text-white shadow-[0_18px_48px_hsl(258_60%_32%/.16)] sm:p-7"><p className="text-sm text-white/55">Account configuration</p><dl className="mt-7 space-y-4 text-sm"><DetailRow label="Transaction alerts" value={preferences.transactionAlerts ? "Enabled" : "Disabled"}/><DetailRow label="Monthly summary" value={preferences.monthlySummary ? "Enabled" : "Disabled"}/><DetailRow label="Balance visibility" value={preferences.showBalances ? "Visible" : "Hidden"}/><DetailRow label="Last active" value={new Date(customer.lastActiveAt).toLocaleString()}/></dl></section>
          <AccountManager userId={userId} accounts={accounts} holderName={`${customer.firstName} ${customer.lastName}`.trim()}/>
          <CardManager userId={userId} accounts={accounts} cards={cards}/>
        </aside>
      </div>

      <section className="rounded-2xl border bg-card p-5 sm:p-6"><div className="mb-6"><h2 className="text-lg font-semibold">Recent activity</h2><p className="mt-1 text-sm text-muted-foreground">Transactions belonging to this customer</p></div><TransactionList transactions={transactions.slice(0, 8)} detailsBasePath="/admin/transactions" /></section>
    </div>
  );
}

function Summary({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return <article className="min-w-0 rounded-2xl bg-muted/55 p-4 sm:p-5"><div className="flex items-start justify-between gap-2"><p className="text-xs text-muted-foreground sm:text-sm">{label}</p><Icon className="size-4 shrink-0 text-primary sm:size-[18px]" strokeWidth={1.8}/></div><p className="mt-4 truncate font-mono text-xl font-semibold tracking-[-0.03em] tabular-nums sm:mt-5 sm:text-2xl">{value}</p></article>;
}

function ControlRow({ title, description, checked, onCheckedChange }: { title: string; description: string; checked: boolean; onCheckedChange: (value: boolean) => void }) {
  return <div className="flex items-center gap-5 py-4"><div className="flex-1"><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Switch checked={checked} onCheckedChange={onCheckedChange} aria-label={title}/></div>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-5 border-b border-white/10 pb-4 last:border-0 last:pb-0"><dt className="text-white/55">{label}</dt><dd className="text-right font-medium">{value}</dd></div>;
}

function AccountManager({userId,accounts,holderName}:{userId:string;accounts:Account[];holderName:string}){
  const {toast}=useToast();
  const [isAdding,setIsAdding]=useState(false);
  const [type,setType]=useState<"checking"|"savings">("checking");
  const [maskedNumber,setMaskedNumber]=useState("");
  const [openingBalance,setOpeningBalance]=useState("0.00");

  const create=useMutation({
    mutationFn:(input:CreateAdminAccount)=>apiRequest(`/api/admin/users/${userId}/accounts`,"POST",input) as Promise<Account>,
    onSuccess:(account)=>{
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`],(current)=>current?{...current,accounts:[...current.accounts,account],customer:{...current.customer,balance:current.customer.balance+account.balance}}:current);
      queryClient.invalidateQueries({queryKey:["/api/admin/users"]});
      queryClient.invalidateQueries({queryKey:["/api/admin/stats"]});
      setType("checking");setMaskedNumber("");setOpeningBalance("0.00");setIsAdding(false);
      toast({title:"Bank account added",description:`${account.name} is now available on this customer record.`});
    },
    onError:(error:Error)=>toast({title:"Account creation failed",description:error.message,variant:"destructive"}),
  });

  const parsedBalance=Number(openingBalance);
  const canCreate=/^\d{4}$/.test(maskedNumber)&&Number.isFinite(parsedBalance)&&parsedBalance>=0&&parsedBalance<=10_000_000;
  const submit=(event:React.FormEvent)=>{event.preventDefault();if(canCreate)create.mutate({type,maskedNumber,openingBalance:parsedBalance});};

  return <section className="rounded-2xl border bg-card p-6">
    <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Bank accounts</h2><p className="mt-1 text-xs text-muted-foreground">Create checking or savings accounts and maintain their account details.</p></div><Button type="button" size="sm" variant={isAdding?"ghost":"outline"} onClick={()=>setIsAdding((value)=>!value)}>{isAdding?<><X className="mr-2 size-4"/>Cancel</>:<><Plus className="mr-2 size-4"/>Add account</>}</Button></div>
    {isAdding&&<form onSubmit={submit} className="mt-5 space-y-4 rounded-xl border bg-muted/30 p-4">
      <div className="rounded-xl bg-background p-4"><p className="text-xs text-muted-foreground">Account holder</p><p className="mt-1 text-sm font-semibold">{holderName}</p><p className="mt-1 text-xs text-muted-foreground">This name follows the customer identity.</p></div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <div><Label htmlFor="newAccountType">Account type</Label><select id="newAccountType" value={type} onChange={(event)=>setType(event.target.value as "checking"|"savings")} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"><option value="checking">Checking</option><option value="savings">Savings</option></select></div>
        <div><Label htmlFor="newAccountDigits">Final four digits</Label><Input id="newAccountDigits" className="mt-2 font-mono" inputMode="numeric" maxLength={4} pattern="\d{4}" value={maskedNumber} onChange={(event)=>setMaskedNumber(event.target.value.replace(/\D/g,"").slice(0,4))} placeholder="0000" required/></div>
      </div>
      <div><Label htmlFor="newAccountBalance">Opening balance</Label><Input id="newAccountBalance" className="mt-2 font-mono" type="number" inputMode="decimal" min="0" max="10000000" step="0.01" value={openingBalance} onChange={(event)=>setOpeningBalance(event.target.value)} required/><p className="mt-2 text-xs text-muted-foreground">The opening balance cannot be edited here after account creation.</p></div>
      <Button type="submit" className="w-full" disabled={!canCreate||create.isPending}>{create.isPending?"Adding account…":"Add bank account"}</Button>
    </form>}
    <div className="mt-5 space-y-3">{accounts.length===0?<p className="rounded-xl bg-muted/55 p-5 text-sm text-muted-foreground">No bank accounts have been opened.</p>:accounts.map((account)=><AccountEditor key={account.id} userId={userId} account={account}/>)}</div>
  </section>;
}

function AccountEditor({userId,account}:{userId:string;account:Account}){
  const {toast}=useToast();
  const [isEditing,setIsEditing]=useState(false);
  const [type,setType]=useState<Account["type"]>(account.type);
  const [maskedNumber,setMaskedNumber]=useState(account.maskedNumber);
  const [copied,setCopied]=useState(false);

  const copyAccountNumber=async()=>{
    if(!account.accountNumber)return;
    try{
      await navigator.clipboard.writeText(account.accountNumber);
      setCopied(true);
      window.setTimeout(()=>setCopied(false),1800);
      toast({title:"Account number copied",description:"It is ready to paste."});
    }catch{
      toast({title:"Could not copy account number",description:"Copy permission was denied by the browser.",variant:"destructive"});
    }
  };

  const update=useMutation({
    mutationFn:(input:UpdateAdminAccount)=>apiRequest(`/api/admin/users/${userId}/accounts/${account.id}`,"PATCH",input) as Promise<Account>,
    onSuccess:(updated)=>{
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`],(current)=>current?{...current,accounts:current.accounts.map((item)=>item.id===updated.id?updated:item)}:current);
      setType(updated.type);setMaskedNumber(updated.maskedNumber);setIsEditing(false);
      toast({title:"Bank account updated",description:`${updated.name} was saved.`});
    },
    onError:(error:Error)=>toast({title:"Account update failed",description:error.message,variant:"destructive"}),
  });

  const assignNumber=useMutation({
    mutationFn:()=>apiRequest(`/api/admin/users/${userId}/accounts/${account.id}/number`,"POST") as Promise<Account>,
    onSuccess:(updated)=>{
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`],(current)=>current?{...current,accounts:current.accounts.map((item)=>item.id===updated.id?updated:item)}:current);
      setMaskedNumber(updated.maskedNumber);
      toast({title:"Account number assigned",description:`${formatAccountNumber(updated.accountNumber,updated.maskedNumber)} is permanent and cannot be changed.`});
    },
    onError:(error:Error)=>toast({title:"Account number assignment failed",description:error.message,variant:"destructive"}),
  });

  const confirmAssignment=()=>{
    if(window.confirm("Assign a permanent random account number to this account? The number cannot be changed or removed after assignment."))assignNumber.mutate();
  };

  const cancel=()=>{setType(account.type);setMaskedNumber(account.maskedNumber);setIsEditing(false);};
  const canSave=/^\d{4}$/.test(maskedNumber);

  return <article className="rounded-xl bg-muted/45 p-4">
    {isEditing?<form onSubmit={(event)=>{event.preventDefault();if(canSave)update.mutate({type,maskedNumber});}} className="space-y-4">
      <div className="rounded-xl bg-background p-3"><p className="text-xs text-muted-foreground">Account holder</p><p className="mt-1 text-sm font-semibold">{account.name}</p></div>
      <div className="grid grid-cols-2 gap-3"><div><Label htmlFor={`accountType-${account.id}`}>Type</Label><select id={`accountType-${account.id}`} value={type} onChange={(event)=>setType(event.target.value as Account["type"])} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"><option value="checking">Checking</option><option value="savings">Savings</option></select></div><div><Label htmlFor={`accountDigits-${account.id}`}>{account.accountNumber?"Final four (locked)":"Final four"}</Label><Input id={`accountDigits-${account.id}`} className="mt-2 font-mono" inputMode="numeric" maxLength={4} pattern="\d{4}" value={maskedNumber} onChange={(event)=>setMaskedNumber(event.target.value.replace(/\D/g,"").slice(0,4))} disabled={Boolean(account.accountNumber)} required/></div></div>
      <div className="flex gap-2"><Button type="submit" size="sm" disabled={!canSave||update.isPending}>{update.isPending?"Saving…":"Save account"}</Button><Button type="button" size="sm" variant="ghost" onClick={cancel} disabled={update.isPending}>Cancel</Button></div>
    </form>:<div><div className="flex items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold">{account.name}</p><span className="rounded-md bg-background px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground">{account.type}</span></div><div className="mt-2 flex items-center gap-1.5"><Hash className="size-3.5 text-primary"/><p className="font-mono text-sm font-medium tracking-[0.08em] tabular-nums">{formatAccountNumber(account.accountNumber,account.maskedNumber)}</p>{account.accountNumber&&<button type="button" onClick={copyAccountNumber} className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Copy full account number for ${account.name}`}>{copied?<Check className="size-3.5 text-primary"/>:<Copy className="size-3.5"/>}</button>}</div>{!account.accountNumber&&<p className="mt-1 text-xs text-muted-foreground">Permanent account number pending</p>}</div><div className="text-right"><p className="font-mono text-sm font-semibold tabular-nums">{formatCurrency(account.balance)}</p><div className="mt-2 flex flex-wrap justify-end gap-1">{!account.accountNumber&&<Button type="button" variant="outline" size="sm" className="h-8 px-2" onClick={confirmAssignment} disabled={assignNumber.isPending}><Hash className="mr-1.5 size-3.5"/>{assignNumber.isPending?"Assigning…":"Assign number"}</Button>}<Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={()=>setIsEditing(true)} disabled={assignNumber.isPending}><PencilLine className="mr-1.5 size-3.5"/>Edit</Button></div></div></div></div>}
  </article>;
}

function CardManager({userId,accounts,cards}:{userId:string;accounts:Account[];cards:BankCard[]}){
  const {toast}=useToast();
  const [isAdding,setIsAdding]=useState(false);
  const [accountId,setAccountId]=useState(accounts[0]?.id??"");
  const [network,setNetwork]=useState<CreateAdminCard["network"]>("Mastercard");
  const [type,setType]=useState<CreateAdminCard["type"]>("virtual");
  const [status,setStatus]=useState<CreateAdminCard["status"]>("active");
  const [spendingLimit,setSpendingLimit]=useState("2500");

  useEffect(()=>{if(!accounts.some((account)=>account.id===accountId))setAccountId(accounts[0]?.id??"");},[accountId,accounts]);

  const create=useMutation({
    mutationFn:(input:CreateAdminCard)=>apiRequest(`/api/admin/users/${userId}/cards`,"POST",input) as Promise<BankCard>,
    onSuccess:(card)=>{
      queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`],(current)=>current?{...current,cards:[...current.cards,card]}:current);
      setIsAdding(false);setNetwork("Mastercard");setType("virtual");setStatus("active");setSpendingLimit("2500");
      toast({title:"Card issued",description:`${card.network} ending in ${card.lastFour} was created and the customer was notified.`});
    },
    onError:(error:Error)=>toast({title:"Card issuance failed",description:error.message,variant:"destructive"}),
  });

  const updateCards=(updater:(current:BankCard[])=>BankCard[])=>queryClient.setQueryData<AdminCustomerDetails>([`/api/admin/users/${userId}`],(current)=>current?{...current,cards:updater(current.cards)}:current);
  const revoke=useMutation({
    mutationFn:(cardId:string)=>apiRequest(`/api/admin/users/${userId}/cards/${cardId}/revoke`,"PATCH") as Promise<BankCard>,
    onSuccess:(updated)=>{updateCards((current)=>current.map((card)=>card.id===updated.id?updated:card));toast({title:"Card revoked",description:`${updated.network} ending in ${updated.lastFour} is now frozen.`});},
    onError:(error:Error)=>toast({title:"Card revocation failed",description:error.message,variant:"destructive"}),
  });
  const remove=useMutation({
    mutationFn:(cardId:string)=>apiRequest(`/api/admin/users/${userId}/cards/${cardId}`,"DELETE"),
    onSuccess:(_,cardId)=>{updateCards((current)=>current.filter((card)=>card.id!==cardId));toast({title:"Card deleted",description:"The card and its issuance notification were permanently removed."});},
    onError:(error:Error)=>toast({title:"Card deletion failed",description:error.message,variant:"destructive"}),
  });

  const parsedLimit=Number(spendingLimit);
  const canCreate=Boolean(accountId)&&Number.isFinite(parsedLimit)&&parsedLimit>=100&&parsedLimit<=25_000;
  return <section className="rounded-2xl bg-muted/55 p-6">
    <div className="flex items-center justify-between gap-4"><div><h2 className="font-semibold">Payment cards</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Issue a Visa or Mastercard tied to one customer account.</p></div><Button type="button" size="sm" variant={isAdding?"ghost":"outline"} onClick={()=>setIsAdding((value)=>!value)} disabled={accounts.length===0}>{isAdding?<><X className="mr-2 size-4"/>Cancel</>:<><Plus className="mr-2 size-4"/>Issue card</>}</Button></div>
    {accounts.length===0&&<p className="mt-4 rounded-xl bg-card p-4 text-xs text-muted-foreground">Open a bank account before issuing a card.</p>}
    {isAdding&&<form onSubmit={(event)=>{event.preventDefault();if(canCreate)create.mutate({accountId,network,type,status,spendingLimit:parsedLimit});}} className="mt-5 space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/[0.06]">
      <div><Label htmlFor="cardAccount">Linked account</Label><select id="cardAccount" value={accountId} onChange={(event)=>setAccountId(event.target.value)} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm">{accounts.map((account)=><option key={account.id} value={account.id}>{account.name} · {account.type}</option>)}</select></div>
      <div className="grid gap-3 sm:grid-cols-3"><div><Label htmlFor="cardNetwork">Card network</Label><select id="cardNetwork" value={network} onChange={(event)=>setNetwork(event.target.value as CreateAdminCard["network"])} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"><option value="Mastercard">Mastercard</option><option value="Visa">Visa</option></select></div><div><Label htmlFor="cardType">Card type</Label><select id="cardType" value={type} onChange={(event)=>setType(event.target.value as CreateAdminCard["type"])} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"><option value="virtual">Virtual</option><option value="physical">Physical</option></select></div><div><Label htmlFor="cardStatus">Initial status</Label><select id="cardStatus" value={status} onChange={(event)=>setStatus(event.target.value as CreateAdminCard["status"])} className="mt-2 flex h-11 w-full rounded-md border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10 md:text-sm"><option value="active">Active</option><option value="frozen">Frozen</option></select></div></div>
      <div><Label htmlFor="cardLimit">Spending limit</Label><Input id="cardLimit" className="mt-2 font-mono" type="number" inputMode="decimal" min="100" max="25000" step="0.01" value={spendingLimit} onChange={(event)=>setSpendingLimit(event.target.value)} required/><p className="mt-2 text-xs text-muted-foreground">The server generates the number, expiration, and protected card data.</p></div>
      <Button type="submit" className="w-full" disabled={!canCreate||create.isPending}>{create.isPending?"Issuing card…":"Issue and notify customer"}</Button>
    </form>}
    <div className="mt-5 space-y-2">{cards.length===0?<p className="rounded-xl bg-card p-4 text-xs text-muted-foreground">No cards issued to this customer.</p>:cards.map((card)=><div key={card.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-card p-3"><div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><CreditCard className="size-4" strokeWidth={1.7}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold capitalize">{card.type} {card.network}</p><p className="mt-0.5 font-mono text-xs text-muted-foreground">**** {card.lastFour} · {card.expires}</p></div><span className="text-[11px] font-medium capitalize text-muted-foreground">{card.status}</span><div className="flex items-center gap-2"><Button type="button" size="sm" variant="outline" disabled={revoke.isPending||remove.isPending||card.status==="frozen"} onClick={()=>{if(window.confirm(`Revoke ${card.network} ending in ${card.lastFour}? The customer will no longer be able to use it.`))revoke.mutate(card.id);}}><Ban className="mr-1.5 size-3.5"/>{card.status==="frozen"?"Revoked":"Revoke"}</Button><Button type="button" size="sm" variant="destructive" disabled={revoke.isPending||remove.isPending} onClick={()=>{if(window.confirm(`Permanently delete ${card.network} ending in ${card.lastFour}? This cannot be undone.`))remove.mutate(card.id);}}><Trash2 className="mr-1.5 size-3.5"/>Delete</Button></div></div>)}</div>
  </section>;
}

function CustomerDetailsSkeleton() {
  return <div className="animate-pulse space-y-8"><div className="h-4 w-36 rounded bg-muted"/><div className="flex gap-4"><div className="size-14 rounded-2xl bg-muted"/><div className="space-y-3"><div className="h-8 w-64 rounded bg-muted"/><div className="h-4 w-44 rounded bg-muted"/></div></div><div className="grid gap-5 xl:grid-cols-[1fr_0.72fr]"><div className="h-96 rounded-2xl bg-muted"/><div className="h-72 rounded-2xl bg-muted"/></div></div>;
}
