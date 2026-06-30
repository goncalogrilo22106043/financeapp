"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { MonthPicker } from "@/components/finance/month-picker";
import { SummaryCards } from "@/components/finance/summary-cards";
import { TransactionList } from "@/components/finance/transaction-list";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { summarize } from "@/lib/finance";
import { fetchAccounts, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import type { Account, Category, Transaction } from "@/lib/types";
import { euros, monthKey, monthLabel } from "@/lib/utils";

export default function HomePage() {
  return <Dashboard />;
}

function Dashboard() {
  const name = "Gonçalo";
  const [month, setMonth] = useState(monthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const summary = useMemo(() => summarize(transactions, accounts), [transactions, accounts]);

  async function load() {
    setLoading(true);
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
      setError(err instanceof Error ? err.message : "Não consegui carregar os dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  return (
    <AppShell onNewTransaction={() => setSheetOpen(true)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Olá, {name}</p>
          <h1 className="mt-1 text-3xl font-bold capitalize tracking-tight">{monthLabel(month)}</h1>
        </div>
      </div>

      <div className="mb-5">
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      <SummaryCards summary={summary} />

      <section className="mt-5 grid gap-3 md:grid-cols-3">
        {accounts.map((account) => (
          <Card className="p-4" key={account.id}>
            <p className="text-sm text-muted-foreground">{account.name}</p>
            <strong className="mt-2 block text-2xl">{euros(Number(account.balance))}</strong>
          </Card>
        ))}
      </section>

      {error ? (
        <Card className="mt-5 border-rose-500/30 bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
          {error}
        </Card>
      ) : null}

      <Card className="mt-5">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Últimas transações</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/transacoes">
              Ver todas
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">A carregar...</p>
          ) : (
            <TransactionList compact transactions={transactions.slice(0, 5)} />
          )}
        </CardContent>
      </Card>

      <TransactionSheet
        categories={categories}
        accounts={accounts}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}
