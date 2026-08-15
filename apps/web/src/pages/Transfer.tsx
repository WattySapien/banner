import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Check, Landmark, Send } from "lucide-react";
import type { Account, BankTransaction, Beneficiary, CreateTransfer } from "@clipx/contracts/banking";
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
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<BankTransaction | null>(null);
  const { toast } = useToast();

  const source = accounts.find((account) => account.id === (sourceAccountId || accounts[0]?.id));
  const recipient = beneficiaries.find((beneficiary) => beneficiary.id === beneficiaryId);
  const numericAmount = Number(amount);

  const transfer = useMutation({
    mutationFn: (payload: CreateTransfer) => apiRequest("/api/transfers", "POST", payload) as Promise<BankTransaction>,
    onSuccess: (transaction) => {
      setReceipt(transaction);
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/overview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });
    },
    onError: (error: Error) => toast({ title: "Transfer failed", description: error.message, variant: "destructive" }),
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!source || !recipient || !Number.isFinite(numericAmount) || numericAmount <= 0) return;
    transfer.mutate({ sourceAccountId: source.id, beneficiaryId: recipient.id, amount: numericAmount, note: note.trim() || "Bank transfer" });
  };

  if (receipt) return (
    <div className="mx-auto max-w-xl py-8 sm:py-16">
      <div className="rounded-2xl border bg-card p-7 text-center sm:p-10">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground"><Check className="size-6" /></div>
        <p className="mt-6 text-sm text-muted-foreground">Transfer complete</p>
        <h1 className="mt-2 font-mono text-4xl font-semibold tracking-[-0.04em] tabular-nums">{formatCurrency(receipt.amount)}</h1>
        <p className="mt-3 text-sm text-muted-foreground">Sent to {receipt.merchant}</p>
        <div className="mt-7 rounded-xl bg-muted/60 p-4 text-left text-sm"><span className="text-muted-foreground">Reference</span><span className="float-right font-mono font-medium">{receipt.reference}</span></div>
        <Button className="mt-7 w-full" onClick={() => { setReceipt(null); setBeneficiaryId(""); setAmount(""); setNote(""); }}>Make another transfer</Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      <header><p className="text-sm text-muted-foreground">Payments</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Send money</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Choose who to pay and review the amount before sending.</p></header>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <form onSubmit={submit} className="rounded-2xl border bg-card p-5 sm:p-7">
          {(accounts.length === 0 || beneficiaries.length === 0) && <div className="mb-6 rounded-xl bg-muted/55 p-4 text-sm text-muted-foreground">A source account and recipient are required before you can send money.</div>}
          <div className="space-y-6">
            <div><Label htmlFor="source">From account</Label><select id="source" value={sourceAccountId || accounts[0]?.id || ""} onChange={(event) => setSourceAccountId(event.target.value)} className="mt-2 flex h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">{accounts.map((account) => <option key={account.id} value={account.id}>{account.name} — {formatCurrency(account.availableBalance)} available</option>)}</select></div>
            <fieldset><legend className="text-sm font-medium">Recipient</legend><div className="mt-2 grid gap-3 sm:grid-cols-3">{beneficiaries.map((beneficiary) => <button key={beneficiary.id} type="button" onClick={() => setBeneficiaryId(beneficiary.id)} className={`rounded-xl border p-4 text-left transition-colors active:translate-y-px ${beneficiaryId === beneficiary.id ? "border-primary bg-primary/[0.05]" : "hover:border-primary/35"}`}><span className="grid size-9 place-items-center rounded-lg bg-muted text-xs font-semibold">{beneficiary.initials}</span><span className="mt-3 block text-sm font-semibold">{beneficiary.name}</span><span className="mt-1 block text-xs text-muted-foreground">{beneficiary.bankName} · {beneficiary.maskedAccount}</span></button>)}</div></fieldset>
            <div><Label htmlFor="amount">Amount</Label><div className="relative mt-2"><span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">$</span><Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" className="pl-8 font-mono text-lg" required /></div>{source && numericAmount > source.availableBalance && <p className="mt-2 text-sm text-destructive">Amount exceeds the available balance.</p>}</div>
            <div><Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label><Input id="note" value={note} onChange={(event) => setNote(event.target.value)} maxLength={80} placeholder="What is this for?" className="mt-2" /></div>
          </div>
          <Button type="submit" size="lg" className="mt-7 w-full" disabled={!source || !recipient || numericAmount <= 0 || numericAmount > (source?.availableBalance ?? 0) || transfer.isPending}>{transfer.isPending ? "Sending…" : "Review and send"}<ArrowRight className="ml-2 size-4" /></Button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl bg-[#14251f] p-6 text-[#f4f7f5]"><Send className="size-5 text-white/70" /><h2 className="mt-8 text-lg font-semibold">Transfer summary</h2><div className="mt-5 space-y-3 border-t border-white/12 pt-5 text-sm"><div className="flex justify-between gap-4"><span className="text-white/55">Recipient</span><span className="text-right font-medium">{recipient?.name ?? "Not selected"}</span></div><div className="flex justify-between gap-4"><span className="text-white/55">Amount</span><span className="font-mono font-medium tabular-nums">{numericAmount > 0 ? formatCurrency(numericAmount) : "$0.00"}</span></div><div className="flex justify-between gap-4"><span className="text-white/55">Fee</span><span className="font-medium">$0.00</span></div></div></div>
          <div className="flex gap-3 rounded-2xl bg-muted/55 p-5"><Landmark className="mt-0.5 size-5 shrink-0 text-primary" /><p className="text-sm leading-relaxed text-muted-foreground">Transfers are processed immediately in this development environment.</p></div>
        </aside>
      </div>
    </div>
  );
}
