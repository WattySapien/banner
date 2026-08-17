import { useState } from "react";
import { Headphones, MessageCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportConversation } from "@/components/SupportConversation";

export function ContactSupport() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6">
      {isOpen && (
        <section className="flex h-[min(36rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border bg-card shadow-[0_24px_70px_hsl(248_24%_12%/.2)]" role="dialog" aria-label="Contact support">
          <div className="flex items-start justify-between gap-4 bg-primary px-5 py-4 text-primary-foreground">
            <div className="flex gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-foreground/15"><Headphones className="size-[18px]" /></span>
              <div><h2 className="font-semibold">Contact support</h2></div>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="grid size-8 place-items-center rounded-lg text-primary-foreground/75 hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Close support chat"><X className="size-4" /></button>
          </div>
          <SupportConversation endpoint="/api/support/messages" viewerRole="customer" />
        </section>
      )}
      <Button type="button" size="lg" onClick={() => setIsOpen((current) => !current)} aria-expanded={isOpen} aria-label={isOpen ? "Close support chat" : "Contact support"} className="h-12 rounded-full px-4 shadow-[0_14px_35px_hsl(158_55%_25%/.25)]">
        <MessageCircle className="size-[18px]" />
        <span>Contact support</span>
      </Button>
    </div>
  );
}
