"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { MonthPicker } from "@/components/finance/month-picker";
import { TransactionList } from "@/components/finance/transaction-list";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteTransaction, fetchCategories, fetchTransactions } from "@/lib/storage/queries";
import type { Category, Transaction, TransactionType } from "@/lib/types";
import { monthKey } from "@/lib/utils";

export default function TransactionsPage() {
  return <Transactions />;
}

function Transactions() {
  const [month, setMonth] = useState(monthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  async function load() {
    const [nextCategories, nextTransactions] = await Promise.all([
      fetchCategories(),
      fetchTransactions(month)
    ]);
    setCategories(nextCategories);
    setTransactions(nextTransactions);
  }

  useEffect(() => {
    load();
  }, [month]);

  const filtered = useMemo(() => {
    return transactions
      .filter((transaction) => type === "all" || transaction.type === type)
      .filter((transaction) => categoryId === "all" || transaction.category_id === categoryId)
      .filter((transaction) => {
        const text = `${transaction.description || ""} ${transaction.categories?.name || ""}`.toLowerCase();
        return text.includes(search.toLowerCase());
      });
  }, [categoryId, search, transactions, type]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  async function remove(id: string) {
    if (!window.confirm("Queres apagar esta transação?")) return;
    await deleteTransaction(id);
    await load();
  }

  return (
    <AppShell onNewTransaction={openNew}>
      <div className="mb-6">
        <p className="text-muted-foreground">Movimentos</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Transações</h1>
      </div>

      <div className="mb-4">
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_160px_220px]">
        <Input
          placeholder="Pesquisar descrição"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}>
          <option value="all">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
        </Select>
        <Select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="all">Todas as categorias</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </Select>
      </div>

      <TransactionList
        transactions={filtered}
        onEdit={(transaction) => {
          setEditing(transaction);
          setSheetOpen(true);
        }}
        onDelete={remove}
      />

      <TransactionSheet
        categories={categories}
        open={sheetOpen}
        transaction={editing}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}
