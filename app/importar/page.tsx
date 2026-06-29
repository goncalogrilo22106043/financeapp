"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileUp, Info } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { importTransactions } from "@/lib/supabase/queries";
import type { TransactionType } from "@/lib/types";
import { euros } from "@/lib/utils";

type ParsedImportRow = {
  id: string;
  selected: boolean;
  type: TransactionType;
  amount: number;
  category: string;
  description: string;
  date: string;
  payment_method: string;
  ignoredReason?: string;
};

type ImportResult = {
  inserted: number;
  skipped: number;
};

type PdfTextItem = {
  str: string;
  transform: number[];
};

type PdfJs = {
  version: string;
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (source: {
    data: Uint8Array;
  }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: (options?: { normalizeWhitespace?: boolean }) => Promise<{
          items: PdfTextItem[];
        }>;
      }>;
    }>;
  };
};

const pdfJsVersion = "4.10.38";

export default function ImportPage() {
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selected),
    [rows]
  );
  const selectedExpenses = useMemo(
    () => selectedRows.filter((row) => row.type === "expense"),
    [selectedRows]
  );
  const selectedIncome = useMemo(
    () => selectedRows.filter((row) => row.type === "income"),
    [selectedRows]
  );
  const expenseTotal = useMemo(
    () => selectedExpenses.reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [selectedExpenses]
  );
  const incomeTotal = useMemo(
    () => selectedIncome.reduce((sum, row) => sum + Math.abs(row.amount), 0),
    [selectedIncome]
  );

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setError("");
    setRows([]);
    setFileName(file?.name || "");

    if (!file) return;

    try {
      const parsed = await parseImportFile(file);
      if (!parsed.length) {
        setError("Não encontrei transações no ficheiro. Confirma se o extrato tem movimentos com data e valor.");
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
      setResult(await importTransactions(selectedRows));
      setRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao importar para a Supabase.");
    } finally {
      setImporting(false);
    }
  }

  function updateRow(id: string, updates: Partial<ParsedImportRow>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...updates } : row)));
  }

  function selectAll(value: boolean) {
    setRows((current) =>
      current.map((row) => ({ ...row, selected: value }))
    );
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
        <p className="text-muted-foreground">Revolut Excel/CSV ou Millennium PDF</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Importar transações</h1>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,0.55fr)_minmax(0,1.45fr)]">
        <Card className="p-5">
          <label className="grid cursor-pointer place-items-center rounded-[2rem] border border-dashed border-border bg-muted/40 p-8 text-center md:p-5">
            <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            <span className="text-lg font-bold">Escolher ficheiro do banco</span>
            <span className="mt-2 max-w-sm text-sm text-muted-foreground">
              Revolut funciona em Excel/CSV. Millennium funciona em PDF. Vais confirmar cada transação antes de importar.
            </span>
            <input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" className="sr-only" type="file" onChange={handleFile} />
          </label>

          {fileName ? <p className="mt-4 text-sm text-muted-foreground">Ficheiro: {fileName}</p> : null}
          {error ? <p className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-600">{error}</p> : null}
          {result ? (
            <div className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Importadas {result.inserted} transações. Ignoradas {result.skipped} duplicadas.
            </div>
          ) : null}
        </Card>

        <Card className="min-w-0 p-5">
          <div className="mb-4 flex items-start gap-3">
            <Info className="mt-1 h-5 w-5 text-muted-foreground" />
            <div>
              <h2 className="text-xl font-bold">Pré-visualização</h2>
              <p className="text-sm text-muted-foreground">
                Confirma o que entra. Reembolsos, carregamentos Apple Pay/Open Banking e transferências para ti ficam ignorados.
              </p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Selecionadas</p>
              <strong className="text-2xl">{selectedRows.length}</strong>
            </div>
            <div className="rounded-2xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Ignoradas</p>
              <strong className="text-2xl">{rows.filter((row) => row.ignoredReason).length}</strong>
            </div>
            <div className="rounded-2xl bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-700 dark:text-emerald-300">Receitas</p>
              <strong className="text-2xl text-emerald-700 dark:text-emerald-300">{euros(incomeTotal)}</strong>
            </div>
            <div className="rounded-2xl bg-rose-500/10 p-4">
              <p className="text-xs text-rose-700 dark:text-rose-300">Despesas</p>
              <strong className="text-2xl text-rose-700 dark:text-rose-300">{euros(expenseTotal)}</strong>
            </div>
          </div>

          {rows.length ? (
            <div className="mb-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => selectAll(true)}>
                Selecionar tudo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
                Limpar
              </Button>
            </div>
          ) : null}

          <div className="max-h-[34rem] min-w-0 space-y-2 overflow-y-auto overflow-x-hidden pr-1">
            {rows.map((row) => (
              <div
                className={`min-w-0 rounded-2xl border border-border p-3 ${
                  row.ignoredReason ? "opacity-60" : ""
                }`}
                key={row.id}
              >
                <div className="flex min-w-0 items-start gap-3">
                  <input
                    checked={row.selected}
                    className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
                    type="checkbox"
                    onChange={(event) => updateRow(row.id, { selected: event.target.checked })}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <p className="min-w-0 break-words font-semibold leading-snug">{row.description}</p>
                      <strong className={`shrink-0 whitespace-nowrap ${row.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                        {row.type === "income" ? "+" : "-"}
                        {euros(Math.abs(row.amount))}
                      </strong>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.date} · {row.category}
                    </p>
                    {row.ignoredReason && !row.selected ? (
                      <p className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                        Ignorada automaticamente: {row.ignoredReason}
                      </p>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-[8rem_1fr]">
                        <select
                          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                          value={row.type}
                          onChange={(event) =>
                            updateRow(row.id, { type: event.target.value as TransactionType })
                          }
                        >
                          <option value="expense">Despesa</option>
                          <option value="income">Receita</option>
                        </select>
                        <input
                          className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
                          value={row.category}
                          onChange={(event) => updateRow(row.id, { category: event.target.value })}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Button className="mt-5 w-full" disabled={!selectedRows.length || importing} size="lg" onClick={handleImport}>
            {importing ? "A importar..." : "Importar selecionadas"}
          </Button>
        </Card>
      </div>
    </AppShell>
  );
}

async function parseImportFile(file: File): Promise<ParsedImportRow[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return parseMillenniumPdf(file);
  }

  if (name.endsWith(".xlsx")) {
    return parseRevolutRows(await parseXlsx(file));
  }

  if (name.endsWith(".xls")) {
    throw new Error("O formato .xls antigo não é suportado. Abre o ficheiro no Excel/Numbers e guarda como .xlsx.");
  }

  return parseRevolutRows(parseCsv(await file.text()));
}

async function parseMillenniumPdf(file: File): Promise<ParsedImportRow[]> {
  const lines = await extractPdfLines(file);
  const movements = parseMillenniumLines(lines);

  if (!movements.length) {
    throw new Error("Não consegui encontrar movimentos nesse PDF. Se conseguires, envia-me um PDF de exemplo do Millennium para afinar o formato.");
  }

  return movements;
}

async function extractPdfLines(file: File) {
  const pdfjsUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/build/pdf.mjs`;
  const pdfjs = (await import(/* webpackIgnore: true */ pdfjsUrl)) as PdfJs;
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfJsVersion}/build/pdf.worker.mjs`;

  const pdf = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer())
  }).promise;
  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({ normalizeWhitespace: true });
    lines.push(...itemsToLines(textContent.items));
  }

  return lines.map(cleanWhitespace).filter(Boolean);
}

function itemsToLines(items: PdfTextItem[]) {
  const sorted = items
    .filter((item) => item.str.trim())
    .map((item) => ({
      text: item.str,
      x: item.transform[4] || 0,
      y: Math.round(item.transform[5] || 0)
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows: Array<{ y: number; items: Array<{ text: string; x: number }> }> = [];

  sorted.forEach((item) => {
    const row = rows.find((candidate) => Math.abs(candidate.y - item.y) <= 2);
    if (row) {
      row.items.push(item);
      row.y = Math.round((row.y + item.y) / 2);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  });

  return rows.map((row) =>
    row.items
      .sort((a, b) => a.x - b.x)
      .map((item) => item.text)
      .join(" ")
  );
}

function parseMillenniumLines(lines: string[]): ParsedImportRow[] {
  const chunks: string[] = [];
  let current = "";
  const statementYear = getMillenniumStatementYear(lines);
  let previousBalance = getMillenniumInitialBalance(lines);
  let movementStarted = false;
  let tableStarted = false;
  let movementEnded = false;

  lines.forEach((line) => {
    if (movementEnded) return;

    const normalizedLine = normalizeValue(line);
    if (normalizedLine.includes("descritivo")) {
      tableStarted = true;
      return;
    }

    if (normalizedLine.includes("saldo inicial")) {
      movementStarted = true;
      tableStarted = true;
      return;
    }

    if (!movementStarted || !tableStarted) return;

    if (normalizedLine.includes("saldo final")) {
      if (current) chunks.push(current);
      current = "";
      movementEnded = true;
      return;
    }

    if (isPdfNoiseLine(line)) return;

    if (startsWithDate(line)) {
      if (current) chunks.push(current);
      current = line;
      return;
    }

    if (current && !startsWithDate(line)) {
      current = `${current} ${line}`;
    }
  });

  if (current) chunks.push(current);

  return chunks
    .map((chunk) => {
      const parsed = toMillenniumRow(chunk, statementYear, previousBalance);
      if (Number.isFinite(parsed?.balance)) {
        previousBalance = parsed?.balance || previousBalance;
      }
      return parsed?.row || null;
    })
    .filter((row): row is ParsedImportRow => Boolean(row))
    .map((row, index) => ({ ...row, id: `${row.id}|millennium|${index}` }));
}

function toMillenniumRow(
  line: string,
  statementYear: string,
  previousBalance: number
): { row: ParsedImportRow; balance: number } | null {
  const dateMatch = line.match(/\b(\d{1,2}[.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/);
  if (!dateMatch) return null;

  const moneyMatches = findMoneyMatches(line);
  if (!moneyMatches.length) return null;

  const amountMatch = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0];
  const balanceMatch = moneyMatches[moneyMatches.length - 1];
  const balance = parseMoney(balanceMatch.raw);
  const amount = parseMillenniumSignedAmount(amountMatch.raw, line, previousBalance, balance);
  if (!Number.isFinite(amount) || amount === 0) return null;

  const date = parseMillenniumDate(dateMatch[1], statementYear);
  if (!date) return null;

  const description = cleanMillenniumDescription(line, dateMatch[1], moneyMatches.map((match) => match.raw));
  const normalizedDescription = normalizeValue(description);
  const isIncome = amount > 0;
  const type: TransactionType = isIncome ? "income" : "expense";
  const ignoredReason =
    normalizedDescription.includes("revolut") ? "carregamento/top-up teu" : getMillenniumIgnoredReason(normalizedDescription, isIncome);

  return {
    row: {
      id: [date, amount.toFixed(2), description].join("|"),
      selected: !ignoredReason,
      type,
      amount: Math.abs(amount),
      category: guessMillenniumCategory(description, type),
      description,
      date,
      payment_method: "Millennium",
      ignoredReason
    },
    balance
  };
}

function findMoneyMatches(line: string) {
  const matches = Array.from(
    line.matchAll(/(?<![A-Z0-9])(?:[-+]\s*)?\d{1,3}(?:[ .]\d{3})*[,.]\d{2}\s*(?:[-+]|EUR|€|D|C|CR|DR)?/gi)
  );

  return matches.map((match) => ({
    raw: match[0].trim(),
    index: match.index || 0
  }));
}

function parseMillenniumSignedAmount(raw: string, line: string, previousBalance: number, currentBalance: number) {
  const fallbackAmount = parseSignedMoney(raw, line);
  const amount = Math.abs(parseMoney(raw));

  if (Number.isFinite(previousBalance) && Number.isFinite(currentBalance)) {
    const delta = roundMoney(currentBalance - previousBalance);
    if (Math.abs(Math.abs(delta) - amount) <= 0.02) {
      return delta;
    }
  }

  return fallbackAmount;
}

function parseSignedMoney(raw: string, line: string) {
  const normalizedRaw = normalizeValue(raw);
  const normalizedLine = normalizeValue(line);
  const amount = Math.abs(parseMoney(raw));

  if (
    normalizedRaw.includes("-") ||
    normalizedRaw.endsWith("d") ||
    normalizedRaw.endsWith("dr") ||
    /\b(debito|pagamento|compra|levantamento|comissao|imposto|sepa dd|transferencia emitida)\b/.test(normalizedLine)
  ) {
    return -amount;
  }

  if (
    normalizedRaw.includes("+") ||
    normalizedRaw.endsWith("c") ||
    normalizedRaw.endsWith("cr") ||
    /\b(credito|deposito|vencimento|salario|transferencia recebida|trf recebida)\b/.test(normalizedLine)
  ) {
    return amount;
  }

  return -amount;
}

function getMillenniumIgnoredReason(description: string, isIncome: boolean) {
  if (isIncome && isOwnMillenniumIncomeTransfer(description)) {
    return "";
  }

  return getIgnoredReason(description, "", isIncome);
}

function isOwnMillenniumIncomeTransfer(description: string) {
  const hasOwnName =
    description.includes("goncalo grilo") ||
    description.includes("goncalo galvao grilo") ||
    description.includes("goncalo galvao de sousa grilo");

  return hasOwnName && (description.includes("trf p/o") || description.includes("trf. p/o"));
}

function getMillenniumStatementYear(lines: string[]) {
  const joined = lines.join(" ");
  const rangeMatch = joined.match(/EXTRATO DE\s+(\d{4})[/-]\d{1,2}[/-]\d{1,2}/i);
  if (rangeMatch) return rangeMatch[1];

  const statementMatch = joined.match(/\bN\.\s*(\d{4})\//i);
  if (statementMatch) return statementMatch[1];

  return String(new Date().getFullYear());
}

function getMillenniumInitialBalance(lines: string[]) {
  const line = lines.find((item) => normalizeValue(item).includes("saldo inicial")) || "";
  const match = findMoneyMatches(line)[0];
  return match ? parseMoney(match.raw) : Number.NaN;
}

function parseMillenniumDate(value: string, statementYear: string) {
  const shortDate = value.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (shortDate) {
    return `${statementYear}-${shortDate[1].padStart(2, "0")}-${shortDate[2].padStart(2, "0")}`;
  }

  return parseDate(value);
}

function cleanMillenniumDescription(line: string, date: string, moneyValues: string[]) {
  let description = line.replace(date, " ");
  description = description.replace(/\b(\d{1,2}[.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/g, " ");
  moneyValues.forEach((value) => {
    description = description.replace(value, " ");
  });
  return cleanWhitespace(description).replace(/^[-:./\s]+|[-:./\s]+$/g, "") || "Movimento Millennium";
}

function guessMillenniumCategory(description: string, type: TransactionType) {
  const text = normalizeValue(description);

  if (type === "income") {
    if (text.includes("salario") || text.includes("vencimento")) return "Salário";
    if (text.includes("investimento") || text.includes("juros") || text.includes("dividendo")) return "Investimentos";
    return "Outros";
  }

  if (text.includes("combustivel") || text.includes("galp") || text.includes("repsol") || text.includes("bp ")) return "Combustível";
  if (text.includes("portagem") || text.includes("viaverde") || text.includes("via verde")) return "Portagens";
  if (text.includes("continente") || text.includes("pingo doce") || text.includes("lidl") || text.includes("mercadona")) return "Alimentação";
  if (text.includes("gin")) return "Ginásio";
  if (text.includes("netflix") || text.includes("spotify") || text.includes("apple.com") || text.includes("subscr")) return "Subscrições";
  if (text.includes("renda") || text.includes("casa") || text.includes("condominio")) return "Casa";
  if (text.includes("farmacia") || text.includes("saude")) return "Saúde / cuidados pessoais";
  return "Outros";
}

function startsWithDate(line: string) {
  return /^\s*(\d{1,2}[.]\d{1,2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/.test(line);
}

function isPdfNoiseLine(line: string) {
  const normalized = normalizeValue(line);
  return (
    !normalized ||
    normalized.includes("saldo anterior") ||
    normalized.includes("saldo contabilistico") ||
    normalized.includes("saldo disponivel") ||
    normalized.includes("pagina ") ||
    normalized.includes("millennium bcp") ||
    normalized.includes("a transportar") ||
    normalized.includes("transporte") ||
    normalized.includes("capital social") ||
    normalized.includes("matric") ||
    normalized.includes("reg. com") ||
    normalized.includes("data movimento") ||
    normalized.includes("data valor") ||
    normalized.includes("descricao") ||
    normalized.includes("valor") && normalized.includes("saldo")
  );
}

function parseRevolutRows(records: string[][]): ParsedImportRow[] {
  if (records.length < 2) return [];

  const headerIndex = findHeaderRow(records);
  if (headerIndex < 0) return [];

  const headers = records[headerIndex].map(normalizeHeader);
  const body = records.slice(headerIndex + 1);

  return body
    .map((record) => recordToObject(headers, record))
    .map(toImportRow)
    .filter((row): row is ParsedImportRow => Boolean(row))
    .map((row, index) => ({ ...row, id: `${row.id}|${index}` }));
}

function findHeaderRow(records: string[][]) {
  return records.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    const joined = normalized.join(" ");
    const hasDate = joined.includes("date") || joined.includes("data");
    const hasAmount =
      joined.includes("amount") ||
      joined.includes("valor") ||
      joined.includes("montante") ||
      joined.includes("paid in") ||
      joined.includes("paid out");
    return hasDate && hasAmount;
  });
}

function toImportRow(row: Record<string, string>): ParsedImportRow | null {
  const amountMatch = pickMatch(row, ["amount", "valor", "montante"]);
  const paidInMatch = pickMatch(row, ["paid in", "money in", "in"]);
  const paidOutMatch = pickMatch(row, ["paid out", "money out", "out"]);
  let amount = amountMatch.value ? parseMoney(amountMatch.value) : Number.NaN;

  if (!Number.isFinite(amount) && paidInMatch.value) {
    amount = Math.abs(parseMoney(paidInMatch.value));
  }

  if (!Number.isFinite(amount) && paidOutMatch.value) {
    amount = -Math.abs(parseMoney(paidOutMatch.value));
  }

  if (amountMatch.key.includes("paid out") || amountMatch.key.includes("money out")) {
    amount = -Math.abs(amount);
  }
  if (!Number.isFinite(amount) || amount === 0) return null;

  const state = normalizeValue(pick(row, ["state", "estado", "status"]));
  if (state && !["completed", "complete", "concluido", "concluida"].includes(state)) {
    return null;
  }

  const dateRaw = pick(row, [
    "completed date",
    "data de conclusao",
    "data de conclusão",
    "started date",
    "data de inicio",
    "data de início",
    "date",
    "data",
    "created at"
  ]);
  const date = parseDate(dateRaw);
  if (!date) return null;

  const description = pick(row, ["description", "descricao", "descrição", "merchant", "name", "counterparty"]) || "Despesa Revolut";
  const rawCategory = pick(row, ["category", "categoria", "expense category", "merchant category", "tipo"]);
  const normalizedDescription = normalizeValue(description);
  const normalizedCategory = normalizeValue(rawCategory);
  const isIncome = amount > 0;
  const ignoredReason = getIgnoredReason(normalizedDescription, normalizedCategory, isIncome);
  const type: TransactionType = isIncome ? "income" : "expense";

  return {
    id: [
      date,
      amount.toFixed(2),
      description,
      rawCategory
    ].join("|"),
    selected: !ignoredReason,
    type,
    amount: Math.abs(amount),
    category: rawCategory || (type === "income" ? "Outros" : "Revolut"),
    description,
    date,
    payment_method: "Revolut",
    ignoredReason
  };
}

function getIgnoredReason(description: string, category: string, isIncome: boolean) {
  if (isOwnAccountTransfer(description)) {
    return "transferência entre contas tuas";
  }

  if (isOwnTopUp(description, category)) {
    return "carregamento/top-up teu";
  }

  if (isIncome && isRefund(description, category)) {
    return "reembolso";
  }

  return "";
}

function isOwnAccountTransfer(description: string) {
  const hasOwnName =
    description.includes("goncalo grilo") ||
    description.includes("goncalo galvao grilo") ||
    description.includes("goncalo galvao de sousa grilo");

  return (
    hasOwnName &&
    (description.startsWith("to ") ||
      description.startsWith("from ") ||
      description.includes("trf p/") ||
      description.includes("trf. p/") ||
      description.includes("trf p/o") ||
      description.includes("trf. p/o") ||
      description.includes("transferencia para") ||
      description.includes("transferencia de"))
  );
}

function isOwnTopUp(description: string, category: string) {
  const text = `${description} ${category}`;
  return (
    text.includes("apple pay") ||
    text.includes("top-up") ||
    text.includes("top up") ||
    text.includes("card top-up") ||
    text.includes("card top up") ||
    text.includes("carregamento com apple pay") ||
    text.includes("carregamento com open banking")
  );
}

function isRefund(description: string, category: string) {
  const text = `${description} ${category}`;
  return (
    text.includes("refund") ||
    text.includes("refunded") ||
    text.includes("reembolso") ||
    text.startsWith("cred") ||
    text.includes("cashback") ||
    text.includes("chargeback") ||
    text.includes("reversal") ||
    text.includes("revertida") ||
    text.includes("devolucao")
  );
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
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
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

  if (lastDot > -1 && cleaned.length - lastDot - 1 === 2) {
    return Number(cleaned.replaceAll(",", ""));
  }

  return Number(cleaned.replaceAll(",", ""));
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDate(value: string) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return formatLocalDate(new Date(excelEpoch + serial * 86400000));
    }
  }

  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const european = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})/);
  if (european) {
    const year = european[3].length === 2 ? `20${european[3]}` : european[3];
    return `${year}-${european[2].padStart(2, "0")}-${european[1].padStart(2, "0")}`;
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

async function parseXlsx(file: File) {
  const entries = await readZipEntries(await file.arrayBuffer());
  const sharedStrings = parseSharedStrings(entries.get("xl/sharedStrings.xml") || "");
  const sheetPath = getFirstSheetPath(entries) || "xl/worksheets/sheet1.xml";
  const sheetXml = entries.get(sheetPath);

  if (!sheetXml) {
    throw new Error("Não consegui encontrar a primeira folha do Excel.");
  }

  return parseSheet(sheetXml, sharedStrings);
}

async function readZipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  let eocdOffset = -1;

  for (let offset = bytes.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) throw new Error("Este ficheiro Excel não parece ser um .xlsx válido.");

  const centralDirectoryOffset = view.getUint32(eocdOffset + 16, true);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  const entries = new Map<string, string>();
  let pointer = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) break;

    const method = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const fileNameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const localHeaderOffset = view.getUint32(pointer + 42, true);
    const name = decoder.decode(bytes.slice(pointer + 46, pointer + 46 + fileNameLength));

    const localNameLength = view.getUint16(localHeaderOffset + 26, true);
    const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(dataStart, dataStart + compressedSize);

    if (name.endsWith(".xml") || name.endsWith(".rels")) {
      entries.set(name, await decodeZipEntry(compressed, method));
    }

    pointer += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

async function decodeZipEntry(bytes: Uint8Array, method: number) {
  if (method === 0) return new TextDecoder().decode(bytes);
  if (method !== 8) throw new Error("O Excel usa uma compressão não suportada.");

  const arrayBuffer = bytes.slice().buffer as ArrayBuffer;
  const stream = new Blob([arrayBuffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function parseSharedStrings(xml: string) {
  if (!xml) return [];
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("si")).map((item) => item.textContent || "");
}

function getFirstSheetPath(entries: Map<string, string>) {
  const workbook = entries.get("xl/workbook.xml");
  const rels = entries.get("xl/_rels/workbook.xml.rels");
  if (!workbook || !rels) return "";

  const workbookDoc = new DOMParser().parseFromString(workbook, "application/xml");
  const firstSheet = workbookDoc.getElementsByTagName("sheet")[0];
  const relId = firstSheet?.getAttribute("r:id");
  if (!relId) return "";

  const relsDoc = new DOMParser().parseFromString(rels, "application/xml");
  const relationship = Array.from(relsDoc.getElementsByTagName("Relationship")).find(
    (rel) => rel.getAttribute("Id") === relId
  );
  const target = relationship?.getAttribute("Target") || "";
  if (!target) return "";

  return target.startsWith("/") ? target.slice(1) : `xl/${target.replace("../", "")}`;
}

function parseSheet(xml: string, sharedStrings: string[]) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  return Array.from(doc.getElementsByTagName("row")).map((row) => {
    const values: string[] = [];

    Array.from(row.getElementsByTagName("c")).forEach((cell) => {
      const ref = cell.getAttribute("r") || "";
      const index = columnIndex(ref.replace(/[0-9]/g, ""));
      const type = cell.getAttribute("t");
      const rawValue = cell.getElementsByTagName("v")[0]?.textContent || "";
      const inlineValue = cell.getElementsByTagName("is")[0]?.textContent || "";

      if (type === "s") {
        values[index] = sharedStrings[Number(rawValue)] || "";
      } else if (type === "inlineStr") {
        values[index] = inlineValue;
      } else {
        values[index] = rawValue;
      }
    });

    return values.map((value) => value || "");
  });
}

function columnIndex(letters: string) {
  return letters
    .toUpperCase()
    .split("")
    .reduce((sum, letter) => sum * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}
