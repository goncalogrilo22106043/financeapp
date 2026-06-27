"use client";

import { expenseCategories, incomeCategories } from "@/lib/constants";
import { getMonthRange } from "@/lib/finance";
import type { Category, Goal, Transaction, TransactionType } from "@/lib/types";

const storageKey = "financeflow-local-data-v1";
const localUserId = "local-user";

type StoredData = {
  categories: Category[];
  transactions: Transaction[];
  goals: Goal[];
};

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createDefaultCategories() {
  const now = new Date().toISOString();
  return [
    ...incomeCategories.map((name) => ({
      id: `income-${slug(name)}`,
      user_id: localUserId,
      name,
      type: "income" as TransactionType,
      created_at: now
    })),
    ...expenseCategories.map((name) => ({
      id: `expense-${slug(name)}`,
      user_id: localUserId,
      name,
      type: "expense" as TransactionType,
      created_at: now
    }))
  ];
}

function readStore(): StoredData {
  if (typeof window === "undefined") {
    return { categories: createDefaultCategories(), transactions: [], goals: [] };
  }

  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    const initial = { categories: createDefaultCategories(), transactions: [], goals: [] };
    writeStore(initial);
    return initial;
  }

  try {
    const parsed = JSON.parse(raw) as StoredData;
    return {
      categories: parsed.categories?.length ? parsed.categories : createDefaultCategories(),
      transactions: parsed.transactions || [],
      goals: parsed.goals || []
    };
  } catch {
    const initial = { categories: createDefaultCategories(), transactions: [], goals: [] };
    writeStore(initial);
    return initial;
  }
}

function writeStore(data: StoredData) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(data));
}

function withCategory(transaction: Transaction, categories: Category[]): Transaction {
  return {
    ...transaction,
    categories: categories.find((category) => category.id === transaction.category_id) || null
  };
}

export async function fetchCategories() {
  return readStore().categories.sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));
}

export async function fetchTransactions(month: string) {
  const { start, end } = getMonthRange(month);
  const store = readStore();
  return store.transactions
    .filter((transaction) => transaction.date >= start && transaction.date <= end)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((transaction) => withCategory(transaction, store.categories));
}

export async function fetchAllTransactions() {
  const store = readStore();
  return store.transactions
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((transaction) => withCategory(transaction, store.categories));
}

export async function saveTransaction(input: {
  id?: string;
  type: TransactionType;
  amount: number;
  category_id: string;
  description: string;
  payment_method: string;
  date: string;
}) {
  const store = readStore();
  const payload: Transaction = {
    ...input,
    id: input.id || crypto.randomUUID(),
    user_id: localUserId,
    description: input.description.trim(),
    created_at: new Date().toISOString()
  };

  store.transactions = input.id
    ? store.transactions.map((transaction) => (transaction.id === input.id ? payload : transaction))
    : [payload, ...store.transactions];
  writeStore(store);
}

export async function deleteTransaction(id: string) {
  const store = readStore();
  store.transactions = store.transactions.filter((transaction) => transaction.id !== id);
  writeStore(store);
}

export async function fetchGoals() {
  return readStore().goals.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function saveGoal(input: {
  id?: string;
  title: string;
  target_amount: number;
  current_amount: number;
}) {
  const store = readStore();
  const payload: Goal = {
    ...input,
    id: input.id || crypto.randomUUID(),
    user_id: localUserId,
    created_at: new Date().toISOString()
  };

  store.goals = input.id
    ? store.goals.map((goal) => (goal.id === input.id ? payload : goal))
    : [payload, ...store.goals];
  writeStore(store);
}
