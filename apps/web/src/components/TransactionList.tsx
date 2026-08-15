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
} from "lucide-react";
import type { BankTransaction } from "@clipx/contracts/banking";
import { formatCurrency, formatDate } from "@/lib/banking";

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

export function TransactionList({ transactions, compact = false }: { transactions: BankTransaction[]; compact?: boolean }) {
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

  return (
    <div className="divide-y">
      {transactions.map((transaction) => {
        const Icon = icons[transaction.category];
        const isCredit = transaction.direction === "credit";
        return (
          <article key={transaction.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-4 first:pt-0 last:pb-0 sm:gap-4">
            <div className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground">
              <Icon className="size-[18px]" strokeWidth={1.8} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-semibold sm:text-[15px]">{transaction.merchant}</p>
                {transaction.status === "pending" && <span className="rounded-md bg-amber-500/12 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">Pending</span>}
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground sm:text-sm">{compact ? formatDate(transaction.createdAt) : `${transaction.description} | ${formatDate(transaction.createdAt)}`}</p>
            </div>
            <p className={`font-mono text-sm font-semibold tabular-nums sm:text-[15px] ${isCredit ? "text-primary" : "text-foreground"}`}>
              {isCredit ? "+" : "-"}{formatCurrency(transaction.amount)}
            </p>
          </article>
        );
      })}
    </div>
  );
}
