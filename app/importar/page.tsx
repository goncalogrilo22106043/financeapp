"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileUp, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importExpenseTransactions } from "@/lib/supabase/queries";
import { euros } from "@/lib/utils";

type ParsedExpense = {
  amount: number;
  category: string;
  description: string;
  date: string;
  payment_method: string;
};

type ImportResult = {
  inserted: number;
  skipped: number;
};

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedExpense[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [rows]
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setError("");
    setRows([]);
    setFileName(file?.name || "");

    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseRevolutCsv(text);
      if (!parsed.length) {
        setError("Não encontrei despesas no ficheiro. Confirma se exportaste em CSV.");
        return;
      }
      setRows(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ler esse ficheiro.");
    }
  }

  async function handleImport() {
    setImporting(true);
    setError("");
    try {
      setResult(await importExpenseTransactions(rows));
      setRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar para a Supabase.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Button asChild className="mb-4" size="sm" variant="ghost">
          <Link href="/transacoes">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>
        <p className="text-muted-foreground">Revolut CSV</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Importar despesas</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <label className="grid cursor-pointer place-items-center rounded-[2rem] border border-dashed border-border bg-muted/40 p-8 text-center">
            <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            <span className="text-lg font-bold">Escolher CSV da Revolut</span>
            <span className="mt-2 max-w-sm text-sm text-muted-foreground">
              Exporta o extrato na Revolut em CSV e carrega aqui. A app importa apenas valores negativos como despesas.
            </span>
            <input accept=".csv,text/csv" className="sr-only" type="file" onChange={handleFile} />
          </label>

          {fileName ? <p className="mt-4 text-sm text-muted-foreground">Ficheiro: {fileName}</p> : null}
          {error ? <p className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {result ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Importadas {result.inserted} despesas. Ignoradas {result.skipped} duplicadas.
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="mb-4 flex items-start gap-3">
            <Info className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-bold">Pré-visualização</h2>
              <p className="text-sm text-muted-foreground">
                Antes de importar, confirma o total e algumas linhas.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Despesas</p>
              <strong className="text-2xl">{rows.length}</strong>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Total</p>
              <strong className="text-2xl">{euros(total)}</strong>
            </div>
          </div>

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {rows.slice(0, 8).map((row, index) => (
              <div className="rounded-2xl border border-border p-3" key={`${row.date}-${row.amount}-${index}`}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-semibold">{row.description}</p>
                  <strong className="text-rose-600">{euros(Math.abs(row.amount))}</strong>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.date} · {row.category}
                </p>
              </div>
            ))}
          </div>

          <Button className="mt-5 w-full" disabled={!rows.length || importing} size="lg" onClick={handleImport}>
            {importing ? "A importar..." : "Importar despesas"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

function parseRevolutCsv(text: string): ParsedExpense[] {
  const records = parseCsv(text);
  if (records.length < 2) return [];

  const headers = records[0].map(normalizeHeader);
  const body = records.slice(1);

  return body
    .map((record) => recordToObject(headers, record))
    .map(toExpense)
    .filter((row): row is ParsedExpense => Boolean(row));
}

function toExpense(row: Record<string, string>): ParsedExpense | null {
  const amountMatch = pickMatch(row, ["amount", "valor", "paid out", "money out", "out"]);
  let amount = parseMoney(amountMatch.value);
  if (amountMatch.key.includes("paid out") || amountMatch.key.includes("money out")) {
    amount = -Math.abs(amount);
  }
  if (!Number.isFinite(amount) || amount >= 0) return null;

  const state = pick(row, ["state", "estado", "status"]);
  if (state && !["completed", "complete", "concluido", "concluído"].includes(state.toLowerCase())) {
    return null;
  }

  const dateRaw = pick(row, ["completed date", "started date", "date", "data", "created at"]);
  const date = parseDate(dateRaw);
  if (!date) return null;

  return {
    amount: Math.abs(amount),
    category: pick(row, ["category", "categoria", "expense category", "merchant category"]) || "Revolut",
    description: pick(row, ["description", "descrição", "merchant", "name", "counterparty"]) || "Despesa Revolut",
    date,
    payment_method: "Revolut"
  };
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function detectDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function recordToObject(headers: string[], record: string[]) {
  return headers.reduce<Record<string, string>>((object, header, index) => {
    object[header] = (record[index] || "").trim();
    return object;
  }, {});
}

function normalizeHeader(value: string) {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase();
}

function pick(row: Record<string, string>, keys: string[]) {
  return pickMatch(row, keys).value;
}

function pickMatch(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value) return { key, value: value.trim() };
  }

  for (const key of keys) {
    const foundKey = Object.keys(row).find((rowKey) => rowKey.includes(key));
    if (foundKey && row[foundKey]) return { key: foundKey, value: row[foundKey].trim() };
  }

  return { key: "", value: "" };
}

function parseMoney(value: string) {
  const cleaned = value.replace(/[^\d,.-]/g, "");
  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    return Number(cleaned.replaceAll(thousandsSeparator, "").replace(decimalSeparator, "."));
  }

  if (lastComma > -1) {
    return Number(cleaned.replaceAll(".", "").replace(",", "."));
  }

  return Number(cleaned.replaceAll(",", ""));
}

function parseDate(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const european = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (european) {
    return `${european[3]}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? "" : formatLocalDate(parsed);
}

function formatLocalDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}
