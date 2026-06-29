"use client";

import { expenseCategories, incomeCategories } from "@/lib/constants";
import { getMonthRange } from "@/lib/finance";
import { getSupabase } from "@/lib/supabase/client";
import type { Category, Goal, Transaction, TransactionType } from "@/lib/types";

const sharedUserId = "main";

async function ensureDefaults() {
  const supabase = getSupabase();

  await supabase.from("profiles").upsert({
    id: sharedUserId,
    full_name: "Gonçalo"
  });

  const { data: existing, error } = await supabase
    .from("categories")
    .select("name,type")
    .eq("user_id", sharedUserId);

  if (error) throw error;

  if (existing?.length) return;

  const defaults = [
    ...incomeCategories.map((name) => ({ name, type: "income" as TransactionType })),
    ...expenseCategories.map((name) => ({ name, type: "expense" as TransactionType }))
  ];

  if (defaults.length) {
    const { error: insertError } = await supabase.from("categories").insert(
      defaults.map((category) => ({
        ...category,
        user_id: sharedUserId
      }))
    );
    if (insertError) throw insertError;
  }
}

export async function fetchCategories() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", sharedUserId)
    .order("type", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return data as Category[];
}

async function getOrCreateExpenseCategory(name: string) {
  const cleanName = name.trim() || "Revolut";
  const categories = await fetchCategories();
  const existing = categories.find(
    (category) =>
      category.type === "expense" &&
      category.name.localeCompare(cleanName, "pt-PT", { sensitivity: "accent" }) === 0
  );

  if (existing) return existing;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: cleanName,
      type: "expense",
      user_id: sharedUserId
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Category;
}

export async function saveCategory(input: {
  id?: string;
  name: string;
  type: TransactionType;
}) {
  await ensureDefaults();
  const supabase = getSupabase();
  const payload = {
    name: input.name.trim(),
    type: input.type,
    user_id: sharedUserId
  };

  const { error } = input.id
    ? await supabase
        .from("categories")
        .update(payload)
        .eq("id", input.id)
        .eq("user_id", sharedUserId)
    : await supabase.from("categories").insert(payload);

  if (error) throw error;
}

export async function deleteCategory(id: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", sharedUserId);

  if (error) throw error;
}

export async function fetchTransactions(month: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(id,name,type)")
    .eq("user_id", sharedUserId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchAllTransactions() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(id,name,type)")
    .eq("user_id", sharedUserId)
    .order("date", { ascending: true });

  if (error) throw error;
  return data as Transaction[];
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
  const supabase = getSupabase();
  await ensureDefaults();
  const payload = {
    ...input,
    user_id: sharedUserId,
    description: input.description.trim()
  };

  const { error } = input.id
    ? await supabase.from("transactions").update(payload).eq("id", input.id)
    : await supabase.from("transactions").insert(payload);

  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", sharedUserId);
  if (error) throw error;
}

export async function importExpenseTransactions(
  rows: Array<{
    amount: number;
    category: string;
    description: string;
    date: string;
    payment_method?: string;
  }>
) {
  await ensureDefaults();
  const supabase = getSupabase();
  const existing = await fetchAllTransactions();
  const existingKeys = new Set(
    existing.map((transaction) =>
      [
        transaction.date,
        Number(transaction.amount).toFixed(2),
        transaction.description?.trim().toLowerCase() || "",
        transaction.categories?.name?.trim().toLowerCase() || ""
      ].join("|")
    )
  );

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const category = await getOrCreateExpenseCategory(row.category);
    const amount = Math.abs(Number(row.amount));
    const key = [
      row.date,
      amount.toFixed(2),
      row.description.trim().toLowerCase(),
      category.name.trim().toLowerCase()
    ].join("|");

    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const { error } = await supabase.from("transactions").insert({
      user_id: sharedUserId,
      type: "expense",
      amount,
      category_id: category.id,
      description: row.description.trim() || "Despesa Revolut",
      payment_method: row.payment_method || "Revolut",
      date: row.date
    });

    if (error) throw error;
    existingKeys.add(key);
    inserted += 1;
  }

  return { inserted, skipped };
}

export async function fetchGoals() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", sharedUserId)
    .order("created_at");
  if (error) throw error;
  return data as Goal[];
}

export async function saveGoal(input: {
  id?: string;
  title: string;
  target_amount: number;
  current_amount: number;
}) {
  const supabase = getSupabase();
  await ensureDefaults();

  const { error } = input.id
    ? await supabase.from("goals").update(input).eq("id", input.id).eq("user_id", sharedUserId)
    : await supabase.from("goals").insert({ ...input, user_id: sharedUserId });

  if (error) throw error;
}
