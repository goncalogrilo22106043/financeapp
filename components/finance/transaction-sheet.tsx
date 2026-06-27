"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { paymentMethods } from "@/lib/constants";
import { saveTransaction } from "@/lib/supabase/queries";
import type { Category, Transaction, TransactionType } from "@/lib/types";
import { cn, dateForInput } from "@/lib/utils";

type FormState = {
  type: TransactionType;
  amount: string;
  category_id: string;
  description: string;
  payment_method: string;
  date: string;
};

const initialForm: FormState = {
  type: "expense",
  amount: "",
  category_id: "",
  description: "",
  payment_method: "Cartão",
  date: dateForInput()
};

export function TransactionSheet({
  open,
  categories,
  transaction,
  onClose,
  onSaved
}: {
  open: boolean;
  categories: Category[];
  transaction?: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const visibleCategories = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type]
  );

  useEffect(() => {
    if (transaction) {
      setForm({
        type: transaction.type,
        amount: String(transaction.amount),
        category_id: transaction.category_id || "",
        description: transaction.description || "",
        payment_method: transaction.payment_method || "Cartão",
        date: transaction.date
      });
      return;
    }

    setForm({
      ...initialForm,
      category_id: categories.find((category) => category.type === initialForm.type)?.id || ""
    });
  }, [categories, transaction, open]);

  useEffect(() => {
    if (!visibleCategories.length) return;
    if (!visibleCategories.some((category) => category.id === form.category_id)) {
      setForm((current) => ({ ...current, category_id: visibleCategories[0].id }));
    }
  }, [form.category_id, visibleCategories]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await saveTransaction({
        id: transaction?.id,
        type: form.type,
        amount: Number(form.amount),
        category_id: form.category_id,
        description: form.description,
        payment_method: form.payment_method,
        date: form.date
      });
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet
      open={open}
      title={transaction ? "Editar transação" : "Nova transação"}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-3xl bg-muted p-1">
          {(["expense", "income"] as TransactionType[]).map((type) => (
            <button
              className={cn(
                "h-12 rounded-[1.35rem] text-sm font-bold transition",
                form.type === type ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
              key={type}
              type="button"
              onClick={() => setForm((current) => ({ ...current, type }))}
            >
              {type === "income" ? "Receita" : "Despesa"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted-foreground">Valor</span>
          <Input
            autoFocus
            inputMode="decimal"
            min="0"
            placeholder="0€"
            step="0.01"
            type="number"
            value={form.amount}
            onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
            required
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted-foreground">Categoria</span>
          <Select
            value={form.category_id}
            onChange={(event) => setForm((current) => ({ ...current, category_id: event.target.value }))}
            required
          >
            {visibleCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted-foreground">Descrição</span>
          <Input
            placeholder="Ex: almoço, cliente, Vinted..."
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Data</span>
            <Input
              type="date"
              value={form.date}
              onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Método</span>
            <Select
              value={form.payment_method}
              onChange={(event) => setForm((current) => ({ ...current, payment_method: event.target.value }))}
            >
              {paymentMethods.map((method) => (
                <option key={method}>{method}</option>
              ))}
            </Select>
          </label>
        </div>

        <Button className="w-full" disabled={saving} size="lg" type="submit">
          {saving ? "A guardar..." : "Guardar"}
        </Button>
      </form>
    </Sheet>
  );
}
