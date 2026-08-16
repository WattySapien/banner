import { useMutation, useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import type { BankCard, UpdateCard } from "@clipx/contracts/banking";
import { Button } from "@/components/ui/button";
import { SecurePaymentCard } from "@/components/SecurePaymentCard";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

export default function Cards() {
  const { data: cards = [], isLoading } = useQuery<BankCard[]>({ queryKey: ["/api/cards"], staleTime:0, refetchOnMount:"always" });
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
    <div className="space-y-6 sm:space-y-8">
      <header><h1 className="mt-1 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Cards</h1><p className="mt-2 max-w-xl text-sm text-muted-foreground sm:text-base">Manage spending access without calling support.</p></header>
      {isLoading ? <div className="grid gap-5 lg:grid-cols-[repeat(2,minmax(0,25rem))]">{[0, 1].map((item) => <div key={item} className="h-72 max-w-[25rem] animate-pulse rounded-2xl bg-muted" />)}</div> : cards.length === 0 ? <section className="grid min-h-72 place-items-center rounded-2xl bg-muted/55 p-8 text-center"><div><CreditCard className="mx-auto size-6 text-muted-foreground"/><h2 className="mt-4 font-semibold">No cards issued</h2><p className="mt-1 text-sm text-muted-foreground">Issued physical and virtual cards will appear here.</p></div></section> : <section className="grid gap-5 lg:grid-cols-[repeat(2,minmax(0,25rem))]" aria-label="Payment cards">{cards.map((card,index)=><SecurePaymentCard key={card.id} card={card} index={index} isUpdating={updateCard.isPending} onToggleStatus={()=>updateCard.mutate({id:card.id,update:{status:card.status==="active"?"frozen":"active"}})}/>)}</section>}
      <section className="flex flex-col gap-4 rounded-2xl bg-muted/55 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex gap-3 sm:gap-4"><div className="grid size-10 shrink-0 place-items-center rounded-xl bg-card text-primary sm:size-11"><CreditCard className="size-5" /></div><div><h2 className="font-semibold">Need another card?</h2><p className="mt-1 text-sm text-muted-foreground">Create a virtual card for subscriptions or online purchases.</p></div></div><Button className="w-full sm:w-auto" variant="outline" disabled>Coming soon</Button></section>
    </div>
  );
}
