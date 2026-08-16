import { useRef } from "react";
import { useLocation } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export function MotionController() {
  const { pathname } = useLocation();
  const animation = useRef<gsap.Context>();

  useGSAP(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const applicationRoot = document.getElementById("root");
    if (!applicationRoot) return;

    let frame = 0;
    const animatePage = () => {
      const main = document.querySelector<HTMLElement>("main#main-content");
      if (!main) return false;

      animation.current?.revert();
      animation.current = gsap.context(() => {
        const directChildren = Array.from(main.children).filter((element) => !element.classList.contains("absolute"));
        const entranceTargets = directChildren.length > 3 ? directChildren.slice(0, 1) : directChildren;

        gsap.timeline({ defaults: { ease: "power3.out" } })
          .fromTo(
            entranceTargets,
            { y: 28, clipPath: "inset(0 0 9% 0 round 1rem)" },
            { y: 0, clipPath: "inset(0 0 0% 0 round 1rem)", duration: 0.78, stagger: 0.08, clearProps: "transform,clipPath" },
          );

        const surfaces = gsap.utils.toArray<HTMLElement>("section, article", main).filter((surface) => !entranceTargets.some((target) => target === surface));
        ScrollTrigger.batch(surfaces, {
          start: "top 94%",
          once: true,
          interval: 0.08,
          batchMax: 4,
          onEnter: (batch) => gsap.fromTo(batch,
            { y: 34, scale: 0.985, transformOrigin: "50% 100%" },
            { y: 0, scale: 1, duration: 0.72, stagger: 0.075, ease: "power3.out", clearProps: "transform" },
          ),
        });

        const listRows = gsap.utils.toArray<HTMLElement>("tbody tr, [data-motion-list] > *", main);
        if (listRows.length) {
          gsap.fromTo(listRows, { x: -18 }, { x: 0, duration: 0.55, stagger: 0.045, ease: "power2.out", clearProps: "transform" });
        }
      }, main);

      ScrollTrigger.refresh();
      return true;
    };

    const tryAnimate = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (animatePage()) observer.disconnect();
      });
    };
    const observer = new MutationObserver(tryAnimate);
    observer.observe(applicationRoot, { childList: true, subtree: true });
    tryAnimate();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      animation.current?.revert();
      animation.current = undefined;
    };
  }, { dependencies: [pathname], revertOnUpdate: true });

  return null;
}
