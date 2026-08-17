import {useState} from "react";
import {useMutation,useQuery} from "@tanstack/react-query";
import {Bell,CheckCheck,CreditCard,MessageCircle} from "lucide-react";
import {useNavigate} from "react-router-dom";
import type {AppNotification} from "@clipx/contracts/banking";
import {Button} from "@/components/ui/button";
import {Popover,PopoverContent,PopoverTrigger} from "@/components/ui/popover";
import {apiRequest} from "@/lib/api";
import {queryClient} from "@/lib/queryClient";
import {useAuth} from "@/contexts/AuthContext";

export function NotificationCenter(){
  const [open,setOpen]=useState(false);
  const navigate=useNavigate();
  const {user}=useAuth();
  const {data:notifications=[],isLoading}=useQuery<AppNotification[]>({queryKey:["/api/notifications"],staleTime:10_000,refetchInterval:15_000,refetchIntervalInBackground:false});
  const unreadCount=notifications.filter((notification)=>!notification.isRead).length;
  const readOne=useMutation({
    mutationFn:(id:string)=>apiRequest(`/api/notifications/${id}/read`,"PATCH") as Promise<AppNotification>,
    onSuccess:(updated)=>queryClient.setQueryData<AppNotification[]>(["/api/notifications"],(current=[])=>current.map((notification)=>notification.id===updated.id?updated:notification)),
  });
  const readAll=useMutation({
    mutationFn:()=>apiRequest("/api/notifications/read-all","PATCH"),
    onSuccess:()=>queryClient.setQueryData<AppNotification[]>(["/api/notifications"],(current=[])=>current.map((notification)=>({...notification,isRead:true}))),
  });
  const openNotification=(notification:AppNotification)=>{
    if(!notification.isRead)readOne.mutate(notification.id);
    setOpen(false);
    if(notification.type==="card_issued")navigate("/cards");
    if(notification.type==="support_message")navigate(user?.isAdmin?`/admin/users/${notification.resourceId}/communications`:"/dashboard");
  };

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild>
      <Button variant="ghost" size="icon" className="relative" aria-label={unreadCount?`Notifications, ${unreadCount} unread`:"Notifications"}>
        <Bell className="size-5"/>
        {unreadCount>0&&<span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-4 text-destructive-foreground ring-2 ring-background" aria-hidden="true">{unreadCount>9?"9+":unreadCount}</span>}
      </Button>
    </PopoverTrigger>
    <PopoverContent align="end" sideOffset={8} collisionPadding={8} className="w-[min(22rem,calc(100vw-1rem))] overflow-hidden rounded-2xl p-0 shadow-[0_20px_60px_hsl(var(--foreground)/.14)]">
      <div className="flex items-center justify-between border-b px-4 py-3.5">
        <div><h2 className="text-sm font-semibold">Notifications</h2><p className="mt-0.5 text-xs text-muted-foreground" aria-live="polite">{unreadCount?`${unreadCount} unread`:"You are all caught up"}</p></div>
        {unreadCount>0&&<Button type="button" variant="ghost" size="sm" className="px-2 text-xs" onClick={()=>readAll.mutate()} disabled={readAll.isPending}><CheckCheck className="mr-1.5 size-4"/>Mark all read</Button>}
      </div>
      <div className="max-h-[min(26rem,65dvh)] overflow-y-auto overscroll-contain">
        {isLoading?<NotificationSkeleton/>:notifications.length===0?<div className="px-6 py-10 text-center"><div className="mx-auto grid size-11 place-items-center rounded-xl bg-muted"><Bell className="size-5 text-muted-foreground"/></div><p className="mt-4 text-sm font-semibold">No notifications yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Card and account updates will appear here.</p></div>:notifications.map((notification)=><button key={notification.id} type="button" onClick={()=>openNotification(notification)} className="relative flex min-h-[4.75rem] w-full items-start gap-3 border-b px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring active:bg-muted/70">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{notification.type==="support_message"?<MessageCircle className="size-[18px]" strokeWidth={1.8}/>:<CreditCard className="size-[18px]" strokeWidth={1.8}/>}</span>
          <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-sm font-semibold leading-5">{notification.title}</span><span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(notification.createdAt)}</span></span><span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{notification.message}</span></span>
          {!notification.isRead&&<span className="absolute left-1.5 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-primary" aria-label="Unread"/>}
        </button>)}
      </div>
    </PopoverContent>
  </Popover>;
}

function relativeTime(value:string){
  const elapsed=Math.max(0,Date.now()-new Date(value).getTime());
  const minutes=Math.floor(elapsed/60_000);
  if(minutes<1)return"Now";
  if(minutes<60)return`${minutes}m`;
  const hours=Math.floor(minutes/60);
  if(hours<24)return`${hours}h`;
  const days=Math.floor(hours/24);
  return days<7?`${days}d`:new Date(value).toLocaleDateString(undefined,{month:"short",day:"numeric"});
}

function NotificationSkeleton(){return <div className="animate-pulse space-y-px">{[0,1,2].map((item)=><div key={item} className="flex gap-3 px-4 py-3.5"><div className="size-10 rounded-xl bg-muted"/><div className="flex-1 space-y-2"><div className="h-3.5 w-2/3 rounded bg-muted"/><div className="h-3 w-full rounded bg-muted"/></div></div>)}</div>;}
