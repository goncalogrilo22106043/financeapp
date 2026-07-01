import { ArrowDownRight, ArrowUpRight, Landmark, Percent, WalletCards } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { FinanceSummary } from "@/lib/types";
import { euros } from "@/lib/utils";

export function SummaryCards({ summary }: { summary: FinanceSummary }) {
  return (
    <section className="grid gap-3">
      <Card className="overflow-hidden bg-foreground p-6 text-background">
        <p className="text-sm text-background/70">Poupança do mês</p>
        <strong className="mt-3 block text-4xl font-bold tracking-tight">{euros(summary.balance)}</strong>
        <p className="mt-3 text-sm text-background/70">
          Receitas reais menos despesas reais. Transferências ficam fora.
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MiniMetric icon={ArrowUpRight} label="Receitas reais" value={euros(summary.income)} tone="green" />
        <MiniMetric icon={ArrowDownRight} label="Despesas pessoais" value={euros(summary.expenses)} tone="red" />
        <MiniMetric icon={Percent} label="Taxa de poupança" value={`${summary.savingsRate}%`} tone="blue" />
        <MiniMetric icon={WalletCards} label="Património" value={euros(summary.netWorth)} tone="slate" />
      </div>
      <Card className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Movimentos ignorados no resumo
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <IgnoredMetric label="Transferências" value={summary.ignored.transfers} />
          <IgnoredMetric label="Dinheiro de terceiros" value={summary.ignored.thirdParty} />
          <IgnoredMetric label="Investimentos" value={summary.ignored.investments} />
          <IgnoredMetric label="Reembolsáveis" value={summary.ignored.reimbursable} />
        </div>
      </Card>
    </section>
  );
}

function IgnoredMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <strong className="mt-1 block">{euros(value)}</strong>
    </div>
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
  tone: "green" | "red" | "blue" | "slate";
}) {
  const colors = {
    green: "text-emerald-600 dark:text-emerald-400",
    red: "text-rose-600 dark:text-rose-400",
    blue: "text-sky-600 dark:text-sky-400",
    slate: "text-slate-600 dark:text-slate-300"
  };

  return (
    <Card className="p-4">
      <Icon className={`mb-3 h-5 w-5 ${colors[tone]}`} />
      <p className="text-xs text-muted-foreground">{label}</p>
      <strong className="mt-1 block text-lg tracking-tight">{value}</strong>
    </Card>
  );
}
