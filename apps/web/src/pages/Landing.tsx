import { useRef } from "react";
import { ArrowRight, BadgeCheck, CreditCard, Fingerprint, MoveUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ThemeMenu } from "@/components/ThemeMenu";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const features = [
  { icon: CreditCard, title: "Cards that stay in your control", copy: "Freeze a card in seconds, set practical limits, and keep a virtual card for online payments.", glow: "bg-violet-400/30", iconColor: "text-violet-300" },
  { icon: MoveUpRight, title: "Transfers without the guesswork", copy: "See the recipient, amount, and fee together before any money leaves your account.", glow: "bg-fuchsia-400/25", iconColor: "text-fuchsia-300" },
  { icon: Fingerprint, title: "Security built into every step", copy: "Protected access and clear activity records help you spot anything that does not look right.", glow: "bg-cyan-400/25", iconColor: "text-cyan-300" },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] bg-background/80 text-foreground">
      <nav className="sticky top-4 z-30 mx-4 mt-4 flex h-16 max-w-[1344px] items-center justify-between rounded-2xl border bg-card/95 px-4 shadow-[0_18px_55px_hsl(248_20%_12%/.08)] backdrop-blur-xl sm:mx-8 sm:px-6 lg:mx-auto" aria-label="Main navigation">
        <Brand />
        <div className="flex items-center gap-1 sm:gap-2"><ThemeMenu/><Button asChild variant="ghost" className="hidden sm:inline-flex"><Link to="/login">Sign in</Link></Button><Button asChild><Link to="/signup"><span className="min-[360px]:hidden">Open</span><span className="hidden min-[360px]:inline">Open an account</span></Link></Button></div>
      </nav>

      <main id="main-content">
        <section className="mx-auto grid max-w-[1440px] gap-10 px-5 pb-14 pt-16 sm:px-8 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:px-12 lg:pb-24 lg:pt-20">
          <div className="relative z-10 lg:pr-8">
            <p className="mb-6 flex items-center gap-2 text-sm font-medium"><BadgeCheck className="size-4 text-primary" />Banking made easier to read</p>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[0.96] tracking-[-0.06em] sm:text-6xl xl:text-[5.5rem]">Your money, without the noise.</h1>
            <p className="mt-7 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">Manage everyday spending, savings, transfers, and cards from one calm, straightforward account.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4"><Button asChild size="lg"><Link to="/signup">Open an account <ArrowRight className="ml-2 size-4" /></Link></Button><Link to="/login" className="text-sm font-semibold underline-offset-4 hover:underline">Explore the demo</Link></div>
            <div className="mt-12 flex flex-wrap gap-x-7 gap-y-3 border-t pt-5 text-xs text-muted-foreground"><span>No monthly fee</span><span>Instant card controls</span><span>24/7 account access</span></div>
          </div>
          <div className="relative min-h-[28rem] overflow-hidden rounded-[1.75rem] bg-secondary lg:min-h-[38rem]">
            <img src="/banking-hero.png" alt="ClipX customer reviewing his finances at home" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute bottom-5 left-5 right-5 max-w-sm rounded-2xl border border-white/60 bg-white/90 p-5 text-[#211a3a] shadow-[0_20px_60px_hsl(258_60%_32%/.16)] backdrop-blur-md sm:bottom-7 sm:left-7">
              <p className="text-xs font-medium text-[#7650db]">One clear account view</p>
              <p className="mt-2 text-lg font-semibold tracking-tight">Balances, cards, and activity stay together.</p>
              <p className="mt-2 text-xs leading-relaxed text-[#6d6879]">Your figures appear only after you sign in.</p>
            </div>
          </div>
        </section>

        <MotionMarquee />

        <section className="bg-[#211a3a] px-5 py-20 text-white sm:px-8 lg:px-12 lg:py-28">
          <div className="mx-auto max-w-[1344px]"><div className="grid gap-6 border-b border-white/12 pb-10 md:grid-cols-[0.7fr_1fr] md:items-end"><p className="text-sm text-white/55">The essentials, handled well</p><ScrubHeading text="Built around what you actually do with your money." /></div>
            <FeatureAccordion />
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 lg:px-12 lg:py-28"><div className="mx-auto flex max-w-[1344px] flex-col gap-8 rounded-[1.75rem] border bg-secondary p-8 sm:p-12 lg:flex-row lg:items-end lg:justify-between lg:p-16"><div><p className="text-sm font-medium text-primary">Ready when you are</p><h2 className="mt-3 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-5xl">A better place for everyday money.</h2></div><Button asChild size="lg"><Link to="/signup">Get started <ArrowRight className="ml-2 size-4" /></Link></Button></div></section>
      </main>

      <footer className="border-t px-5 py-7 text-xs text-muted-foreground sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1344px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p>© 2026 ClipX. All rights reserved.</p><div className="flex gap-5"><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Accessibility</a></div></div></footer>
    </div>
  );
}

function MotionMarquee() {
  const scope = useRef<HTMLDivElement>(null);
  const items = ["Instant account transfers", "Private card controls", "Clear transaction records", "Live account notifications", "Protected customer access"];

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to("[data-marquee-track]", { xPercent: -50, duration: 24, repeat: -1, ease: "none", force3D: true });
    });
    return () => media.revert();
  }, { scope });

  return <section ref={scope} className="overflow-hidden border-y bg-card/70 py-4 backdrop-blur-md" aria-label="ClipX account features"><div data-marquee-track className="flex w-max will-change-transform">{[0, 1].map((copy) => <div key={copy} className="flex shrink-0 items-center">{items.map((item, index) => <div key={`${copy}-${item}`} className="flex items-center"><span className="whitespace-nowrap px-6 text-sm font-medium tracking-[-0.01em] sm:px-10 sm:text-base">{item}</span><span className={`size-2 rounded-full ${index % 3 === 0 ? "bg-primary" : index % 3 === 1 ? "bg-fuchsia-400" : "bg-cyan-400"}`} /></div>)}</div>)}</div></section>;
}

function ScrubHeading({ text }: { text: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useGSAP(() => {
    const words = heading.current?.querySelectorAll("span");
    if (!words?.length || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(words, { opacity: 0.16, y: 9, filter: "blur(3px)" }, { opacity: 1, y: 0, filter: "blur(0px)", stagger: 0.08, ease: "none", scrollTrigger: { trigger: heading.current, start: "top 88%", end: "bottom 54%", scrub: 0.7 } });
  }, { scope: heading });

  return <h2 ref={heading} className="max-w-3xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-5xl">{text.split(" ").map((word, index) => <span key={`${word}-${index}`} className="mr-[0.22em] inline-block">{word}</span>)}</h2>;
}

function FeatureAccordion() {
  const scope = useRef<HTMLDivElement>(null);
  const stackTops = ["top-24", "top-28", "top-32"];

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(max-width: 1023px) and (prefers-reduced-motion: no-preference)", () => {
      const panels = gsap.utils.toArray<HTMLElement>("[data-feature-panel]", scope.current ?? undefined);
      panels.forEach((panel, index) => {
        gsap.set(panel, { zIndex: index + 1, transformOrigin: "50% 0%" });
        gsap.to(panel, { scale: 0.94, opacity: 0.62, ease: "none", scrollTrigger: { trigger: panel, start: `top ${96 + index * 16}px`, end: "bottom top", scrub: 0.65 } });
      });
    });
    return () => media.revert();
  }, { scope });

  return <div ref={scope} className="feature-accordion mt-10 grid grid-flow-dense gap-3 lg:grid-cols-3">{features.map(({ icon: Icon, title, copy, glow, iconColor }, index) => <article data-feature-panel key={title} className={`feature-panel ${stackTops[index]} sticky isolate min-h-72 overflow-hidden rounded-2xl border border-white/10 bg-[#211a3a] p-7 shadow-[0_24px_70px_rgba(8,5,18,.24)] lg:static sm:p-9`}><span className={`absolute -right-16 -top-16 -z-10 size-48 rounded-full blur-3xl ${glow}`} /><Icon className={`mt-8 size-7 ${iconColor}`} strokeWidth={1.6} /><h3 className="mt-12 max-w-xs text-xl font-semibold tracking-tight">{title}</h3><p className="mt-3 max-w-sm text-sm leading-relaxed text-white/58">{copy}</p></article>)}</div>;
}
