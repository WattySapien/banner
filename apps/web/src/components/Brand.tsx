import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-3 font-semibold tracking-[-0.02em]", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-[0_8px_24px_rgba(21,77,61,0.2)]">C</span>
      {!compact && <span className="text-lg">ClipX</span>}
    </Link>
  );
}
