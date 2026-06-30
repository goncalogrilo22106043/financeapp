"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  deleteCategory,
  fetchCategories,
  fetchAccounts,
  saveCategory
} from "@/lib/supabase/queries";
import type { Account, Category, CategoryType } from "@/lib/types";
import { cn } from "@/lib/utils";

type CategoryForm = {
  id?: string;
  name: string;
  type: CategoryType;
};

const emptyForm: CategoryForm = {
  name: "",
  type: "expense"
};

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setError("");
    try {
      const [nextCategories, nextAccounts] = await Promise.all([fetchCategories(), fetchAccounts()]);
      setCategories(nextCategories);
      setAccounts(nextAccounts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar as categorias.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  const income = useMemo(
    () => categories.filter((category) => category.type === "income"),
    [categories]
  );
  const expenses = useMemo(
    () => categories.filter((category) => category.type === "expense"),
    [categories]
  );

  function openNew(type: CategoryType) {
    setForm({ name: "", type });
    setCategorySheetOpen(true);
  }

  function openEdit(category: Category) {
    setForm({
      id: category.id,
      name: category.name,
      type: category.type
    });
    setCategorySheetOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveCategory(form);
      setCategorySheetOpen(false);
      setForm(emptyForm);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    if (
      !window.confirm(
        `Apagar a categoria "${category.name}"? As transações antigas ficam sem categoria.`
      )
    ) {
      return;
    }

    await deleteCategory(category.id);
    await load();
  }

  return (
    <AppShell onNewTransaction={() => setTransactionSheetOpen(true)}>
      <div className="mb-6">
        <p className="text-muted-foreground">Personalização</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Categorias</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {error ? (
          <div className="rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300 md:col-span-2">
            {error}
          </div>
        ) : null}
        <CategorySection
          categories={expenses}
          title="Despesas"
          type="expense"
          onAdd={openNew}
          onEdit={openEdit}
          onRemove={remove}
        />
        <CategorySection
          categories={income}
          title="Receitas"
          type="income"
          onAdd={openNew}
          onEdit={openEdit}
          onRemove={remove}
        />
      </div>

      <Sheet
        open={categorySheetOpen}
        title={form.id ? "Editar categoria" : "Nova categoria"}
        onClose={() => setCategorySheetOpen(false)}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Nome</span>
            <Input
              autoFocus
              placeholder="Ex: Fotografia, Viagens, Material..."
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Tipo</span>
            <Select
              value={form.type}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  type: event.target.value as CategoryType
                }))
              }
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </Select>
          </label>

          <Button className="w-full" disabled={saving} size="lg" type="submit">
            {saving ? "A guardar..." : "Guardar categoria"}
          </Button>
        </form>
      </Sheet>

      <TransactionSheet
        categories={categories}
        accounts={accounts}
        open={transactionSheetOpen}
        onClose={() => setTransactionSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}

function CategorySection({
  categories,
  title,
  type,
  onAdd,
  onEdit,
  onRemove
}: {
  categories: Category[];
  title: string;
  type: CategoryType;
  onAdd: (type: CategoryType) => void;
  onEdit: (category: Category) => void;
  onRemove: (category: Category) => void;
}) {
  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Categorias de</p>
          <h2 className="text-2xl font-bold">{title}</h2>
        </div>
        <Button size="icon" type="button" onClick={() => onAdd(type)}>
          <Plus className="h-5 w-5" />
        </Button>
      </div>

      <div className="space-y-2">
        {categories.map((category) => (
          <article
            className="flex items-center gap-3 rounded-[1.35rem] border border-border bg-background p-3"
            key={category.id}
          >
            <span
              className={cn(
                "h-3 w-3 rounded-full",
                category.type === "income" ? "bg-emerald-500" : "bg-rose-500"
              )}
            />
            <p className="min-w-0 flex-1 truncate font-semibold">{category.name}</p>
            <Button aria-label="Editar categoria" size="icon" variant="ghost" onClick={() => onEdit(category)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button aria-label="Apagar categoria" size="icon" variant="ghost" onClick={() => onRemove(category)}>
              <Trash2 className="h-4 w-4 text-rose-500" />
            </Button>
          </article>
        ))}
      </div>
    </Card>
  );
}
