"use client";

import { defaultAccounts, expenseCategories, incomeCategories } from "@/lib/constants";
import { getMonthRange } from "@/lib/finance";
import { getSupabase } from "@/lib/supabase/client";
import type { Account, AccountType, Category, CategoryType, Goal, Transaction, TransactionRule, TransactionType } from "@/lib/types";

const sharedUserId = "main";

type TransactionInput = {
  id?: string;
  type: TransactionType;
  amount: number;
  category_id?: string | null;
  account_id?: string | null;
  from_account_id?: string | null;
  to_account_id?: string | null;
  description: string;
  date: string;
};

async function ensureDefaults() {
  const supabase = getSupabase();

  await supabase.from("profiles").upsert({
    id: sharedUserId,
    full_name: "Gonçalo"
  });

  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("name")
    .eq("user_id", sharedUserId);

  if (accountsError) throw accountsError;

  if (!accounts?.length) {
    const { error } = await supabase.from("accounts").insert(
      defaultAccounts.map((account) => ({
        ...account,
        balance: 0,
        currency: "EUR",
        user_id: sharedUserId
      }))
    );
    if (error) throw error;
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("name,type")
    .eq("user_id", sharedUserId);

  if (categoriesError) throw categoriesError;
  if (categories?.length) return;

  const defaults = [
    ...incomeCategories.map((name) => ({ name, type: "income" as CategoryType })),
    ...expenseCategories.map((name) => ({ name, type: "expense" as CategoryType }))
  ];

  const { error } = await supabase.from("categories").insert(
    defaults.map((category) => ({
      ...category,
      user_id: sharedUserId
    }))
  );
  if (error) throw error;
}

export async function fetchAccounts() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", sharedUserId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Account[];
}

export async function saveAccount(input: {
  id?: string;
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
}) {
  await ensureDefaults();
  const supabase = getSupabase();
  const payload = {
    name: input.name.trim(),
    type: input.type,
    balance: Number(input.balance || 0),
    currency: input.currency || "EUR",
    user_id: sharedUserId
  };

  const { data, error } = input.id
    ? await supabase
        .from("accounts")
        .update(payload)
        .eq("id", input.id)
        .eq("user_id", sharedUserId)
        .select("*")
        .single()
    : await supabase
        .from("accounts")
        .upsert(payload, { onConflict: "user_id,name" })
        .select("*")
        .single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(id: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", sharedUserId)
    .or(`account_id.eq.${id},from_account_id.eq.${id},to_account_id.eq.${id}`);

  if (countError) throw countError;
  if ((count || 0) > 0) {
    throw new Error("Esta conta tem movimentos associados. Apaga ou edita esses movimentos antes de apagar a conta.");
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", sharedUserId);

  if (error) throw error;
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

const transactionRuleSelect = "*, categories(id,name,type)";

export async function fetchTransactionRules() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transaction_rules")
    .select(transactionRuleSelect)
    .eq("user_id", sharedUserId)
    .order("confidence", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingTableError(error)) return [] as TransactionRule[];
    throw error;
  }

  return data as TransactionRule[];
}

export async function saveTransactionRules(
  rules: Array<{
    merchant_pattern: string;
    transaction_type: TransactionType;
    category?: string | null;
    confidence?: number;
  }>
) {
  await ensureDefaults();
  const supabase = getSupabase();
  const categories = await fetchCategories();
  const payload: Array<{
    user_id: string;
    merchant_pattern: string;
    transaction_type: TransactionType;
    category_id: string | null;
    confidence: number;
  }> = rules
    .map((rule) => {
      const pattern = rule.merchant_pattern.trim();
      if (!pattern) return null;

      const category = rule.transaction_type === "transfer"
        ? null
        : categories.find(
            (item) =>
              item.type === rule.transaction_type &&
              item.name.localeCompare(rule.category || "", "pt-PT", { sensitivity: "accent" }) === 0
          );

      return {
        user_id: sharedUserId,
        merchant_pattern: pattern,
        transaction_type: rule.transaction_type,
        category_id: category?.id || null,
        confidence: Math.max(50, Math.min(100, Math.round(rule.confidence || 96)))
      };
    })
    .filter((rule): rule is {
      user_id: string;
      merchant_pattern: string;
      transaction_type: TransactionType;
      category_id: string | null;
      confidence: number;
    } => Boolean(rule));

  if (!payload.length) return;

  const { error } = await supabase
    .from("transaction_rules")
    .upsert(payload, { onConflict: "user_id,merchant_pattern" });

  if (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}

async function getOrCreateCategory(name: string, type: CategoryType) {
  const cleanName = name.trim() || "Outros";
  const categories = await fetchCategories();
  const existing = categories.find(
    (category) =>
      category.type === type &&
      category.name.localeCompare(cleanName, "pt-PT", { sensitivity: "accent" }) === 0
  );

  if (existing) return existing;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      name: cleanName,
      type,
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
  type: CategoryType;
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

const transactionSelect = `
  *,
  categories(id,name,type),
  accounts:accounts!transactions_account_id_fkey(id,name,type),
  from_account:accounts!transactions_from_account_id_fkey(id,name,type),
  to_account:accounts!transactions_to_account_id_fkey(id,name,type)
`;

export async function fetchTransactions(month: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const { start, end } = getMonthRange(month);
  const { data, error } = await supabase
    .from("transactions")
    .select(transactionSelect)
    .eq("user_id", sharedUserId)
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data as Transaction[];
}

export async function fetchAllTransactions() {
  await ensureDefaults();
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select(transactionSelect)
    .eq("user_id", sharedUserId)
    .order("date", { ascending: true });

  if (error) throw error;
  return data as Transaction[];
}

export async function saveTransaction(input: TransactionInput) {
  const supabase = getSupabase();
  await ensureDefaults();

  const existing = input.id ? await fetchTransaction(input.id) : null;
  if (existing) await applyBalanceChange(existing, "reverse");

  const payload = normalizeTransactionInput(input);
  const { data, error } = input.id
    ? await supabase
        .from("transactions")
        .update(payload)
        .eq("id", input.id)
        .eq("user_id", sharedUserId)
        .select(transactionSelect)
        .single()
    : await supabase
        .from("transactions")
        .insert(payload)
        .select(transactionSelect)
        .single();

  if (error) {
    if (existing) await applyBalanceChange(existing, "apply");
    throw error;
  }

  await applyBalanceChange(data as Transaction, "apply");
  return data as Transaction;
}

export async function deleteTransaction(id: string) {
  await ensureDefaults();
  const supabase = getSupabase();
  const existing = await fetchTransaction(id);
  if (existing) await applyBalanceChange(existing, "reverse");

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", sharedUserId);

  if (error) {
    if (existing) await applyBalanceChange(existing, "apply");
    throw error;
  }
}

export async function deleteTransactionsForMonth(month: string) {
  await ensureDefaults();
  const transactions = await fetchTransactions(month);

  for (const transaction of transactions) {
    await deleteTransaction(transaction.id);
  }

  return transactions.length;
}

async function fetchTransaction(id: string) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("transactions")
    .select(transactionSelect)
    .eq("id", id)
    .eq("user_id", sharedUserId)
    .maybeSingle();

  if (error) throw error;
  return data as Transaction | null;
}

function normalizeTransactionInput(input: TransactionInput) {
  const type = input.type;
  return {
    user_id: sharedUserId,
    type,
    amount: Math.abs(Number(input.amount || 0)),
    category_id: type === "transfer" ? null : input.category_id || null,
    account_id: type === "transfer" ? null : input.account_id || null,
    from_account_id: type === "transfer" ? input.from_account_id || null : null,
    to_account_id: type === "transfer" ? input.to_account_id || null : null,
    description: input.description.trim(),
    date: input.date
  };
}

async function applyBalanceChange(transaction: Transaction, mode: "apply" | "reverse") {
  const amount = Number(transaction.amount || 0);
  const direction = mode === "apply" ? 1 : -1;

  if (transaction.type === "income" && transaction.account_id) {
    await incrementAccountBalance(transaction.account_id, amount * direction);
  }

  if (transaction.type === "expense" && transaction.account_id) {
    await incrementAccountBalance(transaction.account_id, -amount * direction);
  }

  if (transaction.type === "transfer") {
    if (transaction.from_account_id) {
      await incrementAccountBalance(transaction.from_account_id, -amount * direction);
    }
    if (transaction.to_account_id) {
      await incrementAccountBalance(transaction.to_account_id, amount * direction);
    }
  }
}

async function incrementAccountBalance(accountId: string, delta: number) {
  const supabase = getSupabase();
  const { data: account, error: fetchError } = await supabase
    .from("accounts")
    .select("balance")
    .eq("id", accountId)
    .eq("user_id", sharedUserId)
    .single();

  if (fetchError) throw fetchError;

  const nextBalance = Number(account.balance || 0) + delta;
  const { error } = await supabase
    .from("accounts")
    .update({ balance: nextBalance })
    .eq("id", accountId)
    .eq("user_id", sharedUserId);

  if (error) throw error;
}

export async function importTransactions(
  rows: Array<{
    type: TransactionType;
    amount: number;
    category?: string;
    description: string;
    date: string;
    account_name?: string;
    from_account_name?: string;
    to_account_name?: string;
  }>
) {
  await ensureDefaults();
  const accounts = await fetchAccounts();
  const fallbackAccount = accounts[0];
  const existing = await fetchAllTransactions();
  const existingKeys = new Set(
    existing.map((transaction) =>
      [
        transaction.type,
        transaction.date,
        Number(transaction.amount).toFixed(2),
        transaction.description?.trim().toLowerCase() || "",
        transaction.categories?.name?.trim().toLowerCase() || "",
        transaction.accounts?.name?.trim().toLowerCase() || "",
        transaction.from_account?.name?.trim().toLowerCase() || "",
        transaction.to_account?.name?.trim().toLowerCase() || ""
      ].join("|")
    )
  );

  let inserted = 0;
  let skipped = 0;
  const preparedRows: TransactionInput[] = [];
  const nextKeys = new Set(existingKeys);
  const preparedTransfers: TransactionInput[] = [];

  for (const row of rows) {
    const amount = Math.abs(Number(row.amount));
    const category = row.type === "transfer" ? null : await getOrCreateCategory(row.category || "Outros", row.type as CategoryType);
    const account = row.type === "transfer" ? null :
      findAccountByName(accounts, row.account_name) ||
      fallbackAccount;
    const fromAccount = row.type === "transfer"
      ? findAccountByName(accounts, row.from_account_name)
      : null;
    const toAccount = row.type === "transfer"
      ? findAccountByName(accounts, row.to_account_name)
      : null;
    const key = [
      row.type,
      row.date,
      amount.toFixed(2),
      row.description.trim().toLowerCase(),
      category?.name.trim().toLowerCase() || "",
      account?.name.trim().toLowerCase() || "",
      fromAccount?.name.trim().toLowerCase() || "",
      toAccount?.name.trim().toLowerCase() || ""
    ].join("|");

    const duplicateTransfer = row.type === "transfer" && fromAccount && toAccount && (
      hasSimilarTransfer(existing, row.date, amount, fromAccount.id, toAccount.id) ||
      preparedTransfers.some((transaction) =>
        isSimilarTransfer(transaction, row.date, amount, fromAccount.id, toAccount.id)
      )
    );

    if (
      existingKeys.has(key) ||
      duplicateTransfer ||
      (row.type === "transfer" ? (!fromAccount || !toAccount) : !account || !category)
    ) {
      skipped += 1;
      continue;
    }

    if (nextKeys.has(key)) {
      skipped += 1;
      continue;
    }

    const preparedRow = {
      type: row.type,
      amount,
      category_id: category?.id || null,
      account_id: account?.id || null,
      from_account_id: fromAccount?.id || null,
      to_account_id: toAccount?.id || null,
      description: row.description.trim() || "Movimento importado",
      date: row.date
    };
    preparedRows.push(preparedRow);
    if (preparedRow.type === "transfer") preparedTransfers.push(preparedRow);
    nextKeys.add(key);
  }

  const createdTransactions: Transaction[] = [];

  try {
    for (const preparedRow of preparedRows) {
      const transaction = await saveTransaction(preparedRow);
      if (transaction) createdTransactions.push(transaction);
      inserted += 1;
    }
  } catch (error) {
    for (const transaction of createdTransactions.reverse()) {
      await deleteTransaction(transaction.id);
    }
    throw error;
  }

  return { inserted, skipped };
}

function findAccountByName(accounts: Account[], name?: string) {
  const normalizedName = normalizeImportText(name || "");
  if (!normalizedName) return undefined;

  return accounts.find((account) => {
    const accountName = normalizeImportText(account.name);
    return accountName === normalizedName || accountName.includes(normalizedName) || normalizedName.includes(accountName);
  });
}

function hasSimilarTransfer(
  transactions: Transaction[],
  date: string,
  amount: number,
  fromAccountId: string,
  toAccountId: string
) {
  return transactions.some((transaction) =>
    isSimilarTransfer(transaction, date, amount, fromAccountId, toAccountId)
  );
}

function isSimilarTransfer(
  transaction: Pick<TransactionInput, "type" | "date" | "amount" | "from_account_id" | "to_account_id">,
  date: string,
  amount: number,
  fromAccountId: string,
  toAccountId: string
) {
  if (transaction.type !== "transfer") return false;
  if ((transaction.from_account_id || null) !== fromAccountId || (transaction.to_account_id || null) !== toAccountId) return false;
  if (Math.abs(Number(transaction.amount || 0) - amount) > 0.02) return false;
  return Math.abs(daysBetweenImportDates(transaction.date, date)) <= 3;
}

function daysBetweenImportDates(a: string, b: string) {
  const first = new Date(`${a}T00:00:00`).getTime();
  const second = new Date(`${b}T00:00:00`).getTime();
  return Math.round((first - second) / 86400000);
}

function normalizeImportText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isMissingTableError(error: { code?: string; message?: string }) {
  return error.code === "42P01" || Boolean(error.message?.toLowerCase().includes("transaction_rules"));
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
