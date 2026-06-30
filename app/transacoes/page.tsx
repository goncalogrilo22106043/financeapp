"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Upload } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MonthPicker } from "@/components/finance/month-picker";
import { TransactionList } from "@/components/finance/transaction-list";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { deleteTransaction, deleteTransactionsForMonth, fetchAccounts, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import type { Account, Category, Transaction, TransactionType } from "@/lib/types";
import { monthKey, monthLabel } from "@/lib/utils";

export default function TransactionsPage() {
  return <Transactions />;
}

function Transactions() {
  const [month, setMonth] = useState(monthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [type, setType] = useState<"all" | TransactionType>("all");
  const [categoryId, setCategoryId] = useState("all");
  const [accountId, setAccountId] = useState("all");
  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [deleteMonthOpen, setDeleteMonthOpen] = useState(false);
  const [deletingMonth, setDeletingMonth] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextCategories, nextTransactions, nextAccounts] = await Promise.all([
        fetchCategories(),
        fetchTransactions(month),
        fetchAccounts()
      ]);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
      setAccounts(nextAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar as transações.");
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const filtered = useMemo(() => {
    return transactions
      .filter((transaction) => type === "all" || transaction.type === type)
      .filter((transaction) => categoryId === "all" || transaction.category_id === categoryId)
      .filter(
        (transaction) =>
          accountId === "all" ||
          transaction.account_id === accountId ||
          transaction.from_account_id === accountId ||
          transaction.to_account_id === accountId
      )
      .filter((transaction) => {
        const text = `${transaction.description || ""} ${transaction.categories?.name || ""} ${transaction.accounts?.name || ""} ${transaction.from_account?.name || ""} ${transaction.to_account?.name || ""}`.toLowerCase();
        return text.includes(search.toLowerCase());
      });
  }, [accountId, categoryId, search, transactions, type]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  async function remove(id: string) {
    if (!window.confirm("Queres apagar este movimento?")) return;
    await deleteTransaction(id);
    await load();
  }

  async function confirmDeleteMonth() {
    const label = capitalize(monthLabel(month));
    const secondConfirmation = window.confirm(
      `Confirma novamente que queres apagar todos os movimentos de ${label}?`
    );
    if (!secondConfirmation) return;

    setDeletingMonth(true);
    setError("");
    setSuccess("");
    try {
      await deleteTransactionsForMonth(month);
      setDeleteMonthOpen(false);
      setSuccess(`Todas as transações de ${label} foram apagadas.`);
      await load();
      window.setTimeout(() => setSuccess(""), 4500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui apagar os movimentos deste mês.");
    } finally {
      setDeletingMonth(false);
    }
  }

  return (
    <AppShell onNewTransaction={openNew}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Movimentos</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Movimentos</h1>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            disabled={deletingMonth}
            size="sm"
            variant="ghost"
            onClick={() => setDeleteMonthOpen(true)}
          >
            {deletingMonth ? "A apagar..." : "Apagar mês"}
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link href="/importar">
              <Upload className="h-4 w-4" />
              Importar
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-4">
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_150px_180px_220px]">
        <Input
          placeholder="Pesquisar descrição"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select value={type} onChange={(event) => setType(event.target.value as "all" | TransactionType)}>
          <option value="all">Todos</option>
          <option value="income">Receitas</option>
          <option value="expense">Despesas</option>
          <option value="transfer">Transferências</option>
        </Select>
        <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
          <option value="all">Todas as contas</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
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

      {error ? (
        <div className="mb-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="fixed right-4 top-20 z-50 max-w-sm rounded-2xl border border-emerald-500/30 bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-soft">
          {success}
        </div>
      ) : null}

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
        accounts={accounts}
        open={sheetOpen}
        transaction={editing}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />

      {deleteMonthOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[2rem] border border-border bg-card p-5 shadow-soft">
            <h2 className="text-xl font-bold">Apagar todas as transações?</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tem a certeza que pretende apagar todas as transações deste mês? Esta ação é irreversível.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button
                disabled={deletingMonth}
                variant="secondary"
                onClick={() => setDeleteMonthOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                className="bg-rose-600 text-white hover:bg-rose-700"
                disabled={deletingMonth}
                onClick={confirmDeleteMonth}
              >
                {deletingMonth ? "A apagar..." : "Apagar"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
