"use client";

import { expenseCategories, incomeCategories } from "@/lib/constants";
import { getMonthRange } from "@/lib/finance";
import { getSupabase } from "@/lib/supabase/client";
import type { Category, Goal, Transaction, TransactionType } from "@/lib/types";

export async function getCurrentUser() {
  const supabase = getSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function ensureProfileAndDefaults() {
  const supabase = getSupabase();
  const user = await getCurrentUser();
  if (!user) return null;

  await supabase.from("profiles").upsert({
    id: user.id,
    full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Gonçalo"
  });

  const { data: existing } = await supabase
    .from("categories")
    .select("name,type")
    .eq("user_id", user.id);

  const keys = new Set((existing || []).map((category) => `${category.type}:${category.name}`));
  const defaults = [
    ...incomeCategories.map((name) => ({ name, type: "income" as TransactionType })),
    ...expenseCategories.map((name) => ({ name, type: "expense" as TransactionType }))
  ].filter((category) => !keys.has(`${category.type}:${category.name}`));

  if (defaults.length) {
    await supabase.from("categories").insert(
      defaults.map((category) => ({
        ...category,
        user_id: user.id
      }))
    );
  }

  return user;
}

export async function fetchCategories() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .order("type", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return data as Category[];
}

export async function fetchTransactions(month: string) {
  const supabase = getSupabase();
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(id,name,type)")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchAllTransactions() {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select("*, categories(id,name,type)")
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
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessão expirada.");

  const payload = {
    ...input,
    user_id: user.id,
    description: input.description.trim()
  };

  const { error } = input.id
    ? await supabase.from("transactions").update(payload).eq("id", input.id)
    : await supabase.from("transactions").insert(payload);

  if (error) throw error;
}

export async function deleteTransaction(id: string) {
  const supabase = getSupabase();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchGoals() {
  const supabase = getSupabase();
  const { data, error } = await supabase.from("goals").select("*").order("created_at");
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
  const user = await getCurrentUser();
  if (!user) throw new Error("Sessão expirada.");

  const { error } = input.id
    ? await supabase.from("goals").update(input).eq("id", input.id)
    : await supabase.from("goals").insert({ ...input, user_id: user.id });

  if (error) throw error;
}
