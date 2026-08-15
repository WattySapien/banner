import { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  Bell,
  CreditCard,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Menu,
  Moon,
  Settings,
  Sun,
  WalletCards,
  X,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@clipx/contracts/schema";
import { cn } from "@/lib/utils";

const navigation = [
  { label: "Home", to: "/dashboard", icon: LayoutDashboard },
  { label: "Accounts", to: "/accounts", icon: WalletCards },
  { label: "Transfer", to: "/transfer", icon: ArrowLeftRight },
  { label: "Cards", to: "/cards", icon: CreditCard },
  { label: "Activity", to: "/activity", icon: ListFilter },
];

export default function BankingLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() => localStorage.getItem("clipx-theme") === "dark");
  const { user, signOut } = useAuth();
  const { data: accountUser } = useQuery<User>({ queryKey: ["/api/auth/user"] });
  const initials = `${accountUser?.firstName?.[0] ?? ""}${accountUser?.lastName?.[0] ?? ""}` || "LA";
  const isAdmin = Boolean(user?.isAdmin);
  const showAdminConsole = isAdmin && import.meta.env.DEV;
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("clipx-theme", dark ? "dark" : "light");
  }, [dark]);

  const logout = async () => {
    await signOut();
    navigate("/login");
  };

  const Sidebar = () => (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center justify-between px-5">
        <Brand />
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
          <X className="size-5" />
        </Button>
      </div>

      <nav className="mt-5 space-y-1 px-3" aria-label="Account navigation">
        {navigation.map(({ label, to, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => cn(
              "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:translate-y-px",
              isActive && "bg-primary/10 text-primary",
            )}
          >
            <Icon className="size-[18px]" strokeWidth={1.8} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto p-3">
        {showAdminConsole && (
          <NavLink to="/admin" className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
            <ShieldCheck className="size-[18px]" strokeWidth={1.8} /> Admin console
          </NavLink>
        )}
        <NavLink to="/settings" onClick={() => setMobileOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground", isActive && "bg-primary/10 text-primary")}>
          <Settings className="size-[18px]" strokeWidth={1.8} /> Settings
        </NavLink>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="size-[18px]" strokeWidth={1.8} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block"><Sidebar /></aside>
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] border-r bg-card transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}><Sidebar /></aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b bg-background/92 px-4 backdrop-blur-md sm:px-6 lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></Button>
          <div className="hidden lg:block">
            <p className="text-sm text-muted-foreground">Personal banking</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} aria-label={dark ? "Use light theme" : "Use dark theme"}>
              {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </Button>
            <Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="size-5" /></Button>
            <div className="ml-1 hidden items-center gap-3 border-l pl-4 sm:flex">
              <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{initials}</div>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{accountUser?.firstName ?? user?.firstName ?? "Account"}</p>
                <p className="text-xs text-muted-foreground">Personal</p>
              </div>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1440px] px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
