export type TransactionType = "income" | "expense";

export type Profile = {
  id: string;
  full_name: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  user_id: string;
  name: string;
  type: TransactionType;
  created_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  category_id: string | null;
  description: string | null;
  payment_method: string | null;
  date: string;
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
};
