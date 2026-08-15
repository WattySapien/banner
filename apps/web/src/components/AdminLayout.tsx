import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, LayoutDashboard, LogOut, Moon, Sun, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const adminNavigation = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Customers", to: "/admin/users", icon: Users },
  { label: "Transactions", to: "/admin/transactions", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => localStorage.getItem("clipx-theme") === "dark");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("clipx-theme", dark ? "dark" : "light");
  }, [dark]);

  const logout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-20 max-w-[1500px] items-center gap-5 px-4 sm:px-6 lg:px-8">
          <Brand />
          <span className="hidden border-l pl-5 text-sm font-medium text-muted-foreground sm:block">Operations console</span>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label={dark ? "Use light theme" : "Use dark theme"}>
              {dark ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
            </Button>
            <div className="ml-2 hidden border-l pl-4 text-right sm:block">
              <p className="text-sm font-semibold">{user?.firstName ?? "Administrator"}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-[18px]" /></Button>
          </div>
        </div>
      </header>

      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1500px] items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {adminNavigation.map(({ label, to, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("relative flex shrink-0 items-center gap-2 px-3 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground", isActive && "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-primary")}>
              <Icon className="size-4" strokeWidth={1.8} />{label}
            </NavLink>
          ))}
          <NavLink to="/dashboard" className="ml-auto flex shrink-0 items-center gap-2 px-3 py-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="size-4" />Customer view
          </NavLink>
        </div>
      </div>

      <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
    </div>
  );
}
