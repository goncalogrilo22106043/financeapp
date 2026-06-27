"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Transaction } from "@/lib/types";
import { cn, euros } from "@/lib/utils";

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  compact = false
}: {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  compact?: boolean;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        title="Ainda não há movimentos"
        description="Adiciona uma receita ou despesa para este mês."
      />
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => (
        <article
          className="flex items-center gap-3 rounded-[1.5rem] border border-border bg-card p-3"
          key={transaction.id}
        >
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
              transaction.type === "income"
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-rose-500/10 text-rose-600"
            )}
          >
            {transaction.type === "income" ? "+" : "-"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{transaction.description || transaction.categories?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {transaction.categories?.name || "Sem categoria"} · {transaction.payment_method || "Sem método"}
            </p>
          </div>
          <div className="text-right">
            <p
              className={cn(
                "font-bold",
                transaction.type === "income" ? "text-emerald-600" : "text-rose-600"
              )}
            >
              {transaction.type === "income" ? "+" : "-"}
              {euros(Number(transaction.amount))}
            </p>
            {!compact && onEdit && onDelete ? (
              <div className="mt-1 flex justify-end gap-1">
                <Button aria-label="Editar transação" size="icon" variant="ghost" onClick={() => onEdit(transaction)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button aria-label="Apagar transação" size="icon" variant="ghost" onClick={() => onDelete(transaction.id)}>
                  <Trash2 className="h-4 w-4 text-rose-500" />
                </Button>
              </div>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
