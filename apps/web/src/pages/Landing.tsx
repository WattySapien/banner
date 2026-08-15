import { ArrowRight, BadgeCheck, CreditCard, Fingerprint, MoveUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";

const features = [
  { icon: CreditCard, title: "Cards that stay in your control", copy: "Freeze a card in seconds, set practical limits, and keep a virtual card for online payments." },
  { icon: MoveUpRight, title: "Transfers without the guesswork", copy: "See the recipient, amount, and fee together before any money leaves your account." },
  { icon: Fingerprint, title: "Security built into every step", copy: "Protected access and clear activity records help you spot anything that does not look right." },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-[#f5f6f2] text-[#14251f]">
      <nav className="mx-auto flex h-20 max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12" aria-label="Main navigation">
        <Brand />
        <div className="flex items-center gap-2"><Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/signup">Open an account</Link></Button></div>
      </nav>

      <main id="main-content">
        <section className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-10 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:px-12 lg:pb-24 lg:pt-16">
          <div className="relative z-10 lg:pr-8">
            <p className="mb-6 flex items-center gap-2 text-sm font-medium"><BadgeCheck className="size-4 text-primary" />Banking made easier to read</p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[0.96] tracking-[-0.06em] sm:text-6xl xl:text-[5.5rem]">Your money, without the noise.</h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-[#52625c] sm:text-lg">Manage everyday spending, savings, transfers, and cards from one calm, straightforward account.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><Button asChild size="lg"><Link to="/signup">Open an account <ArrowRight className="ml-2 size-4" /></Link></Button><Link to="/login" className="text-sm font-semibold underline-offset-4 hover:underline">Explore the demo</Link></div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t border-[#14251f]/10 pt-5 text-xs text-[#66736e]"><span>No monthly fee</span><span>Instant card controls</span><span>24/7 account access</span></div>
          </div>
          <div className="relative min-h-[28rem] overflow-hidden rounded-[1.75rem] bg-[#d9ddd6] lg:min-h-[38rem]">
            <img src="/banking-hero.png" alt="ClipX customer reviewing his finances at home" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-2xl border border-white/50 bg-white/88 p-5 shadow-[0_20px_60px_rgba(20,37,31,.15)] backdrop-blur-md sm:bottom-7 sm:left-7">
              <p className="text-xs font-medium text-[#1f654c]">One clear account view</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Balances, cards, and activity stay together.</p>
              <p className="mt-2 text-xs leading-relaxed text-[#66736e]">Your figures appear only after you sign in.</p>
            </div>
          </div>
        </section>

        <section className="bg-[#14251f] px-5 py-20 text-[#f5f6f2] sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1344px]"><div className="grid gap-6 border-b border-white/12 pb-10 md:grid-cols-[0.7fr_1fr] md:items-end"><p className="text-sm text-white/55">The essentials, handled well</p><h2 className="max-w-3xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">Built around what you actually do with your money.</h2></div>
            <div className="grid gap-px overflow-hidden rounded-2xl bg-white/12 lg:grid-cols-3">{features.map(({ icon: Icon, title, copy }, index) => <article key={title} className="bg-[#14251f] p-7 sm:p-9"><span className="font-mono text-xs text-white/35">0{index + 1}</span><Icon className="mt-16 size-6 text-[#8fbea9]" strokeWidth={1.6} /><h3 className="mt-7 text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-white/58">{copy}</p></article>)}</div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto flex max-w-[1344px] flex-col gap-8 rounded-[1.75rem] bg-[#dfe7df] p-8 sm:p-12 lg:flex-row lg:items-end lg:justify-between lg:p-16"><div><p className="text-sm font-medium text-primary">Ready when you are</p><h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">A better place for everyday money.</h2></div><Button asChild size="lg"><Link to="/signup">Get started <ArrowRight className="ml-2 size-4" /></Link></Button></div></section>
      </main>

      <footer className="border-t border-[#14251f]/10 px-5 py-7 text-xs text-[#66736e] sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1344px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 ClipX. All rights reserved.</p><div className="flex gap-5"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Accessibility</a></div></div></footer>
    </div>
  );
}
