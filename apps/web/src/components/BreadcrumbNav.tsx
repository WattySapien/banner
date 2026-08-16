import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

type Breadcrumb={label:string;to?:string};

const bankingTrail=(pathname:string):Breadcrumb[]=>{
  const home:Breadcrumb={label:"Home",to:"/dashboard"};
  if(pathname==="/dashboard")return[{label:"Home"}];
  if(pathname==="/accounts")return[home,{label:"Accounts"}];
  if(pathname==="/transfer")return[home,{label:"Transfer"}];
  if(pathname==="/cards")return[home,{label:"Cards"}];
  if(pathname==="/account")return[home,{label:"Account"}];
  if(pathname==="/activity")return[home,{label:"Activity"}];
  if(pathname.startsWith("/activity/"))return[home,{label:"Activity",to:"/activity"},{label:"Transaction details"}];
  return[];
};

const adminTrail=(pathname:string):Breadcrumb[]=>{
  const overview:Breadcrumb={label:"Overview",to:"/admin"};
  const customers:Breadcrumb={label:"Customers",to:"/admin/users"};
  const transactions:Breadcrumb={label:"Transactions",to:"/admin/transactions"};
  if(pathname==="/admin")return[{label:"Overview"}];
  if(pathname==="/admin/users")return[overview,{label:"Customers"}];
  if(pathname==="/admin/users/new")return[overview,customers,{label:"Add customer"}];
  if(pathname.startsWith("/admin/users/"))return[overview,customers,{label:"Customer record"}];
  if(pathname==="/admin/transactions")return[overview,{label:"Transactions"}];
  if(pathname.startsWith("/admin/transactions/"))return[overview,transactions,{label:"Transaction details"}];
  return[];
};

export function BreadcrumbNav({scope}:{scope:"banking"|"admin"}){
  const {pathname}=useLocation();
  const trail=scope==="admin"?adminTrail(pathname):bankingTrail(pathname);
  const parent=trail.at(-2);
  const visibleTrail=parent?.to?trail.slice(-1):trail;
  if(trail.length===0)return null;

  return <div className={`mb-5 min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:mb-6 sm:flex sm:text-sm ${parent?.to?"flex":"hidden"}`}>
    {parent?.to&&<Link to={parent.to} className="inline-flex shrink-0 items-center gap-1.5 font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><ArrowLeft className="size-3.5"/>Back</Link>}
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
        {visibleTrail.map((crumb,index)=>{
          const isCurrent=index===visibleTrail.length-1;
          return <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
            {index>0&&<ChevronRight className="size-3.5 shrink-0 text-muted-foreground/55" aria-hidden="true"/>}
            {crumb.to&&!isCurrent?<Link to={crumb.to} className="truncate transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{crumb.label}</Link>:<span className="truncate font-medium text-foreground" aria-current={isCurrent?"page":undefined}>{crumb.label}</span>}
          </li>;
        })}
      </ol>
    </nav>
  </div>;
}
