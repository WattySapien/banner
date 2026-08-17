import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";

export function FluidBackdrop() {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference) and (min-width: 768px)", () => {
      const blobs = gsap.utils.toArray<HTMLElement>("[data-fluid-blob]", scope.current ?? undefined);
      const movements = [
        { x: "18vw", y: "13vh", scale: 1.18, duration: 14 },
        { x: "-16vw", y: "18vh", scale: 1.24, duration: 17 },
        { x: "12vw", y: "-16vh", scale: 1.12, duration: 20 },
      ];

      blobs.forEach((blob, index) => {
        gsap.to(blob, {
          ...(movements[index] ?? movements[0]),
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
          force3D: true,
        });
      });
    });
    return () => media.revert();
  }, { scope });

  return (
    <div ref={scope} className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <span data-fluid-blob className="fluid-blob -left-[12rem] -top-[14rem] size-[34rem] bg-primary/30" />
      <span data-fluid-blob className="fluid-blob -right-[16rem] top-[18%] size-[38rem] bg-fuchsia-400/20 dark:bg-fuchsia-500/15" />
      <span data-fluid-blob className="fluid-blob bottom-[-18rem] left-[24%] size-[40rem] bg-cyan-300/20 dark:bg-cyan-500/10" />
    </div>
  );
}
