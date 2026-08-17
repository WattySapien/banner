import {
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Car,
  Home,
  ReceiptText,
  ShoppingBag,
  ShoppingBasket,
  Utensils,
  ChevronRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { BankTransaction } from "@clipx/contracts/banking";
import { formatCurrency, formatDate } from "@/lib/banking";
import { ListPagination } from "@/components/ListPagination";
import { useState } from "react";

const icons = {
  income: ArrowDownLeft,
  transfer: ArrowUpRight,
  housing: Home,
  groceries: ShoppingBasket,
  transport: Car,
  utilities: ReceiptText,
  dining: Utensils,
  shopping: ShoppingBag,
};

export function TransactionList({ transactions, compact = false, detailsBasePath = "/activity" }: { transactions: BankTransaction[]; compact?: boolean; detailsBasePath?: string }) {
  const [page,setPage]=useState(1);
  const pageSize=compact?5:10;
  if (transactions.length === 0) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl bg-muted/55 p-8 text-center">
        <div>
          <Building2 className="mx-auto mb-3 size-6 text-muted-foreground" />
          <p className="font-medium">No transactions found</p>
          <p className="mt-1 text-sm text-muted-foreground">Account activity will appear here.</p>
        </div>
      </div>
    );
  }

  const visible=transactions.slice((page-1)*pageSize,page*pageSize);
  return (
    <div><div className="divide-y" data-motion-list>
      {visible.map((transaction) => {
        const Icon = icons[transaction.category];
        const isCredit = transaction.direction === "credit";
        return (
          <Link key={transaction.id} to={`${detailsBasePath}/${encodeURIComponent(transaction.id)}`} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl py-3.5 outline-none transition-colors first:pt-0 last:pb-0 hover:bg-muted/45 focus-visible:ring-2 focus-visible:ring-ring sm:gap-4 sm:px-2 sm:py-4">
            <div className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground sm:size-10">
              <Icon className="size-[18px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold sm:text-[15px]">{transaction.merchant}</p>
                {transaction.status === "pending" && <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Pending</span>}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{compact ? formatDate(transaction.createdAt) : `${transaction.description} | ${formatDate(transaction.createdAt)}`}</p>
            </div>
            <div className="flex items-center gap-0.5"><p className={`max-w-[6.5rem] truncate font-mono text-xs font-semibold tabular-nums sm:max-w-none sm:text-[15px] ${isCredit ? "text-primary" : "text-foreground"}`}>{isCredit ? "+" : "-"}{formatCurrency(transaction.amount)}</p><ChevronRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:size-4" aria-hidden="true"/></div>
          </Link>
        );
      })}
    </div><ListPagination page={page} pageSize={pageSize} total={transactions.length} onPageChange={setPage}/></div>
  );
}
