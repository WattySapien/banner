import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight,
  CreditCard,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Menu,
  UserRound,
  WalletCards,
  X,
  ShieldCheck,
} from "lucide-react";
import { Brand } from "@/components/Brand";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeMenu } from "@/components/ThemeMenu";
import { ContactSupport } from "@/components/ContactSupport";
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
  const { user, signOut } = useAuth();
  const { data: accountUser } = useQuery<User>({ queryKey: ["/api/auth/user"], staleTime: 15_000, refetchInterval: 30_000, refetchOnMount: true });
  const initials = `${accountUser?.firstName?.[0] ?? ""}${accountUser?.lastName?.[0] ?? ""}` || "LA";
  const isAdmin = Boolean(user?.isAdmin);
  const showAdminConsole = isAdmin && import.meta.env.DEV;
  const navigate = useNavigate();

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
        <NavLink to="/account" onClick={() => setMobileOpen(false)} className={({ isActive }) => cn("flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground", isActive && "bg-primary/10 text-primary")}>
          <UserRound className="size-[18px]" strokeWidth={1.8} /> Account
        </NavLink>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground">
          <LogOut className="size-[18px]" strokeWidth={1.8} /> Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background/80 text-foreground">
      {mobileOpen && <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside className={cn("fixed inset-y-0 left-0 z-50 w-[min(19rem,86vw)] border-r bg-card shadow-2xl transition-transform lg:hidden", mobileOpen ? "translate-x-0" : "-translate-x-full")}><Sidebar /></aside>

      <div>
        <header className="sticky top-0 z-30 px-0 backdrop-blur-xl lg:px-5 lg:pt-4">
          <div className="mx-auto flex h-16 max-w-[1480px] items-center border-b bg-card/95 px-3 shadow-sm sm:px-5 lg:h-[4.5rem] lg:rounded-2xl lg:border lg:px-6 lg:shadow-[0_18px_55px_hsl(248_20%_12%/.08)]">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu className="size-5" /></Button>
            <div className="ml-1 lg:ml-0"><Brand /></div>

            <nav className="mx-auto hidden items-center gap-1 lg:flex" aria-label="Primary account navigation">
              {navigation.map(({ label, to, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) => cn(
                    "flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                    isActive && "bg-accent text-primary",
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.8} />
                  {label}
                </NavLink>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
              {showAdminConsole && (
                <Button asChild variant="ghost" size="icon" className="hidden lg:inline-flex" title="Admin console">
                  <NavLink to="/admin" aria-label="Open admin console"><ShieldCheck className="size-[18px]" /></NavLink>
                </Button>
              )}
            <ThemeMenu />
            <NotificationCenter/>
            <NavLink to="/account" aria-label="Open account" className="ml-1 hidden items-center gap-3 rounded-xl border-l py-1 pl-4 pr-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex">
              <ProfileAvatar src={accountUser?.profileImageUrl} userId={accountUser?.id} initials={initials} alt={`${accountUser?.firstName??"Account"} profile`} className="size-9"/>
              <div className="leading-tight">
                <p className="text-sm font-semibold">{accountUser?.firstName ?? user?.firstName ?? "Account"}</p>
                <p className="text-xs text-muted-foreground">Personal</p>
              </div>
            </NavLink>
            <Button variant="ghost" size="icon" className="hidden sm:inline-flex" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut className="size-[18px]" />
            </Button>
            </div>
          </div>
        </header>
        <main id="main-content" className="mx-auto max-w-[1480px] px-4 pb-28 pt-5 sm:px-6 sm:pt-7 lg:px-8 lg:py-8"><BreadcrumbNav scope="banking"/>{children}</main>
      </div>
      <nav className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 px-1 pt-1 shadow-[0_-12px_35px_hsl(248_20%_12%/.07)] backdrop-blur-xl lg:hidden" aria-label="Primary account navigation">
        {navigation.map(({label,to,icon:Icon})=><NavLink key={to} to={to} className={({isActive})=>cn("flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium text-muted-foreground transition-colors active:scale-[.98]",isActive&&"bg-primary/10 text-primary")}><Icon className="size-[18px]" strokeWidth={1.8}/><span className="truncate">{label}</span></NavLink>)}
      </nav>
      <ContactSupport />
    </div>
  );
}
