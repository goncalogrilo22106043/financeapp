"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, WalletCards } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TransactionSheet } from "@/components/finance/transaction-sheet";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { fetchAccounts, fetchCategories, saveAccount } from "@/lib/supabase/queries";
import type { Account, AccountType, Category } from "@/lib/types";
import { euros } from "@/lib/utils";

type AccountForm = {
  id?: string;
  name: string;
  type: AccountType;
  balance: string;
};

const emptyForm: AccountForm = {
  name: "",
  type: "bank",
  balance: "0"
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");

  const total = useMemo(
    () => accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0),
    [accounts]
  );

  async function load() {
    setError("");
    try {
      const [nextAccounts, nextCategories] = await Promise.all([
        fetchAccounts(),
        fetchCategories()
      ]);
      setAccounts(nextAccounts);
      setCategories(nextCategories);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui carregar as contas.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openNew() {
    setForm(emptyForm);
    setFormError("");
    setAccountSheetOpen(true);
  }

  function openEdit(account: Account) {
    setFormError("");
    setForm({
      id: account.id,
      name: account.name,
      type: account.type,
      balance: String(account.balance)
    });
    setAccountSheetOpen(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      const savedAccount = await saveAccount({
        id: form.id,
        name: form.name,
        type: form.type,
        balance: Number(form.balance),
        currency: "EUR"
      });
      setAccounts((current) => {
        const exists = current.some((account) => account.id === savedAccount.id);
        return exists
          ? current.map((account) => (account.id === savedAccount.id ? savedAccount : account))
          : [...current, savedAccount];
      });
      setAccountSheetOpen(false);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : "Não consegui guardar a conta. Confirma se a base de dados está atualizada."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell onNewTransaction={() => setTransactionSheetOpen(true)}>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-muted-foreground">Património</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Contas</h1>
        </div>
        <Button size="sm" variant="secondary" onClick={openNew}>
          <Plus className="h-4 w-4" />
          Conta
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <Card className="mb-4 overflow-hidden bg-foreground p-6 text-background">
        <WalletCards className="mb-4 h-6 w-6 text-background/70" />
        <p className="text-sm text-background/70">Total geral</p>
        <strong className="mt-2 block text-4xl">{euros(total)}</strong>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        {accounts.map((account) => (
          <Card className="p-5" key={account.id}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">{accountTypeLabel(account.type)}</p>
                <h2 className="text-2xl font-bold">{account.name}</h2>
              </div>
              <Button aria-label="Editar conta" size="icon" variant="ghost" onClick={() => openEdit(account)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
            <strong className="text-3xl">{euros(Number(account.balance))}</strong>
          </Card>
        ))}
      </div>

      <Sheet
        open={accountSheetOpen}
        title={form.id ? "Editar conta" : "Nova conta"}
        onClose={() => {
          setAccountSheetOpen(false);
          setFormError("");
        }}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          {formError ? (
            <div className="rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-700 dark:text-rose-300">
              {formError}
            </div>
          ) : null}
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Nome</span>
            <Input
              autoFocus
              placeholder="Ex: Millennium"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Tipo</span>
            <Select
              value={form.type}
              onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as AccountType }))}
            >
              <option value="bank">Banco</option>
              <option value="wallet">Carteira</option>
              <option value="cash">Dinheiro</option>
              <option value="other">Outro</option>
            </Select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-muted-foreground">Saldo atual</span>
            <Input
              inputMode="decimal"
              step="0.01"
              type="number"
              value={form.balance}
              onChange={(event) => setForm((current) => ({ ...current, balance: event.target.value }))}
              required
            />
          </label>
          <Button className="w-full" disabled={saving} size="lg" type="submit">
            {saving ? "A guardar..." : "Guardar conta"}
          </Button>
        </form>
      </Sheet>

      <TransactionSheet
        accounts={accounts}
        categories={categories}
        open={transactionSheetOpen}
        onClose={() => setTransactionSheetOpen(false)}
        onSaved={load}
      />
    </AppShell>
  );
}

function accountTypeLabel(type: AccountType) {
  const labels = {
    bank: "Banco",
    wallet: "Carteira",
    cash: "Dinheiro",
    other: "Outro"
  };
  return labels[type];
}
