"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { AppShell } from "@/components/app-shell";
import { MonthPicker } from "@/components/finance/month-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { chartPalette } from "@/lib/constants";
import { summarize, totalsByCategory } from "@/lib/finance";
import { fetchAllTransactions, fetchCategories, fetchTransactions } from "@/lib/supabase/queries";
import type { Category, Transaction } from "@/lib/types";
import { addMonths, euros, monthKey, monthLabel } from "@/lib/utils";
import { TransactionSheet } from "@/components/finance/transaction-sheet";

export default function StatsPage() {
  return <Stats />;
}

function Stats() {
  const [month, setMonth] = useState(monthKey());
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextCategories, monthTransactions, everyTransaction] = await Promise.all([
        fetchCategories(),
        fetchTransactions(month),
        fetchAllTransactions()
      ]);
      setCategories(nextCategories);
      setTransactions(monthTransactions);
      setAllTransactions(everyTransaction);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar as estatísticas.");
    }
  }

  useEffect(() => {
    load();
  }, [month]);

  const expenses = useMemo(() => totalsByCategory(transactions, "expense"), [transactions]);
  const income = useMemo(() => totalsByCategory(transactions, "income"), [transactions]);
  const summary = useMemo(() => summarize(transactions), [transactions]);
  const balanceEvolution = useMemo(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const key = addMonths(month, index - 5);
      const monthTransactions = allTransactions.filter((transaction) => transaction.date.startsWith(key));
      return {
        month: monthLabel(key).split(" ")[0],
        saldo: summarize(monthTransactions).balance
      };
    });
  }, [allTransactions, month]);

  const mostSpent = expenses[0];
  const topIncome = income[0];

  return (
    <AppShell onNewTransaction={() => setSheetOpen(true)}>
      <div className="mb-6">
        <p className="text-muted-foreground">Visão simples</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Estatísticas</h1>
      </div>

      <div className="mb-5">
        <MonthPicker month={month} onChange={setMonth} />
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid gap-3 md:grid-cols-2">
        <Insight title="Onde mais gastaste" value={mostSpent ? mostSpent.name : "Sem despesas"} detail={mostSpent ? euros(mostSpent.value) : "0€"} />
        <Insight title="Principal rendimento" value={topIncome ? topIncome.name : "Sem receitas"} detail={topIncome ? euros(topIncome.value) : "0€"} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ChartCard title="Despesas por categoria">
          <ResponsiveContainer height={260} width="100%">
            <PieChart>
              <Pie data={expenses} dataKey="value" innerRadius={58} outerRadius={92} paddingAngle={4}>
                {expenses.map((entry, index) => (
                  <Cell fill={chartPalette[index % chartPalette.length]} key={entry.name} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => euros(Number(value))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Receitas por categoria">
          <ResponsiveContainer height={260} width="100%">
            <BarChart data={income}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" hide />
              <YAxis hide />
              <Tooltip formatter={(value) => euros(Number(value))} />
              <Bar dataKey="value" fill="#16a34a" radius={[12, 12, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Receitas vs despesas">
          <ResponsiveContainer height={260} width="100%">
            <BarChart
              data={[
                { name: "Receitas", value: summary.income },
                { name: "Despesas", value: summary.expenses }
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" />
              <YAxis hide />
              <Tooltip formatter={(value) => euros(Number(value))} />
              <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                <Cell fill="#16a34a" />
                <Cell fill="#ef4444" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Evolução do saldo">
          <ResponsiveContainer height={260} width="100%">
            <LineChart data={balanceEvolution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" />
              <YAxis hide />
              <Tooltip formatter={(value) => euros(Number(value))} />
              <Line dataKey="saldo" dot stroke="#2563eb" strokeWidth={3} type="monotone" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <TransactionSheet
        categories={categories}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}

function Insight({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted-foreground">{title}</p>
      <strong className="mt-2 block text-2xl">{value}</strong>
      <p className="mt-1 text-sm font-semibold text-foreground/70">{detail}</p>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
