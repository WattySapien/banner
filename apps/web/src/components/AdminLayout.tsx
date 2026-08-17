import { NavLink, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft, LayoutDashboard, LogOut, Users } from "lucide-react";
import { Brand } from "@/components/Brand";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@clipx/contracts/schema";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { ThemeMenu } from "@/components/ThemeMenu";
import { NotificationCenter } from "@/components/NotificationCenter";

const adminNavigation = [
  { label: "Overview", to: "/admin", icon: LayoutDashboard, end: true },
  { label: "Customers", to: "/admin/users", icon: Users },
  { label: "Transactions", to: "/admin/transactions", icon: Activity },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const {data:accountUser}=useQuery<User>({queryKey:["/api/auth/user"]});
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-[100dvh] bg-background/80 text-foreground">
      <header className="sticky top-0 z-30 px-0 backdrop-blur-xl lg:px-5 lg:pt-4">
        <div className="mx-auto flex min-h-16 max-w-[1500px] flex-wrap items-center gap-2 border-b bg-card/95 px-3 py-2 shadow-sm sm:gap-5 sm:px-5 lg:min-h-[4.5rem] lg:flex-nowrap lg:rounded-2xl lg:border lg:px-6 lg:shadow-[0_18px_55px_hsl(248_20%_12%/.08)]">
          <Brand />
          <span className="hidden border-l pl-5 text-sm font-medium text-muted-foreground sm:block">Operations console</span>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto border-t pt-2 lg:order-none lg:mx-auto lg:w-auto lg:border-0 lg:pt-0" aria-label="Admin navigation">
            {adminNavigation.map(({ label, to, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground", isActive && "bg-accent text-primary")}>
                <Icon className="size-4" strokeWidth={1.8} />{label}
              </NavLink>
            ))}
            <NavLink to="/dashboard" className="flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden">
              <ArrowLeft className="size-4" />Customer view
            </NavLink>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button asChild variant="ghost" size="icon" className="hidden lg:inline-flex" title="Customer view"><NavLink to="/dashboard" aria-label="Open customer view"><ArrowLeft className="size-[18px]" /></NavLink></Button>
            <ThemeMenu />
            <NotificationCenter />
            <div className="ml-2 hidden border-l pl-4 text-right sm:block">
              <p className="text-sm font-semibold">{user?.firstName ?? "Administrator"}</p>
              <p className="text-xs text-muted-foreground">Administrator</p>
            </div>
            <ProfileAvatar src={accountUser?.profileImageUrl} userId={accountUser?.id} initials={`${accountUser?.firstName?.[0]??""}${accountUser?.lastName?.[0]??""}`||"CX"} alt={`${accountUser?.firstName??"Administrator"} profile`} className="ml-2 size-9"/>
            <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out"><LogOut className="size-[18px]" /></Button>
          </div>
        </div>
      </header>
      <main id="main-content" className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8"><BreadcrumbNav scope="admin"/>{children}</main>
    </div>
  );
}
