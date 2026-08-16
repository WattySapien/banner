import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/Brand";
import { ThemeMenu } from "@/components/ThemeMenu";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] bg-background/80 lg:grid-cols-[0.9fr_1.1fr] lg:p-4">
      <main id="main-content" className="flex min-h-[100dvh] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4"><Brand /><ThemeMenu /></div>
        <div className="my-auto w-full max-w-md self-center py-8 sm:py-12">{children}</div>
        <p className="text-xs text-muted-foreground">© 2026 ClipX · <a href="#" className="hover:text-foreground">Privacy</a> · <a href="#" className="hover:text-foreground">Terms</a></p>
      </main>
      <aside className="relative hidden overflow-hidden rounded-2xl bg-[#211a3a] lg:block">
        <img src="/banking-hero.png" alt="Customer checking his ClipX account at home" className="absolute inset-0 h-full w-full object-cover opacity-65 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#211a3a] via-[#342653]/50 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <div className="mb-7 grid size-11 place-items-center rounded-xl bg-white/12 backdrop-blur"><ShieldCheck className="size-5" /></div>
          <blockquote className="max-w-xl text-3xl font-medium leading-tight tracking-[-0.035em] xl:text-4xl">A clearer view of your money, with fewer things getting in the way.</blockquote>
          <p className="mt-5 text-sm text-white/65">Simple controls. Real-time balances. Support when you need it.</p>
        </div>
      </aside>
    </div>
  );
}
