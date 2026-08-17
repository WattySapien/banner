import { ChevronLeft,ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ListPagination({page,pageSize,total,onPageChange}:{page:number;pageSize:number;total:number;onPageChange:(page:number)=>void}){
  const pages=Math.max(1,Math.ceil(total/pageSize));
  if(total<=pageSize)return null;
  return <div className="flex items-center justify-between gap-3 border-t pt-4" aria-label="Pagination"><p className="text-xs text-muted-foreground">Showing {Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)} of {total}</p><div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" aria-label="Previous page" disabled={page===1} onClick={()=>onPageChange(page-1)}><ChevronLeft className="size-4"/></Button><span className="min-w-16 text-center text-xs text-muted-foreground">Page {page} of {pages}</span><Button type="button" size="sm" variant="outline" aria-label="Next page" disabled={page===pages} onClick={()=>onPageChange(page+1)}><ChevronRight className="size-4"/></Button></div></div>;
}
