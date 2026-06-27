"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { addMonths, monthLabel } from "@/lib/utils";

export function MonthPicker({
  month,
  onChange
}: {
  month: string;
  onChange: (month: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Button aria-label="Mês anterior" size="icon" type="button" variant="secondary" onClick={() => onChange(addMonths(month, -1))}>
        <ChevronLeft className="h-5 w-5" />
      </Button>
      <label className="min-w-0 flex-1">
        <span className="sr-only">Mês</span>
        <input
          className="h-11 w-full rounded-2xl border border-border bg-card px-4 text-center text-sm font-semibold capitalize outline-none focus:ring-4 focus:ring-foreground/10"
          type="month"
          value={month}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      <Button aria-label="Mês seguinte" size="icon" type="button" variant="secondary" onClick={() => onChange(addMonths(month, 1))}>
        <ChevronRight className="h-5 w-5" />
      </Button>
      <span className="sr-only">{monthLabel(month)}</span>
    </div>
  );
}
