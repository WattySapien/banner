import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronRight, Search, ShieldCheck, UserRoundCheck, UserRoundX } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import type { AdminCustomer, UpdateAdminUser } from "@clipx/contracts/admin";
import { Button } from "@/components/ui/button";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import { formatCurrency } from "@/lib/banking";
import { queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "inactive" | "admins";

export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const { toast } = useToast();
  const navigate = useNavigate();
  const { data: users = [], isLoading } = useQuery<AdminCustomer[]>({ queryKey: ["/api/admin/users"] });

  const updateUser = useMutation({
    mutationFn: ({ id, update }: { id: string; update: UpdateAdminUser }) => apiRequest(`/api/admin/users/${id}`, "PATCH", update) as Promise<AdminCustomer>,
    onSuccess: (updated) => {
      queryClient.setQueryData<AdminCustomer[]>(["/api/admin/users"], (current = []) => current.map((user) => user.id === updated.id ? updated : user));
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      toast({ title: "Customer updated", description: `${updated.firstName} ${updated.lastName}'s access was updated.` });
    },
    onError: (error: Error) => toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const filteredUsers = useMemo(() => users.filter((user) => {
    const matchesSearch = `${user.firstName} ${user.lastName} ${user.email}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesFilter = filter === "all" || (filter === "active" && user.isActive) || (filter === "inactive" && !user.isActive) || (filter === "admins" && user.isAdmin);
    return matchesSearch && matchesFilter;
  }), [filter, search, users]);

  return (
    <div className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm text-muted-foreground">Access and permissions</p><h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Customers</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">Search customer records, suspend account access, and control administrative permissions.</p></div>
        <Button className="w-full sm:w-auto" asChild><Link to="/admin/users/new"><UserRoundCheck className="mr-2 size-4"/>Add customer</Link></Button>
      </header>

      <section className="rounded-2xl border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="pl-9" aria-label="Search customers" /></div>
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted/70 p-1" aria-label="Filter customers">
            {(["all", "active", "inactive", "admins"] as Filter[]).map((item) => <button key={item} onClick={() => setFilter(item)} className={cn("shrink-0 rounded-md px-3 py-1.5 text-xs font-medium capitalize text-muted-foreground transition-colors", filter === item && "bg-card text-foreground shadow-sm")}>{item}</button>)}
          </div>
        </div>

        {isLoading ? <UserListSkeleton /> : filteredUsers.length === 0 ? (
          <div className="px-6 py-16 text-center"><Search className="mx-auto size-6 text-muted-foreground" /><h2 className="mt-4 font-semibold">No matching customers</h2><p className="mt-1 text-sm text-muted-foreground">Adjust the search or account filter.</p></div>
        ) : (
          <div className="divide-y">
            {filteredUsers.map((user) => (
              <article key={user.id} role="link" tabIndex={0} onClick={() => navigate(`/admin/users/${user.id}`)} onKeyDown={(event) => { if (event.key === "Enter") navigate(`/admin/users/${user.id}`); }} className="group grid cursor-pointer gap-5 p-4 transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:p-5 lg:grid-cols-[minmax(16rem,1.2fr)_0.7fr_0.7fr_auto] lg:items-center">
                <div className="flex min-w-0 items-center gap-3">
                  <ProfileAvatar src={user.profileImageUrl} initials={user.initials} alt={`${user.firstName} ${user.lastName} profile`} className="size-11"/>
                  <div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate text-sm font-semibold">{user.firstName} {user.lastName}</h2>{user.isAdmin && <ShieldCheck className="size-4 shrink-0 text-primary" aria-label="Administrator" />}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p></div>
                </div>
                <div><p className="text-xs text-muted-foreground">Managed balance</p><p className="mt-1 font-mono text-sm font-semibold tabular-nums">{formatCurrency(user.balance)}</p></div>
                <div><p className="text-xs text-muted-foreground">Last active</p><p className="mt-1 text-sm font-medium">{formatRelativeDate(user.lastActiveAt)}</p></div>
                <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap lg:justify-end">
                  <span className={cn("rounded-md px-2 py-1 text-xs font-medium", user.isActive ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>{user.isActive ? "Active" : "Suspended"}</span>
                  <Button variant="outline" size="sm" disabled={updateUser.isPending} onClick={(event) => { event.stopPropagation(); updateUser.mutate({ id: user.id, update: { isActive: !user.isActive } }); }}>
                    {user.isActive ? <UserRoundX className="mr-2 size-4" /> : <UserRoundCheck className="mr-2 size-4" />}{user.isActive ? "Suspend" : "Restore"}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={updateUser.isPending} onClick={(event) => { event.stopPropagation(); updateUser.mutate({ id: user.id, update: { isAdmin: !user.isAdmin } }); }}>{user.isAdmin ? "Remove admin" : "Make admin"}</Button>
                  <ChevronRight className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" aria-hidden="true" />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <p className="text-xs text-muted-foreground">{filteredUsers.length} of {users.length} accounts shown. Select a customer to review and edit the full account record.</p>
    </div>
  );
}

function formatRelativeDate(value: string) {
  const date = new Date(value);
  const difference = Date.now() - date.getTime();
  if (difference < 86_400_000) return "Today";
  if (difference < 172_800_000) return "Yesterday";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

function UserListSkeleton() {
  return <div className="divide-y animate-pulse">{[0, 1, 2, 3].map((item) => <div key={item} className="flex items-center gap-4 p-5"><div className="size-11 rounded-xl bg-muted"/><div className="space-y-2"><div className="h-4 w-36 rounded bg-muted"/><div className="h-3 w-48 rounded bg-muted"/></div></div>)}</div>;
}
