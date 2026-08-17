import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { LoaderCircle, Send } from "lucide-react";
import type { SupportMessage, SupportSenderRole } from "@clipx/contracts/support";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";

type SupportConversationProps = {
  endpoint: string;
  viewerRole: SupportSenderRole;
  emptyTitle?: string;
};

export function SupportConversation({ endpoint, viewerRole, emptyTitle = "Start a conversation" }: SupportConversationProps) {
  const [body, setBody] = useState("");
  const scrollArea = useRef<HTMLDivElement>(null);
  const { data: messageData, isLoading, error } = useQuery<SupportMessage[]>({
    queryKey: [endpoint],
    refetchInterval: 5_000,
    retry: 2,
    retryDelay: (attempt) => Math.min(750 * 2 ** attempt, 3_000),
  });
  const messages = messageData ?? [];

  useEffect(() => {
    scrollArea.current?.scrollTo({ top: scrollArea.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!messages.some((message) => !message.isRead && message.senderRole !== viewerRole)) return;
    apiRequest(`${endpoint}/read`, "PATCH").then(() => {
      queryClient.setQueryData<SupportMessage[]>([endpoint], (current = []) => current.map((message) => ({ ...message, isRead: true })));
    }).catch(() => undefined);
  }, [endpoint, messages, viewerRole]);

  const send = useMutation({
    mutationFn: (messageBody: string) => apiRequest(endpoint, "POST", { body: messageBody }) as Promise<SupportMessage>,
    onSuccess: (message) => {
      queryClient.setQueryData<SupportMessage[]>([endpoint], (current = []) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      setBody("");
    },
  });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const message = body.trim();
    if (message && message.length <= 2_000) send.mutate(message);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollArea} className="min-h-64 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-5" aria-live="polite">
        {isLoading && <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-5 animate-spin text-primary" aria-label="Loading conversation" /></div>}
        {error && <div className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">The conversation could not be loaded.</div>}
        {!isLoading && !error && messages.length === 0 && (
          <div className="grid min-h-48 place-items-center text-center"><div><p className="text-sm font-semibold">{emptyTitle}</p><p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">Messages stay connected to this customer account for future replies.</p></div></div>
        )}
        {messages.map((message) => {
          const own = message.senderRole === viewerRole;
          return (
            <article key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[86%] rounded-2xl px-4 py-3 ${own ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted"}`}>
                <div className={`flex items-center gap-2 text-[10px] font-medium ${own ? "text-primary-foreground/70" : "text-muted-foreground"}`}><span>{own ? "You" : message.senderName || (message.senderRole === "admin" ? "Support" : "Customer")}</span><span aria-hidden="true">·</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div>
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed">{message.body}</p>
              </div>
            </article>
          );
        })}
      </div>
      <form onSubmit={submit} className="border-t bg-card p-3 sm:p-4">
        <Textarea value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} maxLength={2_000} rows={2} placeholder="Write a message…" aria-label="Support message" className="min-h-20 resize-none" />
        <div className="mt-2 flex items-center justify-between gap-3"><p className="text-[10px] text-muted-foreground">{body.length.toLocaleString()}/2,000</p><Button type="submit" size="sm" disabled={!body.trim() || send.isPending}>{send.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}Send</Button></div>
        {send.error && <p className="mt-2 text-xs text-destructive">{send.error.message}</p>}
      </form>
    </div>
  );
}
