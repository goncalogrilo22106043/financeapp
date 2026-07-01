"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { defaultIncludeInMonthlySummary } from "@/lib/finance";
import { saveTransaction } from "@/lib/supabase/queries";
import type { Account, Category, CategoryType, Transaction, TransactionType } from "@/lib/types";
import { cn, dateForInput } from "@/lib/utils";

type FormState = {
  type: TransactionType;
  amount: string;
  category_id: string;
  account_id: string;
  from_account_id: string;
  to_account_id: string;
  description: string;
  include_in_monthly_summary: boolean;
  date: string;
};

const initialForm: FormState = {
  type: "expense",
  amount: "",
  category_id: "",
  account_id: "",
  from_account_id: "",
  to_account_id: "",
  description: "",
  include_in_monthly_summary: true,
  date: dateForInput()
};

export function TransactionSheet({
  open,
  categories,
  accounts,
  transaction,
  onClose,
  onSaved
}: {
  open: boolean;
  categories: Category[];
  accounts: Account[];
  transaction?: Transaction | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(initialForm);
  const [saving, setSaving] = useState(false);
  const visibleCategories = useMemo(
    () => categories.filter((category) => category.type === categoryTypeFor(form.type)),
    [categories, form.type]
  );

  useEffect(() => {
    const firstAccount = accounts[0]?.id || "";
    const secondAccount = accounts[1]?.id || firstAccount;

    if (transaction) {
      setForm({
        type: transaction.type,
        amount: String(transaction.amount),
        category_id: transaction.category_id || "",
        account_id: transaction.account_id || firstAccount,
        from_account_id: transaction.from_account_id || firstAccount,
        to_account_id: transaction.to_account_id || secondAccount,
        description: transaction.description || "",
        include_in_monthly_summary: transaction.include_in_monthly_summary !== false,
        date: transaction.date
      });
      return;
    }

    setForm({
      ...initialForm,
      account_id: firstAccount,
      from_account_id: firstAccount,
      to_account_id: secondAccount,
      include_in_monthly_summary: defaultIncludeInMonthlySummary(initialForm.type),
      category_id: categories.find((category) => category.type === initialForm.type)?.id || ""
    });
  }, [accounts, categories, transaction, open]);

  useEffect(() => {
    if (form.type === "transfer" || !visibleCategories.length) return;
    if (!visibleCategories.some((category) => category.id === form.category_id)) {
      setForm((current) => ({ ...current, category_id: visibleCategories[0].id }));
    }
  }, [form.category_id, form.type, visibleCategories]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (form.type !== "transfer" && !form.category_id) return;
    if (form.type !== "transfer" && !form.account_id) return;
    if (form.type === "transfer" && (!form.from_account_id || !form.to_account_id)) return;
    if (form.type === "transfer" && form.from_account_id === form.to_account_id) return;

    setSaving(true);
    try {
      await saveTransaction({
        id: transaction?.id,
        type: form.type,
        amount: Number(form.amount),
        category_id: form.type === "transfer" ? null : form.category_id,
        account_id: form.type === "transfer" ? null : form.account_id,
        from_account_id: form.type === "transfer" ? form.from_account_id : null,
        to_account_id: form.type === "transfer" ? form.to_account_id : null,
        description: form.description,
        include_in_monthly_summary: form.include_in_monthly_summary,
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
      title={transaction ? "Editar movimento" : "Novo movimento"}
      onClose={onClose}
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-2 gap-2 rounded-3xl bg-muted p-1 sm:grid-cols-3">
          {(["expense", "income", "transfer", "third_party", "investment", "reimbursable"] as TransactionType[]).map((type) => (
            <button
              className={cn(
                "h-12 rounded-[1.35rem] text-sm font-bold transition",
                form.type === type ? "bg-card shadow-sm" : "text-muted-foreground"
              )}
              key={type}
              type="button"
              onClick={() => setForm((current) => ({
                ...current,
                type,
                category_id: categories.find((category) => category.type === categoryTypeFor(type))?.id || "",
                include_in_monthly_summary: defaultIncludeInMonthlySummary(type)
              }))}
            >
              {typeLabel(type)}
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

        {form.type === "transfer" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <AccountSelect
              accounts={accounts}
              label="Conta origem"
              value={form.from_account_id}
              onChange={(value) => setForm((current) => ({ ...current, from_account_id: value }))}
            />
            <AccountSelect
              accounts={accounts}
              label="Conta destino"
              value={form.to_account_id}
              onChange={(value) => setForm((current) => ({ ...current, to_account_id: value }))}
            />
          </div>
        ) : (
          <>
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
              {!visibleCategories.length ? (
                <p className="mt-2 text-sm text-rose-600">
                  Cria primeiro uma categoria para este tipo de movimento.
                </p>
              ) : null}
            </label>
            <AccountSelect
              accounts={accounts}
              label={form.type === "income" || form.type === "third_party" ? "Conta onde entrou" : "Conta de onde saiu"}
              value={form.account_id}
              onChange={(value) => setForm((current) => ({ ...current, account_id: value }))}
            />
          </>
        )}

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted-foreground">Descrição</span>
          <Input
            placeholder={form.type === "transfer" ? "Ex: Millennium para Revolut" : "Ex: cliente, almoço, Vinted..."}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-muted-foreground">Data</span>
          <Input
            type="date"
            value={form.date}
            onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))}
            required
          />
        </label>

        {form.type === "transfer" && form.from_account_id === form.to_account_id ? (
          <p className="rounded-2xl bg-rose-500/10 p-3 text-sm font-medium text-rose-600">
            Escolhe duas contas diferentes.
          </p>
        ) : null}

        {form.type !== "transfer" ? (
          <label className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-muted/40 p-4">
            <span>
              <span className="block text-sm font-semibold">Incluir no resumo mensal</span>
              <span className="text-xs text-muted-foreground">
                Só receitas e despesas reais devem entrar nos totais do mês.
              </span>
            </span>
            <input
              checked={form.include_in_monthly_summary}
              className="h-5 w-5 accent-emerald-600"
              type="checkbox"
              onChange={(event) => setForm((current) => ({
                ...current,
                include_in_monthly_summary: event.target.checked
              }))}
            />
          </label>
        ) : null}

        <Button className="w-full" disabled={saving || !accounts.length} size="lg" type="submit">
          {saving ? "A guardar..." : "Guardar movimento"}
        </Button>
      </form>
    </Sheet>
  );
}

function categoryTypeFor(type: TransactionType): CategoryType {
  return type === "income" ? "income" : "expense";
}

function typeLabel(type: TransactionType) {
  const labels = {
    income: "Receita",
    expense: "Despesa",
    transfer: "Transfer.",
    third_party: "Terceiros",
    investment: "Invest.",
    reimbursable: "Reemb."
  };
  return labels[type];
}

function AccountSelect({
  accounts,
  label,
  value,
  onChange
}: {
  accounts: Account[];
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-muted-foreground">{label}</span>
      <Select value={value} onChange={(event) => onChange(event.target.value)} required>
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </Select>
    </label>
  );
}
