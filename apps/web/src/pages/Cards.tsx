import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard, Eye, Snowflake, Wifi } from "lucide-react";
import type { BankCard, UpdateCard } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/banking";
import { queryClient } from "@/lib/queryClient";

export default function Cards() {
  const { data: cards = [], isLoading } = useQuery<BankCard[]>({ queryKey: ["/api/cards"] });
  const { toast } = useToast();
  const updateCard = useMutation({
    mutationFn: ({ id, update }: { id: string; update: UpdateCard }) => apiRequest(`/api/cards/${id}`, "PATCH", update) as Promise<BankCard>,
    onSuccess: (card) => {
      queryClient.setQueryData<BankCard[]>(["/api/cards"], (current = []) => current.map((item) => item.id === card.id ? card : item));
      toast({ title: card.status === "frozen" ? "Card frozen" : "Card ready to use", description: `Visa ending in ${card.lastFour} was updated.` });
    },
    onError: (error: Error) => toast({ title: "Card update failed", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-8">
      <header><p className="text-sm text-muted-foreground">Card controls</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Cards</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Manage spending access without calling support.</p></header>
      {isLoading ? <div className="grid gap-6 lg:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-80 animate-pulse rounded-2xl bg-muted" />)}</div> : cards.length === 0 ? <section className="grid min-h-72 place-items-center rounded-2xl bg-muted/55 p-8 text-center"><div><CreditCard className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold">No cards issued</h2><p className="mt-1 text-sm text-muted-foreground">Issued physical and virtual cards will appear here.</p></div></section> : <section className="grid gap-6 lg:grid-cols-2" aria-label="Payment cards">{cards.map((card, index) => (
        <article key={card.id} className="rounded-2xl border bg-card p-5 sm:p-6">
          <div className={`relative aspect-[1.58/1] overflow-hidden rounded-2xl p-6 text-white shadow-[0_22px_55px_rgba(14,45,35,.2)] ${index === 0 ? "bg-[#14251f]" : "bg-[#415a52]"}`}>
            <div className="absolute -right-16 -top-16 size-52 rounded-full border border-white/10" /><div className="absolute -bottom-20 -left-12 size-56 rounded-full border border-white/10" />
            <div className="relative flex h-full flex-col"><div className="flex items-start justify-between"><span className="text-sm font-medium">ClipX</span><Wifi className="size-5 rotate-90 text-white/75" /></div><div className="mt-auto"><p className="font-mono text-xl tracking-[0.14em]">•••• •••• •••• {card.lastFour}</p><div className="mt-5 flex items-end justify-between"><div><p className="text-[10px] uppercase tracking-[0.16em] text-white/55">Card holder</p><p className="mt-1 text-xs font-medium tracking-wide">{card.holderName}</p></div><div><p className="text-[10px] uppercase tracking-[0.16em] text-white/55">Expires</p><p className="mt-1 font-mono text-xs">{card.expires}</p></div><p className="text-xl font-semibold italic">VISA</p></div></div></div>
          </div>
          <div className="mt-6 flex items-center justify-between gap-4"><div><h2 className="font-semibold capitalize">{card.type} card</h2><p className="mt-1 text-sm text-muted-foreground">{card.status === "frozen" ? "Payments are currently blocked" : `${formatCurrency(card.spendingLimit)} spending limit`}</p></div><span className={`rounded-md px-2 py-1 text-xs font-medium capitalize ${card.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{card.status}</span></div>
          <div className="mt-5 grid grid-cols-2 gap-3"><Button variant="outline"><Eye className="mr-2 size-4" />View details</Button><Button variant={card.status === "active" ? "outline" : "default"} disabled={updateCard.isPending} onClick={() => updateCard.mutate({ id: card.id, update: { status: card.status === "active" ? "frozen" : "active" } })}><Snowflake className="mr-2 size-4" />{card.status === "active" ? "Freeze" : "Unfreeze"}</Button></div>
        </article>
      ))}</section>}
      <section className="flex flex-col gap-5 rounded-2xl bg-muted/55 p-6 sm:flex-row sm:items-center sm:justify-between"><div className="flex gap-4"><div className="grid size-11 shrink-0 place-items-center rounded-xl bg-card text-primary"><CreditCard className="size-5" /></div><div><h2 className="font-semibold">Need another card?</h2><p className="mt-1 text-sm text-muted-foreground">Create a virtual card for subscriptions or online purchases.</p></div></div><Button variant="outline" disabled>Coming soon</Button></section>
    </div>
  );
}
