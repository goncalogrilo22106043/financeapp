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
import {
  deleteTransaction,
  deleteTransactionsForMonth,
  fetchAccounts,
  fetchCategories,
  fetchTransactions,
  saveTransaction
} from "@/lib/supabase/queries";
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
  const [summaryFilter, setSummaryFilter] = useState<"all" | "included" | "excluded">("all");
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
    return dedupeInternalTransfers(transactions)
      .filter((transaction) => type === "all" || transaction.type === type)
      .filter((transaction) => categoryId === "all" || transaction.category_id === categoryId)
      .filter((transaction) => {
        if (summaryFilter === "included") return transaction.include_in_monthly_summary !== false;
        if (summaryFilter === "excluded") return transaction.include_in_monthly_summary === false;
        return true;
      })
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
      })
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [accountId, categoryId, search, summaryFilter, transactions, type]);
  const duplicateTransferIds = useMemo(
    () => findDuplicateInternalTransferIds(transactions),
    [transactions]
  );

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }

  async function remove(id: string) {
    if (!window.confirm("Queres apagar este movimento?")) return;
    await deleteTransaction(id);
    await load();
  }

  async function splitTransaction(transaction: Transaction) {
    if (transaction.type === "transfer") return;
    const nextAmount = Math.round((Number(transaction.amount || 0) / 2) * 100) / 100;
    if (nextAmount <= 0) return;

    const ok = window.confirm(
      `Queres dividir "${transaction.description || "este movimento"}" por 2 e guardar apenas ${nextAmount.toLocaleString("pt-PT", {
        style: "currency",
        currency: "EUR"
      })}?`
    );
    if (!ok) return;

    setError("");
    try {
      await saveTransaction({
        id: transaction.id,
        type: transaction.type,
        amount: nextAmount,
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        from_account_id: transaction.from_account_id,
        to_account_id: transaction.to_account_id,
        include_in_monthly_summary: transaction.include_in_monthly_summary !== false,
        description: transaction.description || "Movimento",
        date: transaction.date
      });
      setSuccess("Movimento dividido por 2.");
      await load();
      window.setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui dividir este movimento.");
    }
  }

  async function toggleSummary(transaction: Transaction) {
    setError("");
    try {
      await saveTransaction({
        id: transaction.id,
        type: transaction.type,
        amount: Number(transaction.amount || 0),
        category_id: transaction.category_id,
        account_id: transaction.account_id,
        from_account_id: transaction.from_account_id,
        to_account_id: transaction.to_account_id,
        include_in_monthly_summary: transaction.include_in_monthly_summary === false,
        description: transaction.description || "Movimento",
        date: transaction.date
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui alterar este movimento.");
    }
  }

  async function cleanDuplicateTransfers() {
    if (!duplicateTransferIds.length) return;
    const ok = window.confirm(
      `Encontrei ${duplicateTransferIds.length} transferência(s) duplicada(s). Queres apagar os duplicados e corrigir os saldos?`
    );
    if (!ok) return;

    setError("");
    try {
      for (const id of duplicateTransferIds) {
        await deleteTransaction(id);
      }
      setSuccess("Transferências duplicadas apagadas.");
      await load();
      window.setTimeout(() => setSuccess(""), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui limpar as transferências duplicadas.");
    }
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

      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_150px_180px_220px_190px]">
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
          <option value="third_party">Terceiros</option>
          <option value="investment">Investimentos</option>
          <option value="reimbursable">Reembolsáveis</option>
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
        <Select value={summaryFilter} onChange={(event) => setSummaryFilter(event.target.value as typeof summaryFilter)}>
          <option value="all">Resumo: todos</option>
          <option value="included">Incluídos</option>
          <option value="excluded">Fora do resumo</option>
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

      {duplicateTransferIds.length ? (
        <div className="mb-4 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4 text-sm text-sky-800 dark:text-sky-200">
          <p className="font-semibold">Há transferências internas duplicadas neste mês.</p>
          <p className="mt-1 text-muted-foreground">
            Isto acontece quando a mesma transferência aparece no extrato da Revolut e no Millennium.
          </p>
          <Button className="mt-3" size="sm" variant="secondary" onClick={cleanDuplicateTransfers}>
            Limpar duplicados
          </Button>
        </div>
      ) : null}

      <TransactionList
        transactions={filtered}
        onEdit={(transaction) => {
          setEditing(transaction);
          setSheetOpen(true);
        }}
        onDelete={remove}
        onSplit={splitTransaction}
        onToggleSummary={toggleSummary}
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

function dedupeInternalTransfers(transactions: Transaction[]) {
  const duplicateIds = new Set(findDuplicateInternalTransferIds(transactions));
  return transactions.filter((transaction) => !duplicateIds.has(transaction.id));
}

function findDuplicateInternalTransferIds(transactions: Transaction[]) {
  const result: Transaction[] = [];
  const duplicateIds: string[] = [];

  transactions.forEach((transaction) => {
    if (transaction.type !== "transfer") {
      result.push(transaction);
      return;
    }

    const duplicate = result.some((candidate) => {
      if (candidate.type !== "transfer") return false;
      if (candidate.from_account_id !== transaction.from_account_id) return false;
      if (candidate.to_account_id !== transaction.to_account_id) return false;
      if (Math.abs(Number(candidate.amount || 0) - Number(transaction.amount || 0)) > 0.02) return false;
      return Math.abs(daysBetween(candidate.date, transaction.date)) <= 3;
    });

    if (duplicate) duplicateIds.push(transaction.id);
    else result.push(transaction);
  });

  return duplicateIds;
}

function daysBetween(a: string, b: string) {
  const first = new Date(`${a}T00:00:00`).getTime();
  const second = new Date(`${b}T00:00:00`).getTime();
  return Math.round((first - second) / 86400000);
}
