import { ArrowDownRight, ArrowUpRight, Landmark, Percent } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FinanceSummary } from "@/lib/types";
import { euros } from "@/lib/utils";

export function SummaryCards({ summary }: { summary: FinanceSummary }) {
  return (
    <section className="grid gap-3">
      <Card className="overflow-hidden bg-foreground p-6 text-background">
        <p className="text-sm text-background/70">Saldo do mês</p>
        <strong className="mt-3 block text-4xl font-bold tracking-tight">{euros(summary.balance)}</strong>
        <p className="mt-3 text-sm text-background/70">
          {summary.balance >= 0 ? "Estás positivo este mês." : "Este mês está negativo."}
        </p>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <MiniMetric icon={ArrowUpRight} label="Receitas" value={euros(summary.income)} tone="green" />
        <MiniMetric icon={ArrowDownRight} label="Despesas" value={euros(summary.expenses)} tone="red" />
        <MiniMetric icon={Percent} label="Poupança" value={`${summary.savingsRate}%`} tone="blue" />
      </div>
    </section>
  );
}

function MiniMetric({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  tone: "green" | "red" | "blue";
}) {
  const colors = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-rose-600 dark:text-rose-400",
    blue: "text-sky-600 dark:text-sky-400"
  };

  return (
    <Card className="p-4">
      <Icon className={`mb-3 h-5 w-5 ${colors[tone]}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-lg tracking-tight">{value}</strong>
    </Card>
  );
}
