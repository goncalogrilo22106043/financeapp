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
import { fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import type { Category, Transaction } from "@/lib/types";
import { monthKey, monthLabel } from "@/lib/utils";

export default function HomePage() {
  return <Dashboard />;
}

function Dashboard() {
  const name = "Gonçalo";
  const [month, setMonth] = useState(monthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const summary = useMemo(() => summarize(transactions), [transactions]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [nextCategories, nextTransactions] = await Promise.all([
        fetchCategories(),
        fetchTransactions(month)
      ]);
      setCategories(nextCategories);
      setTransactions(nextTransactions);
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
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}
