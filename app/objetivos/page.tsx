"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { fetchAccounts, fetchCategories, fetchGoals, saveGoal } from "@/lib/supabase/queries";
import type { Account, Category, Goal } from "@/lib/types";
import { euros } from "@/lib/utils";

export default function GoalsPage() {
  return <Goals />;
}

function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [title, setTitle] = useState("Património");
  const [target, setTarget] = useState("40000");
  const [current, setCurrent] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextCategories, nextGoals, nextAccounts] = await Promise.all([
        fetchCategories(),
        fetchGoals(),
        fetchAccounts()
      ]);
      setCategories(nextCategories);
      setGoals(nextGoals);
      setAccounts(nextAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar os objetivos.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    await saveGoal({
      title,
      target_amount: Number(target),
      current_amount: Number(current || 0)
    });
    setTitle("");
    setTarget("");
    setCurrent("");
    await load();
  }

  return (
    <AppShell onNewTransaction={() => setSheetOpen(true)}>
      <div className="mb-6">
        <p className="text-muted-foreground">Para onde estás a ir</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Objetivos</h1>
      </div>

      <div className="mb-5 grid gap-3">
        {error ? (
          <div className="rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        ) : null}
        {goals.length ? (
          goals.map((goal) => <GoalCard goal={goal} key={goal.id} />)
        ) : (
          <EmptyState
            title="Ainda não há objetivos"
            description="Cria um objetivo, por exemplo património de 40.000€."
          />
        )}
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-xl font-semibold">Novo objetivo</h2>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <Input
            placeholder="Nome do objetivo"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              inputMode="decimal"
              placeholder="Meta"
              type="number"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              required
            />
            <Input
              inputMode="decimal"
              placeholder="Valor atual"
              type="number"
              value={current}
              onChange={(event) => setCurrent(event.target.value)}
            />
          </div>
          <Button className="w-full" size="lg" type="submit">
            Guardar objetivo
          </Button>
        </form>
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

function GoalCard({ goal }: { goal: Goal }) {
  const progress = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Objetivo</p>
          <h2 className="text-2xl font-bold">{goal.title}</h2>
        </div>
        <strong className="rounded-2xl bg-muted px-3 py-2 text-sm">{Math.round(progress)}%</strong>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="mt-4 flex justify-between text-sm">
        <span className="text-muted-foreground">{euros(goal.current_amount)}</span>
        <strong>{euros(goal.target_amount)}</strong>
      </div>
    </Card>
  );
}
