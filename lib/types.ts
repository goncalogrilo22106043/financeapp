export type TransactionType = "income" | "expense" | "transfer";
export type CategoryType = "income" | "expense";
export type AccountType = "bank" | "wallet" | "cash" | "other";

export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  created_at: string;
};

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category_id: string | null;
  account_id: string | null;
  from_account_id: string | null;
  to_account_id: string | null;
  description: string | null;
  date: string;
  created_at: string;
  updated_at?: string;
  categories?: Pick<Category, "id" | "name" | "type"> | null;
  accounts?: Pick<Account, "id" | "name" | "type"> | null;
  from_account?: Pick<Account, "id" | "name" | "type"> | null;
  to_account?: Pick<Account, "id" | "name" | "type"> | null;
};

export type TransactionRule = {
  id: string;
  user_id: string;
  merchant_pattern: string;
  transaction_type: TransactionType;
  category_id: string | null;
  confidence: number;
  created_at: string;
  categories?: Pick<Category, "id" | "name" | "type"> | null;
};

export type Goal = {
  id: string;
  user_id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  created_at: string;
};

export type FinanceSummary = {
  income: number;
  expenses: number;
  balance: number;
  savingsRate: number;
  netWorth: number;
};
