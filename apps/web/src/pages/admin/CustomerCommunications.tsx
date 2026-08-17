import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MessageCircle, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import type { AdminCustomerDetails } from "@clipx/contracts/admin";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { SupportConversation } from "@/components/SupportConversation";

export default function CustomerCommunications() {
  const { userId = "" } = useParams();
  const endpoint = `/api/admin/users/${userId}`;
  const { data, isLoading, error } = useQuery<AdminCustomerDetails>({ queryKey: [endpoint], enabled: Boolean(userId) });

  if (isLoading) return <div className="h-[42rem] animate-pulse rounded-2xl bg-muted" aria-label="Loading customer communications" />;
  if (error || !data) return <div className="rounded-2xl bg-muted/55 p-10 text-center"><h1 className="text-xl font-semibold">Customer not found</h1><Button asChild variant="outline" className="mt-6"><Link to="/admin/users"><ArrowLeft className="size-4" />Back to customers</Link></Button></div>;

  const { customer } = data;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4"><ProfileAvatar src={customer.profileImageUrl} initials={customer.initials} alt={`${customer.firstName} ${customer.lastName} profile`} className="size-14 rounded-2xl"/><div><p className="text-sm text-muted-foreground">Customer communications</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{customer.firstName} {customer.lastName}</h1><p className="mt-1 text-sm text-muted-foreground">{customer.email}</p></div></div>
        <Button asChild variant="outline"><Link to={`/admin/users/${userId}`}><ArrowLeft className="size-4" />Customer details</Link></Button>
      </header>

      <section className="grid overflow-hidden rounded-2xl border bg-card shadow-[0_18px_55px_hsl(248_20%_12%/.07)] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b bg-muted/35 p-5 lg:border-b-0 lg:border-r lg:p-6">
          <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="size-5" /></div>
          <h2 className="mt-5 font-semibold">Support conversation</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Messages sent from this page appear in the customer’s Contact support panel.</p>
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-background p-3 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary"/><p>Only authenticated local administrators can access or reply to this conversation.</p></div>
        </aside>
        <div className="flex h-[min(42rem,calc(100dvh-14rem))] min-h-[32rem] flex-col"><SupportConversation endpoint={`${endpoint}/support/messages`} viewerRole="admin" emptyTitle="No support request yet" /></div>
      </section>
    </div>
  );
}
