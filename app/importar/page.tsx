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
      const parsed = await parseRevolutFile(file);
      if (!parsed.length) {
        setError("Não encontrei despesas no ficheiro. Confirma se exportaste em Excel/CSV.");
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
        <p className="text-muted-foreground">Revolut Excel ou CSV</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Importar despesas</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_0.8fr]">
        <Card className="p-5">
          <label className="grid cursor-pointer place-items-center rounded-[2rem] border border-dashed border-border bg-muted/40 p-8 text-center">
            <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            <span className="text-lg font-bold">Escolher Excel da Revolut</span>
            <span className="mt-2 max-w-sm text-sm text-muted-foreground">
              Exporta o extrato na Revolut em Excel. CSV também funciona. PDF não é fiável para importar automaticamente.
            </span>
            <input accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/pdf" className="sr-only" type="file" onChange={handleFile} />
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

async function parseRevolutFile(file: File): Promise<ParsedExpense[]> {
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    throw new Error("PDF não é suportado para importação automática. Na Revolut, exporta em Excel para evitar valores mal lidos.");
  }

  if (name.endsWith(".xlsx")) {
    return parseRevolutRows(await parseXlsx(file));
  }

  if (name.endsWith(".xls")) {
    throw new Error("O formato .xls antigo não é suportado. Abre o ficheiro no Excel/Numbers e guarda como .xlsx.");
  }

  return parseRevolutRows(parseCsv(await file.text()));
}

function parseRevolutRows(records: string[][]): ParsedExpense[] {
  if (records.length < 2) return [];

  const headerIndex = findHeaderRow(records);
  if (headerIndex < 0) return [];

  const headers = records[headerIndex].map(normalizeHeader);
  const body = records.slice(headerIndex + 1);

  return body
    .map((record) => recordToObject(headers, record))
    .map(toExpense)
    .filter((row): row is ParsedExpense => Boolean(row));
}

function findHeaderRow(records: string[][]) {
  return records.findIndex((row) => {
    const normalized = row.map(normalizeHeader);
    const joined = normalized.join(" ");
    const hasDate = joined.includes("date") || joined.includes("data");
    const hasAmount = joined.includes("amount") || joined.includes("valor") || joined.includes("paid out");
    return hasDate && hasAmount;
  });
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
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const serial = Number(trimmed);
    if (serial > 20000 && serial < 80000) {
      const excelEpoch = Date.UTC(1899, 11, 30);
      return formatLocalDate(new Date(excelEpoch + serial * 86400000));
    }
  }

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
