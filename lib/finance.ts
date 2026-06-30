import type { Account, CategoryType, FinanceSummary, Transaction } from "@/lib/types";

export function getMonthRange(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  const start = new Date(year, monthIndex - 1, 1);
  const end = new Date(year, monthIndex, 0);
  return {
    start: formatDate(start),
    end: formatDate(end)
  };
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

export function summarize(transactions: Transaction[], accounts: Account[] = []): FinanceSummary {
  const income = sumByType(transactions, "income");
  const expenses = sumByType(transactions, "expense");
  const balance = income - expenses;
  return {
    income,
    expenses,
    balance,
    savingsRate: income > 0 ? Math.round((balance / income) * 100) : 0,
    netWorth: accounts.reduce((sum, account) => sum + Number(account.balance || 0), 0)
  };
}

export function sumByType(transactions: Transaction[], type: CategoryType) {
  return transactions
    .filter((transaction) => transaction.type === type)
    .filter((transaction) => !(type === "income" && isReimbursement(transaction)))
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
}

export function totalsByCategory(transactions: Transaction[], type: CategoryType) {
  const grouped = new Map<string, number>();
  transactions
    .filter((transaction) => transaction.type === type)
    .filter((transaction) => !(type === "income" && isReimbursement(transaction)))
    .forEach((transaction) => {
      const category = transaction.categories?.name || "Sem categoria";
      grouped.set(category, (grouped.get(category) || 0) + Number(transaction.amount || 0));
    });

  return Array.from(grouped, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value
  );
}

export function totalsByAccount(transactions: Transaction[], type: "expense" | "income") {
  const grouped = new Map<string, number>();
  transactions
    .filter((transaction) => transaction.type === type)
    .filter((transaction) => !(type === "income" && isReimbursement(transaction)))
    .forEach((transaction) => {
      const account = transaction.accounts?.name || "Sem conta";
      grouped.set(account, (grouped.get(account) || 0) + Number(transaction.amount || 0));
    });

  return Array.from(grouped, ([name, value]) => ({ name, value })).sort(
    (a, b) => b.value - a.value
  );
}

export function isReimbursement(transaction: Transaction) {
  return normalizeFinanceLabel(transaction.categories?.name || "") === "reembolsos";
}

function normalizeFinanceLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
