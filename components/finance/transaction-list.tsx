"use client";

import { ArrowRightLeft, Divide, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Transaction } from "@/lib/types";
import { cn, euros } from "@/lib/utils";

export function TransactionList({
  transactions,
  onEdit,
  onDelete,
  onSplit,
  compact = false
}: {
  transactions: Transaction[];
  onEdit?: (transaction: Transaction) => void;
  onDelete?: (id: string) => void;
  onSplit?: (transaction: Transaction) => void;
  compact?: boolean;
}) {
  if (!transactions.length) {
    return (
      <EmptyState
        title="Ainda não há movimentos"
        description="Adiciona uma receita, despesa ou transferência para este mês."
      />
    );
  }

  return (
    <div className="space-y-2">
      {transactions.map((transaction) => (
        <article
          className="flex min-w-0 items-center gap-3 rounded-[1.5rem] border border-border bg-card p-3"
          key={transaction.id}
        >
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg font-bold",
              transaction.type === "income" && "bg-emerald-500/10 text-emerald-600",
              transaction.type === "expense" && "bg-rose-500/10 text-rose-600",
              transaction.type === "transfer" && "bg-sky-500/10 text-sky-600"
            )}
          >
            {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : <ArrowRightLeft className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{transaction.description || titleFor(transaction)}</p>
            <p className="truncate text-xs text-muted-foreground">{formatTransactionDate(transaction.date)}</p>
            <p className="truncate text-xs text-muted-foreground">{detailFor(transaction)}</p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                "font-bold",
                transaction.type === "income" && "text-emerald-600",
                transaction.type === "expense" && "text-rose-600",
                transaction.type === "transfer" && "text-sky-600"
              )}
            >
              {transaction.type === "income" ? "+" : transaction.type === "expense" ? "-" : ""}
              {euros(Number(transaction.amount))}
            </p>
            {!compact && onEdit && onDelete ? (
              <div className="mt-1 flex justify-end gap-1">
                {onSplit && transaction.type !== "transfer" ? (
                  <Button aria-label="Dividir movimento por 2" size="sm" variant="ghost" onClick={() => onSplit(transaction)}>
                    <Divide className="h-4 w-4" />
                    1/2
                  </Button>
                ) : null}
                <Button aria-label="Editar movimento" size="icon" variant="ghost" onClick={() => onEdit(transaction)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button aria-label="Apagar movimento" size="icon" variant="ghost" onClick={() => onDelete(transaction.id)}>
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

function titleFor(transaction: Transaction) {
  if (transaction.type === "transfer") return "Transferência";
  return transaction.categories?.name || "Sem categoria";
}

function detailFor(transaction: Transaction) {
  if (transaction.type === "transfer") {
    return `${transaction.from_account?.name || "Conta origem"} -> ${transaction.to_account?.name || "Conta destino"}`;
  }

  return `${transaction.categories?.name || "Sem categoria"} · ${transaction.accounts?.name || "Sem conta"}`;
}

function formatTransactionDate(date: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${date}T00:00:00`));
}
