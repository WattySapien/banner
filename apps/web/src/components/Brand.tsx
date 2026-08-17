import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

export function Brand({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { user } = useAuth();
  const destination = user ? (user.isAdmin ? "/admin" : "/dashboard") : "/";

  return (
    <Link to={destination} className={cn("inline-flex items-center gap-3 font-semibold tracking-[-0.02em]", className)} aria-label={user ? "Open dashboard" : "Open Ardenvia Bank home"}>
      <img src="/ardenvia-icon.svg" alt="" aria-hidden="true" className="size-9 rounded-xl shadow-[0_10px_28px_hsl(258_82%_63%/.26)]" />
      {!compact && <span className="text-lg">Ardenvia Bank</span>}
    </Link>
  );
}
