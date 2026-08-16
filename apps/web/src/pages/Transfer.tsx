import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeftRight, ArrowRight, Check, Hash, Landmark, Send } from "lucide-react";
import type { Account, BankTransaction, Beneficiary, CreateInternalTransfer, CreatePeerTransfer, CreateTransfer, InternalTransferReceipt, PeerRecipient, PeerTransferReceipt } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/banking";
import { queryClient } from "@/lib/queryClient";

export default function Transfer() {
  const { data: accounts = [] } = useQuery<Account[]>({ queryKey: ["/api/accounts"] });
  const { data: beneficiaries = [] } = useQuery<Beneficiary[]>({ queryKey: ["/api/beneficiaries"] });
  const [mode, setMode] = useState<"internal"|"peer"|"external">("internal");
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [recipientAccountNumber, setRecipientAccountNumber] = useState("");
  const [verifiedPeerRecipient, setVerifiedPeerRecipient] = useState<PeerRecipient>();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<{kind:"external";transaction:BankTransaction}|{kind:"internal";transfer:InternalTransferReceipt}|{kind:"peer";transfer:PeerTransferReceipt}|null>(null);
  const { toast } = useToast();

  const source = accounts.find((account) => account.id === (sourceAccountId || accounts[0]?.id));
  const destination = accounts.find((account) => account.id === destinationAccountId) ?? accounts.find((account) => account.id !== source?.id);
  const recipient = beneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId);
  const confirmedPeerRecipient = verifiedPeerRecipient?.accountNumber===recipientAccountNumber ? verifiedPeerRecipient : undefined;
  const numericAmount = Number(amount);

  const transfer = useMutation({
    mutationFn: (payload: CreateTransfer) => apiRequest("/api/transfers", "POST", payload) as Promise<BankTransaction>,
    onSuccess: (transaction) => {
      setReceipt({kind:"external",transaction});
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => toast({ title: "Transfer failed", description: error.message, variant: "destructive" }),
  });

  const internalTransfer = useMutation({
    mutationFn: (payload: CreateInternalTransfer) => apiRequest("/api/transfers/internal", "POST", payload) as Promise<InternalTransferReceipt>,
    onSuccess: (completedTransfer) => {
      setReceipt({kind:"internal",transfer:completedTransfer});
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => toast({ title: "Transfer failed", description: error.message, variant: "destructive" }),
  });

  const recipientLookup=useMutation({
    mutationFn:(accountNumber:string)=>apiRequest("/api/transfers/recipient/lookup","POST",{accountNumber}) as Promise<PeerRecipient>,
    onSuccess:(resolved)=>setVerifiedPeerRecipient(resolved),
    onError:(error:Error)=>{setVerifiedPeerRecipient(undefined);toast({title:"Recipient not found",description:error.message,variant:"destructive"});},
  });

  const peerTransfer=useMutation({
    mutationFn:(payload:CreatePeerTransfer)=>apiRequest("/api/transfers/peer","POST",payload) as Promise<PeerTransferReceipt>,
    onSuccess:(completedTransfer)=>{
      setReceipt({kind:"peer",transfer:completedTransfer});
      queryClient.invalidateQueries({queryKey:["/api/accounts"]});
      queryClient.invalidateQueries({queryKey:["/api/overview"]});
      queryClient.invalidateQueries({queryKey:["/api/transactions"]});
    },
    onError:(error:Error)=>toast({title:"Transfer failed",description:error.message,variant:"destructive"}),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!source || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    if(mode==="internal"){
      if(!destination||destination.id===source.id)return;
      internalTransfer.mutate({sourceAccountId:source.id,destinationAccountId:destination.id,amount:numericAmount,note:note.trim()||"Transfer between accounts"});
      return;
    }
    if(mode==="peer"){
      if(!confirmedPeerRecipient)return;
      peerTransfer.mutate({sourceAccountId:source.id,recipientAccountNumber,amount:numericAmount,note:note.trim()||"Account number transfer"});
      return;
    }
    if(!recipient)return;
    transfer.mutate({ sourceAccountId: source.id, beneficiaryId: recipient.id, amount: numericAmount, note: note.trim() || "Bank transfer" });
  };

  if (receipt) {
    const completed=receipt.kind==="external"?receipt.transaction:receipt.transfer;
    const destinationName=receipt.kind==="internal"?receipt.transfer.destinationAccountName:receipt.kind==="peer"?receipt.transfer.recipientName:receipt.transaction.merchant;
    return (
    <div className="mx-auto max-w-xl py-8 sm:py-16">
      <div className="rounded-2xl border bg-card p-7 text-center sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Check className="size-6" /></div>
        <p className="mt-6 text-sm text-muted-foreground">Transfer complete</p>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-[-0.04em] tabular-nums">{formatCurrency(completed.amount)}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{receipt.kind==="internal"?"Moved to":"Sent to"} {destinationName}</p>
        <div className="mt-7 rounded-xl bg-muted/60 p-4 text-left text-sm"><span className="text-muted-foreground">Reference</span><span className="float-right font-mono text-xs font-medium sm:text-sm">{completed.reference}</span></div>
        <Button className="mt-7 w-full" onClick={() => { setReceipt(null); setBeneficiaryId(""); setDestinationAccountId(""); setRecipientAccountNumber(""); setVerifiedPeerRecipient(undefined); setAmount(""); setNote(""); }}>Make another transfer</Button>
      </div>
    </div>
  );
  }

  return (
    <div className="space-y-8">
      <header><p className="text-sm text-muted-foreground">Payments</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Transfer funds</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Move money between your accounts or send it to a saved recipient.</p></header>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-5 sm:p-7">
          <div className="mb-7 grid grid-cols-3 rounded-xl bg-muted/60 p-1" aria-label="Transfer type">
            <button type="button" aria-pressed={mode==="internal"} onClick={()=>setMode("internal")} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${mode==="internal"?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}><ArrowLeftRight className="size-4 shrink-0"/>Between my accounts</button>
            <button type="button" aria-pressed={mode==="peer"} onClick={()=>setMode("peer")} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${mode==="peer"?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}><Hash className="size-4 shrink-0"/>Account number</button>
            <button type="button" aria-pressed={mode==="external"} onClick={()=>setMode("external")} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-[11px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-sm ${mode==="external"?"bg-background text-foreground shadow-sm":"text-muted-foreground hover:text-foreground"}`}><Send className="size-4 shrink-0"/>Saved recipient</button>
          </div>
          {((mode==="internal"&&accounts.length<2)||(mode==="peer"&&accounts.length===0)||(mode==="external"&&(accounts.length===0||beneficiaries.length===0)))&&<div className="mb-6 rounded-xl bg-muted/55 p-4 text-sm text-muted-foreground">{mode==="internal"?"At least two accounts are required to transfer funds between them.":mode==="peer"?"A source account is required before you can send money.":"A source account and saved recipient are required before you can send money."}</div>}
          <div className="space-y-6">
            <div><Label htmlFor="source">From account</Label><select id="source" value={sourceAccountId || accounts[0]?.id || ""} onChange={(event)=>{setSourceAccountId(event.target.value);if(destinationAccountId===event.target.value)setDestinationAccountId("");}} className="mt-2 flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {formatCurrency(account.availableBalance)} available</option>)}</select></div>
            {mode==="internal"?<div><Label htmlFor="destination">To account</Label><select id="destination" value={destination?.id||""} onChange={(event)=>setDestinationAccountId(event.target.value)} className="mt-2 flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{accounts.filter((account)=>account.id!==source?.id).map((account)=><option key={account.id} value={account.id}>{account.name}{account.accountNumber?` · ${account.accountNumber}`:` · ending in ${account.maskedNumber}`}</option>)}</select><p className="mt-2 text-xs text-muted-foreground">Internal transfers arrive immediately and count toward your limit of 10 in-app transfers per rolling hour.</p></div>:mode==="peer"?<div><Label htmlFor="recipientAccountNumber">Recipient account number</Label><div className="mt-2 flex gap-2"><Input id="recipientAccountNumber" className="font-mono tracking-[0.08em]" inputMode="numeric" autoComplete="off" maxLength={10} pattern="\d{10}" value={recipientAccountNumber} onChange={(event)=>{setRecipientAccountNumber(event.target.value.replace(/\D/g,"").slice(0,10));setVerifiedPeerRecipient(undefined);}} placeholder="0000000000" required/><Button type="button" variant="outline" onClick={()=>recipientLookup.mutate(recipientAccountNumber)} disabled={recipientAccountNumber.length!==10||recipientLookup.isPending}>{recipientLookup.isPending?"Checking…":"Verify"}</Button></div>{confirmedPeerRecipient&&<div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4"><div className="flex items-center gap-2 text-primary"><Check className="size-4"/><p className="text-sm font-semibold">{confirmedPeerRecipient.recipientName}</p></div><p className="mt-1 pl-6 text-xs text-muted-foreground">{confirmedPeerRecipient.accountName} · {confirmedPeerRecipient.accountNumber}</p></div>}<p className="mt-2 text-xs text-muted-foreground">Verify the recipient before sending. Account-number transfers count toward the shared 10-per-hour limit.</p></div>:<fieldset><legend className="text-sm font-medium">Recipient</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{beneficiaries.map((beneficiary) => <button key={beneficiary.id} type="button" onClick={() => setBeneficiaryId(beneficiary.id)} className={`rounded-xl border p-4 text-left transition-colors active:translate-y-px ${beneficiaryId === beneficiary.id ? "border-primary bg-primary/[0.05]" : "hover:border-primary/35"}`}><span className="grid size-9 place-items-center rounded-lg bg-muted text-xs font-semibold">{beneficiary.initials}</span><span className="mt-3 block text-sm font-semibold">{beneficiary.name}</span><span className="mt-1 block text-xs text-muted-foreground">{beneficiary.bankName} · {beneficiary.maskedAccount}</span></button>)}</div></fieldset>}
            <div><Label htmlFor="amount">Amount</Label><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">$</span><Input id="amount" type="number" inputMode="decimal" min="0.01" max="50000" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="pl-8 font-mono text-lg" required /></div>{source && numericAmount > source.availableBalance && <p className="mt-2 text-sm text-destructive">Amount exceeds the available balance.</p>}</div>
            <div><Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label><Input id="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={80} placeholder="What is this for?" className="mt-2" /></div>
          </div>
          <Button type="submit" size="lg" className="mt-7 w-full" disabled={!source||(mode==="internal"?(!destination||destination.id===source.id):mode==="peer"?!confirmedPeerRecipient:!recipient)||!Number.isFinite(numericAmount)||numericAmount<=0||numericAmount>(source?.availableBalance??0)||transfer.isPending||internalTransfer.isPending||peerTransfer.isPending}>{transfer.isPending||internalTransfer.isPending||peerTransfer.isPending?"Transferring…":mode==="external"?"Review and send":"Transfer funds"}<ArrowRight className="ml-2 size-4" /></Button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5]">{mode==="internal"?<ArrowLeftRight className="size-5 text-white/70"/>:mode==="peer"?<Hash className="size-5 text-white/70"/>:<Send className="size-5 text-white/70"/>}<h2 className="mt-8 text-lg font-semibold">Transfer summary</h2><div className="mt-5 space-y-3 border-t border-white/12 pt-5 text-sm"><div className="flex justify-between gap-4"><span className="text-white/55">{mode==="internal"?"Destination":"Recipient"}</span><span className="text-right font-medium">{mode==="internal"?(destination?.name??"Not selected"):mode==="peer"?(confirmedPeerRecipient?.recipientName??"Not verified"):(recipient?.name??"Not selected")}</span></div><div className="flex justify-between gap-4"><span className="text-white/55">Amount</span><span className="font-mono font-medium tabular-nums">{numericAmount > 0 ? formatCurrency(numericAmount) : "$0.00"}</span></div><div className="flex justify-between gap-4"><span className="text-white/55">Fee</span><span className="font-medium">$0.00</span></div></div></div>
          <div className="flex gap-3 rounded-2xl bg-muted/55 p-5"><Landmark className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed text-muted-foreground">{mode==="internal"?"Funds move atomically: the source debit and destination credit either both succeed or neither is applied.":mode==="peer"?"The server verifies the assigned account number again when you send, then records matching debit and credit entries.":"Transfers to saved recipients are processed immediately in this development environment."}</p></div>
        </aside>
      </div>
    </div>
  );
}
