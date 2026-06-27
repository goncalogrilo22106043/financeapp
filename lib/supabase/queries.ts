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

  const existingKeys = new Set((existing || []).map((category) => `${category.type}:${category.name}`));
  const defaults = [
    ...incomeCategories.map((name) => ({ name, type: "income" as TransactionType })),
    ...expenseCategories.map((name) => ({ name, type: "expense" as TransactionType }))
  ].filter((category) => !existingKeys.has(`${category.type}:${category.name}`));

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
