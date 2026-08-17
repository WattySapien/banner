import { useEffect, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Brand } from "@/components/Brand";
import { ThemeMenu } from "@/components/ThemeMenu";

type AuthLayoutProps = {
  children: ReactNode;
};

const loginSlides = [
  {
    src: "/happy-mature-woman-using-mobile-phone-on-sofa-at-home.webp",
    alt: "Ardenvia Bank customer checking her account on a phone",
    eyebrow: "Banking that fits your day",
  },
  {
    src: "/mature-woman-working-from-the-comfort-of-her-home.webp",
    alt: "Ardenvia Bank customer reviewing finances on a laptop",
    eyebrow: "A calm view of what matters",
  },
  {
    src: "/smiling-senior-woman-using-smart-phone-while-sitting-on-sofa-at-home.webp",
    alt: "Ardenvia Bank customer managing money on a smartphone",
    eyebrow: "Confidence at every tap",
  },
  {
    src: "/enjoying-his-studies.webp",
    alt: "Ardenvia Bank customer planning ahead with a notebook",
    eyebrow: "Plans made clearer",
  },
  {
    src: "/kicking-off-the-start-up.webp",
    alt: "Ardenvia Bank customer building a new business",
    eyebrow: "Built for your next move",
  },
  {
    src: "/man-working-on-a-laptop-picture-id518220805.webp",
    alt: "Ardenvia Bank customer working securely on a laptop",
    eyebrow: "Your money, in focus",
  },
] as const;

export default function AuthLayout({ children }: AuthLayoutProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setActiveSlide((slide) => (slide + 1) % loginSlides.length), 5200);
    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  const slide = loginSlides[activeSlide];

  return (
    <div className="grid min-h-[100dvh] bg-background/80 lg:grid-cols-[0.9fr_1.1fr] lg:p-4">
      <main id="main-content" className="flex min-h-[100dvh] flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-10 lg:px-14">
        <div className="flex items-center justify-between gap-4"><Brand /><ThemeMenu /></div>
        <div className="my-auto w-full max-w-md self-center py-8 sm:py-12">{children}</div>
        <p className="text-xs text-muted-foreground">© 2026 Ardenvia Bank · <a href="#" className="hover:text-foreground">Privacy</a> · <a href="#" className="hover:text-foreground">Terms</a></p>
      </main>
      <aside className="relative hidden overflow-hidden rounded-2xl bg-[#211a3a] lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,#5b3d9b_0%,transparent_42%),linear-gradient(145deg,#211a3a,#342653)]" />
        <div className="absolute inset-x-8 top-8 bottom-8 overflow-hidden rounded-[1.4rem] border border-white/15 bg-black/15 shadow-[0_28px_80px_rgba(12,7,27,.38)] xl:inset-x-12 xl:top-12 xl:bottom-12">
          <AnimatePresence initial={false} mode="wait">
            <motion.img
              key={slide.src}
              src={slide.src}
              alt={slide.alt}
              initial={reduceMotion ? { opacity: 1 } : { x: "18%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { x: "-10%", opacity: 0 }}
              transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </AnimatePresence>
          <div className="absolute inset-0 bg-gradient-to-t from-[#211a3a] via-transparent to-black/5" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-white xl:p-9">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">{slide.eyebrow}</p>
            <blockquote className="mt-3 max-w-xl text-2xl font-medium leading-tight tracking-[-0.035em] xl:text-3xl">A clearer view of your money, with fewer things getting in the way.</blockquote>
            <p className="mt-4 text-sm text-white/65">Simple controls. Real-time balances. Support when you need it.</p>
            <div className="mt-6 flex items-center gap-2" aria-label="Login panel images">
              {loginSlides.map((item, index) => (
                <button
                  key={item.src}
                  type="button"
                  aria-label={`Show image ${index + 1}`}
                  aria-current={index === activeSlide ? "true" : undefined}
                  onClick={() => setActiveSlide(index)}
                  className={`h-1.5 rounded-full transition-all ${index === activeSlide ? "w-8 bg-white" : "w-1.5 bg-white/45 hover:bg-white/75"}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="absolute right-12 top-12 z-10 grid size-11 place-items-center rounded-xl bg-white/15 text-white shadow-lg backdrop-blur xl:right-16 xl:top-16"><ShieldCheck className="size-5" /></div>
      </aside>
    </div>
  );
}
