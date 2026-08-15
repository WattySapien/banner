import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Brand } from "@/components/Brand";

type AuthLayoutProps = {
  children: ReactNode;
};

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[0.9fr_1.1fr]">
      <main id="main-content" className="flex min-h-[100dvh] flex-col px-5 py-6 sm:px-10 lg:px-14">
        <Brand />
        <div className="my-auto w-full max-w-md self-center py-12">{children}</div>
        <p className="text-xs text-muted-foreground">© 2026 ClipX · <a href="#" className="hover:text-foreground">Privacy</a> · <a href="#" className="hover:text-foreground">Terms</a></p>
      </main>
      <aside className="relative hidden overflow-hidden bg-[#14251f] lg:block">
        <img src="/banking-hero.png" alt="Customer checking his ClipX account at home" className="absolute inset-0 h-full w-full object-cover opacity-60 mix-blend-luminosity" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#14251f] via-[#14251f]/45 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white xl:p-16">
          <div className="mb-7 grid size-11 place-items-center rounded-xl bg-white/12 backdrop-blur"><ShieldCheck className="size-5" /></div>
          <blockquote className="max-w-xl text-3xl font-medium leading-tight tracking-[-0.035em] xl:text-4xl">A clearer view of your money, with fewer things getting in the way.</blockquote>
          <p className="mt-5 text-sm text-white/65">Simple controls. Real-time balances. Support when you need it.</p>
        </div>
      </aside>
    </div>
  );
}
