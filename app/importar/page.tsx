"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileUp, Info, Link2, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { expenseCategories, incomeCategories } from "@/lib/constants";
import { fetchAccounts, fetchAllTransactions, importTransactions } from "@/lib/supabase/queries";
import type { Account, CategoryType, Transaction, TransactionType } from "@/lib/types";
import { cn, euros } from "@/lib/utils";

type ColumnMapping = {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
  currency: string;
  balance: string;
};

type ImportFile = {
  id: string;
  fileName: string;
  accountId: string;
  accountName: string;
  headers: string[];
  records: Record<string, string>[];
  mapping: ColumnMapping;
  needsMapping: boolean;
};

type PreviewRow = {
  id: string;
  fileId: string;
  sourceRow: number;
  selected: boolean;
  duplicate: boolean;
  importAnyway: boolean;
  type: TransactionType;
  suggestedType: TransactionType;
  amount: number;
  signedAmount: number;
  date: string;
  description: string;
  accountId: string;
  accountName: string;
  category: string;
  confidence: number;
  reason: string;
  linkedTransferId?: string;
  transferGroupId?: string;
  fromAccountName?: string;
  toAccountName?: string;
};

type ImportResult = {
  inserted: number;
  skipped: number;
};

const steps = [
  "Carregar ficheiros",
  "Pré-visualização",
  "Confirmar transferências",
  "Guardar"
];

export default function ImportPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [existingTransactions, setExistingTransactions] = useState<Transaction[]>([]);
  const [files, setFiles] = useState<ImportFile[]>([]);
  const [rows, setRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [accountRows, transactionRows] = await Promise.all([
          fetchAccounts(),
          fetchAllTransactions()
        ]);
        setAccounts(accountRows);
        setExistingTransactions(transactionRows);
        setSelectedAccountId(accountRows[0]?.id || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Não consegui carregar os dados.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const selectedRows = useMemo(
    () => rows.filter((row) => row.selected && (!row.duplicate || row.importAnyway)),
    [rows]
  );
  const selectedIncome = useMemo(
    () => selectedRows.filter((row) => row.type === "income"),
    [selectedRows]
  );
  const selectedExpenses = useMemo(
    () => selectedRows.filter((row) => row.type === "expense"),
    [selectedRows]
  );
  const selectedTransfers = useMemo(
    () => selectedRows.filter((row) => row.type === "transfer"),
    [selectedRows]
  );
  const incomeTotal = useMemo(
    () => selectedIncome.reduce((sum, row) => sum + row.amount, 0),
    [selectedIncome]
  );
  const expenseTotal = useMemo(
    () => selectedExpenses.reduce((sum, row) => sum + row.amount, 0),
    [selectedExpenses]
  );
  const transferTotal = useMemo(
    () => selectedTransfers.reduce((sum, row) => sum + row.amount, 0),
    [selectedTransfers]
  );
  const needsMapping = files.some((file) => file.needsMapping);
  const activeStep = rows.length ? (selectedTransfers.length ? 2 : 1) : 0;

  async function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const pickedFiles = Array.from(event.target.files || []);
    const account = accounts.find((item) => item.id === selectedAccountId);
    setError("");
    setSuccess("");
    setResult(null);

    if (!account) {
      setError("Escolhe a conta a que este ficheiro pertence.");
      return;
    }

    if (!pickedFiles.length) return;

    setParsing(true);
    try {
      const parsedFiles = await Promise.all(
        pickedFiles.map((file) => parseCsvFile(file, account))
      );
      const nextFiles = [...files, ...parsedFiles];
      setFiles(nextFiles);
      rebuildRows(nextFiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui ler esse ficheiro.");
    } finally {
      setParsing(false);
      event.target.value = "";
    }
  }

  function updateMapping(fileId: string, key: keyof ColumnMapping, value: string) {
    setFiles((current) =>
      current.map((file) =>
        file.id === fileId
          ? {
              ...file,
              mapping: { ...file.mapping, [key]: value }
            }
          : file
      )
    );
  }

  function applyMapping(fileId: string) {
    const nextFiles = files.map((file) =>
      file.id === fileId
        ? {
            ...file,
            needsMapping: !isUsableMapping(file.mapping)
          }
        : file
    );
    setFiles(nextFiles);
    rebuildRows(nextFiles);
  }

  function rebuildRows(sourceFiles = files) {
    const parsedRows = sourceFiles.flatMap(rowsFromFile);
    const withDuplicates = markDuplicates(parsedRows, existingTransactions);
    setRows(detectInternalTransfers(withDuplicates));
  }

  function updateRow(id: string, updates: Partial<PreviewRow>) {
    setRows((current) =>
      current.map((row) =>
        row.id === id
          ? {
              ...row,
              ...updates,
              selected: updates.importAnyway ? true : updates.selected ?? row.selected
            }
          : row
      )
    );
  }

  function selectAll(value: boolean) {
    setRows((current) =>
      current.map((row) => ({
        ...row,
        selected: row.duplicate && !row.importAnyway ? false : value
      }))
    );
  }

  async function handleImport() {
    setSaving(true);
    setError("");
    setSuccess("");
    setResult(null);

    try {
      const payload = selectedRows.map((row) => {
        if (row.type === "transfer") {
          return {
            type: row.type,
            amount: row.amount,
            description: row.description,
            date: row.date,
            from_account_name: row.fromAccountName,
            to_account_name: row.toAccountName
          };
        }

        return {
          type: row.type,
          amount: row.amount,
          category: row.category || "Outros",
          description: row.description,
          date: row.date,
          account_name: row.accountName
        };
      });

      const importResult = await importTransactions(payload);
      setResult(importResult);
      setSuccess(`Importação guardada: ${importResult.inserted} movimentos criados.`);
      setFiles([]);
      setRows([]);
      setExistingTransactions(await fetchAllTransactions());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao guardar a importação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <Button asChild className="mb-4" size="sm" variant="ghost">
            <Link href="/transacoes">
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Link>
          </Button>
          <p className="text-muted-foreground">Revolut e Millennium CSV</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Importar extratos</h1>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {steps.map((step, index) => (
          <div
            className={cn(
              "rounded-2xl border border-border bg-card p-3 text-sm font-semibold text-muted-foreground",
              index <= activeStep && "border-foreground/20 bg-foreground text-background"
            )}
            key={step}
          >
            <span className="mr-2 opacity-70">{index + 1}</span>
            {step}
          </div>
        ))}
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(18rem,0.55fr)_minmax(0,1.45fr)]">
        <Card className="min-w-0 p-5">
          <div className="mb-4">
            <label className="mb-2 block text-sm font-semibold">Selecionar conta</label>
            <Select
              disabled={loading || !accounts.length}
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </Select>
          </div>

          <label className="grid cursor-pointer place-items-center rounded-[2rem] border border-dashed border-border bg-muted/40 p-7 text-center">
            <FileUp className="mb-4 h-10 w-10 text-muted-foreground" />
            <span className="text-lg font-bold">Escolher CSV</span>
            <span className="mt-2 max-w-sm text-sm text-muted-foreground">
              Carrega um extrato de cada vez e escolhe a conta certa antes de carregar.
            </span>
            <input
              accept=".csv,text/csv"
              className="sr-only"
              multiple
              type="file"
              onChange={handleFiles}
            />
          </label>

          {files.length ? (
            <div className="mt-4 space-y-2">
              {files.map((file) => (
                <div className="rounded-2xl bg-muted p-3 text-sm" key={file.id}>
                  <p className="break-words font-semibold">{file.fileName}</p>
                  <p className="text-muted-foreground">{file.accountName}</p>
                </div>
              ))}
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl bg-rose-500/10 p-4 text-sm font-medium text-rose-600">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="mt-4 rounded-2xl bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              {success}
            </p>
          ) : null}

          {result ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Guardadas {result.inserted}. Ignoradas {result.skipped}.
            </p>
          ) : null}
        </Card>

        <div className="min-w-0 space-y-4">
          {needsMapping ? (
            <Card className="min-w-0 p-5">
              <div className="mb-4 flex items-start gap-3">
                <Info className="mt-1 h-5 w-5 text-muted-foreground" />
                <div>
                  <h2 className="text-xl font-bold">Mapear colunas</h2>
                  <p className="text-sm text-muted-foreground">
                    Não reconheci todas as colunas. Diz-me onde está cada campo e aplico a leitura.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {files
                  .filter((file) => file.needsMapping)
                  .map((file) => (
                    <div className="rounded-3xl border border-border p-4" key={file.id}>
                      <p className="mb-3 break-words font-semibold">{file.fileName}</p>
                      <div className="grid gap-3 md:grid-cols-2">
                        <MappingSelect file={file} label="Data" name="date" onChange={updateMapping} />
                        <MappingSelect file={file} label="Descrição" name="description" onChange={updateMapping} />
                        <MappingSelect file={file} label="Valor" name="amount" onChange={updateMapping} />
                        <MappingSelect file={file} label="Débito" name="debit" onChange={updateMapping} />
                        <MappingSelect file={file} label="Crédito" name="credit" onChange={updateMapping} />
                        <MappingSelect file={file} label="Moeda" name="currency" onChange={updateMapping} />
                      </div>
                      <Button className="mt-4 w-full" onClick={() => applyMapping(file.id)}>
                        Aplicar mapeamento
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>
          ) : null}

          <Card className="min-w-0 p-5">
            <div className="mb-4 flex items-start gap-3">
              <ShieldCheck className="mt-1 h-5 w-5 text-muted-foreground" />
              <div>
                <h2 className="text-xl font-bold">Pré-visualização</h2>
                <p className="text-sm text-muted-foreground">
                  Nada é guardado sem confirmares. Transferências entre contas não contam como receita nem despesa.
                </p>
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Selecionadas" value={String(selectedRows.length)} />
              <Metric label="Receitas" tone="income" value={euros(incomeTotal)} />
              <Metric label="Despesas" tone="expense" value={euros(expenseTotal)} />
              <Metric label="Transferências" tone="transfer" value={euros(transferTotal)} />
            </div>

            {rows.length ? (
              <div className="mb-3 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => selectAll(true)}>
                  Selecionar tudo
                </Button>
                <Button size="sm" variant="ghost" onClick={() => selectAll(false)}>
                  Limpar
                </Button>
              </div>
            ) : null}

            <div className="max-h-[40rem] min-w-0 space-y-3 overflow-y-auto overflow-x-hidden pr-1">
              {!rows.length ? (
                <div className="rounded-3xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  {parsing ? "A ler o ficheiro..." : "Carrega um CSV para veres os movimentos antes de guardar."}
                </div>
              ) : null}

              {rows.map((row) => (
                <PreviewItem key={row.id} row={row} onUpdate={updateRow} />
              ))}
            </div>

            <Button
              className="mt-5 w-full"
              disabled={!selectedRows.length || saving || needsMapping}
              size="lg"
              onClick={handleImport}
            >
              {saving ? "A guardar..." : "Guardar importação"}
            </Button>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

function MappingSelect({
  file,
  label,
  name,
  onChange
}: {
  file: ImportFile;
  label: string;
  name: keyof ColumnMapping;
  onChange: (fileId: string, key: keyof ColumnMapping, value: string) => void;
}) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <Select
        className="mt-2"
        value={file.mapping[name]}
        onChange={(event) => onChange(file.id, name, event.target.value)}
      >
        <option value="">Não usar</option>
        {file.headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </Select>
    </label>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone?: "income" | "expense" | "transfer";
}) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-muted p-4",
        tone === "income" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "expense" && "bg-rose-500/10 text-rose-700 dark:text-rose-300",
        tone === "transfer" && "bg-sky-500/10 text-sky-700 dark:text-sky-300"
      )}
    >
      <p className="text-xs opacity-75">{label}</p>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}

function PreviewItem({
  row,
  onUpdate
}: {
  row: PreviewRow;
  onUpdate: (id: string, updates: Partial<PreviewRow>) => void;
}) {
  const categories = row.type === "income" ? incomeCategories : expenseCategories;
  const isTransferCounterpart = Boolean(row.type === "transfer" && !row.selected && row.linkedTransferId);

  return (
    <div
      className={cn(
        "min-w-0 rounded-3xl border border-border p-4",
        !row.selected && "opacity-65",
        row.duplicate && "border-amber-500/40 bg-amber-500/5",
        row.type === "transfer" && "border-sky-500/30 bg-sky-500/5"
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <input
          checked={row.selected}
          className="mt-1 h-5 w-5 shrink-0 accent-emerald-600"
          disabled={isTransferCounterpart}
          type="checkbox"
          onChange={(event) => onUpdate(row.id, { selected: event.target.checked })}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="break-words font-semibold leading-snug">{row.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {row.date} · {row.accountName} · confiança {row.confidence}%
              </p>
            </div>
            <strong
              className={cn(
                "shrink-0 whitespace-nowrap",
                row.type === "income" && "text-emerald-600",
                row.type === "expense" && "text-rose-600",
                row.type === "transfer" && "text-sky-600"
              )}
            >
              {row.signedAmount > 0 ? "+" : row.signedAmount < 0 ? "-" : ""}
              {euros(row.amount)}
            </strong>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            {row.type === "transfer" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-3 py-1 text-sky-700 dark:text-sky-300">
                <Link2 className="h-3 w-3" />
                Possível transferência
              </span>
            ) : null}
            {row.duplicate ? (
              <span className="rounded-full bg-amber-500/10 px-3 py-1 text-amber-700 dark:text-amber-300">
                Possível duplicado
              </span>
            ) : null}
            {row.reason ? (
              <span className="rounded-full bg-muted px-3 py-1 text-muted-foreground">
                {row.reason}
              </span>
            ) : null}
          </div>

          {row.duplicate && !row.importAnyway ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => onUpdate(row.id, { selected: false })}>
                Ignorar
              </Button>
              <Button size="sm" variant="outline" onClick={() => onUpdate(row.id, { importAnyway: true })}>
                Importar mesmo assim
              </Button>
            </div>
          ) : null}

          <div className="mt-3 grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)]">
            <Select
              value={row.type}
              onChange={(event) =>
                onUpdate(row.id, {
                  type: event.target.value as TransactionType,
                  category: "Outros",
                  selected: row.duplicate ? row.importAnyway : row.selected
                })
              }
            >
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
              <option value="transfer">Transferência</option>
            </Select>

            {row.type === "transfer" ? (
              <div className="rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                {row.fromAccountName || "Origem"} → {row.toAccountName || "Destino"}
                {!row.selected && row.linkedTransferId ? " · já incluída na transferência ligada" : ""}
              </div>
            ) : (
              <Select
                value={row.category}
                onChange={(event) => onUpdate(row.id, { category: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </Select>
            )}
          </div>

          {row.type === "transfer" ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Input
                value={row.fromAccountName || ""}
                placeholder="Conta de origem"
                onChange={(event) => onUpdate(row.id, { fromAccountName: event.target.value })}
              />
              <Input
                value={row.toAccountName || ""}
                placeholder="Conta de destino"
                onChange={(event) => onUpdate(row.id, { toAccountName: event.target.value })}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function parseCsvFile(file: File, account: Account): Promise<ImportFile> {
  if (!file.name.toLowerCase().endsWith(".csv") && file.type && !file.type.includes("csv")) {
    throw new Error("Por agora esta importação inteligente aceita CSV. Exporta o extrato em CSV no banco.");
  }

  const records = parseCsv(await file.text());
  const headers = Object.keys(records[0] || {});
  const mapping = detectMapping(headers);
  const id = `${file.name}-${account.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    fileName: file.name,
    accountId: account.id,
    accountName: account.name,
    headers,
    records,
    mapping,
    needsMapping: !isUsableMapping(mapping)
  };
}

function rowsFromFile(file: ImportFile): PreviewRow[] {
  if (!isUsableMapping(file.mapping)) return [];

  const parsedRows: PreviewRow[] = [];

  file.records.forEach((record, index) => {
    const date = parseDate(readField(record, file.mapping.date));
    const signedAmount = parseSignedAmount(record, file.mapping);
    const description = cleanDescription(readField(record, file.mapping.description));

    if (!date || !description || !Number.isFinite(signedAmount) || signedAmount === 0) {
      return;
    }

    const suggestedType: CategoryType = signedAmount > 0 ? "income" : "expense";
    const suggestion = suggestCategory(description, suggestedType);

    parsedRows.push({
      id: `${file.id}-${index}-${date}-${signedAmount}`,
      fileId: file.id,
      sourceRow: index,
      selected: true,
      duplicate: false,
      importAnyway: false,
      type: suggestedType,
      suggestedType,
      amount: Math.abs(roundMoney(signedAmount)),
      signedAmount: roundMoney(signedAmount),
      date,
      description,
      accountId: file.accountId,
      accountName: file.accountName,
      category: suggestion.category,
      confidence: suggestion.confidence,
      reason: suggestion.reason
    });
  });

  return parsedRows;
}

function detectMapping(headers: string[]): ColumnMapping {
  const find = (...keywords: string[]) =>
    headers.find((header) => keywords.some((keyword) => normalizeValue(header).includes(keyword))) || "";

  return {
    date: find("data", "date", "completed", "started"),
    description: find("descricao", "descrição", "description", "descritivo", "merchant", "counterparty", "name"),
    amount: find("amount", "valor", "montante", "value"),
    debit: find("debito", "débito", "debit", "paid out", "money out", "saida", "saída"),
    credit: find("credito", "crédito", "credit", "paid in", "money in", "entrada"),
    currency: find("currency", "moeda"),
    balance: find("balance", "saldo")
  };
}

function isUsableMapping(mapping: ColumnMapping) {
  return Boolean(mapping.date && mapping.description && (mapping.amount || mapping.debit || mapping.credit));
}

function markDuplicates(rows: PreviewRow[], existing: Transaction[]) {
  return rows.map((row) => {
    const duplicate = existing.some((transaction) => {
      const sameAccount =
        transaction.account_id === row.accountId ||
        transaction.from_account_id === row.accountId ||
        transaction.to_account_id === row.accountId;
      const sameDate = Math.abs(daysBetween(transaction.date, row.date)) <= 1;
      const sameAmount = Math.abs(Number(transaction.amount) - row.amount) <= 0.02;
      const similarDescription = descriptionSimilarity(transaction.description || "", row.description) >= 0.72;

      return sameAccount && sameDate && sameAmount && similarDescription;
    });

    return duplicate
      ? {
          ...row,
          selected: false,
          duplicate: true,
          confidence: Math.min(row.confidence, 55),
          reason: "Possível duplicado"
        }
      : row;
  });
}

function detectInternalTransfers(rows: PreviewRow[]) {
  const next = rows.map((row) => ({ ...row }));
  const used = new Set<string>();

  for (const negative of next) {
    if (used.has(negative.id) || negative.signedAmount >= 0) continue;

    const positive = next.find((candidate) => {
      if (used.has(candidate.id) || candidate.id === negative.id) return false;
      if (candidate.accountId === negative.accountId || candidate.signedAmount <= 0) return false;
      if (Math.abs(daysBetween(candidate.date, negative.date)) > 3) return false;
      if (!amountsMatch(candidate.amount, negative.amount)) return false;
      return hasTransferSignal(candidate.description, negative.description, candidate.accountName, negative.accountName);
    });

    if (!positive) continue;

    const groupId = `transfer-${negative.id}-${positive.id}`;
    negative.type = "transfer";
    negative.suggestedType = "transfer";
    negative.category = "Transferência";
    negative.confidence = 94;
    negative.reason = "Possível transferência interna";
    negative.transferGroupId = groupId;
    negative.linkedTransferId = positive.id;
    negative.fromAccountName = negative.accountName;
    negative.toAccountName = positive.accountName;
    negative.selected = !negative.duplicate;

    positive.type = "transfer";
    positive.suggestedType = "transfer";
    positive.category = "Transferência";
    positive.confidence = 94;
    positive.reason = "Ligada à transferência anterior";
    positive.transferGroupId = groupId;
    positive.linkedTransferId = negative.id;
    positive.fromAccountName = negative.accountName;
    positive.toAccountName = positive.accountName;
    positive.selected = false;

    used.add(negative.id);
    used.add(positive.id);
  }

  return next;
}

function suggestCategory(description: string, type: CategoryType) {
  const text = normalizeValue(description);

  if (type === "income") {
    if (matchesAny(text, ["vinted"])) return suggestion("Vinted", 92, "Vinted");
    if (matchesAny(text, ["cgsneakers", "cg sneakers"])) return suggestion("CGSneakers", 92, "CGSneakers");
    if (matchesAny(text, ["salario", "salário", "vencimento", "ordenado"])) return suggestion("Salário", 90, "Salário");
    if (matchesAny(text, ["dividendo", "juros", "investimento"])) return suggestion("Investimentos", 86, "Investimentos");
    if (matchesAny(text, ["refund", "reembolso", "devolucao", "devolução"])) return suggestion("Reembolsos", 88, "Reembolso");
    if (matchesAny(text, ["video", "videografia", "film", "fotografia"])) return suggestion("Videografia", 82, "Videografia");
    return suggestion("Outros", 70, "Receita detetada");
  }

  if (matchesAny(text, ["spotify", "netflix", "apple", "adobe", "google", "openai", "notion"])) {
    return suggestion("Subscrições", 90, "Subscrição");
  }
  if (matchesAny(text, ["galp", "repsol", "bp ", "cepsa", "prio", "combustivel", "combustível"])) {
    return suggestion("Combustível", 90, "Combustível");
  }
  if (matchesAny(text, ["portagem", "via verde", "brisa"])) return suggestion("Portagens", 90, "Portagens");
  if (matchesAny(text, ["uber", "bolt", "cp ", "metro", "autocarro", "train", "bus"])) {
    return suggestion("Transporte", 84, "Transporte");
  }
  if (matchesAny(text, ["continente", "pingo doce", "lidl", "auchan", "mercadona", "intermarche"])) {
    return suggestion("Alimentação", 92, "Alimentação");
  }
  if (matchesAny(text, ["amazon", "worten", "fnac", "pcdiga", "radio popular"])) {
    return suggestion("Equipamento", 78, "Loja de equipamento");
  }
  if (matchesAny(text, ["ginásio", "ginasio", "fitness", "holmes place", "solinca"])) {
    return suggestion("Ginásio", 88, "Ginásio");
  }
  if (matchesAny(text, ["farmacia", "farmácia", "hospital", "clinica", "clínica", "barbearia"])) {
    return suggestion("Saúde / cuidados pessoais", 86, "Cuidados pessoais");
  }
  if (matchesAny(text, ["meta", "facebook", "instagram ads", "google ads", "tiktok ads"])) {
    return suggestion("Marketing", 86, "Marketing");
  }

  return suggestion("Outros", 68, "Despesa detetada");
}

function suggestion(category: string, confidence: number, reason: string) {
  return { category, confidence, reason };
}

function parseCsv(text: string) {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let current = "";
  let row: string[] = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === delimiter && !quoted) {
      row.push(current.trim());
      current = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += char;
  }

  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);

  const headerIndex = rows.findIndex((candidate) => candidate.filter(Boolean).length >= 2);
  if (headerIndex < 0) return [];

  const headers = rows[headerIndex].map((header, index) => header || `Coluna ${index + 1}`);
  return rows.slice(headerIndex + 1).map((values) =>
    headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] || "";
      return record;
    }, {})
  );
}

function detectDelimiter(text: string) {
  const firstLines = text.split(/\r?\n/).slice(0, 5).join("\n");
  const candidates = [",", ";", "\t"];
  return candidates
    .map((candidate) => ({
      candidate,
      count: (firstLines.match(new RegExp(candidate === "\t" ? "\\t" : `\\${candidate}`, "g")) || []).length
    }))
    .sort((a, b) => b.count - a.count)[0]?.candidate || ",";
}

function parseSignedAmount(record: Record<string, string>, mapping: ColumnMapping) {
  if (mapping.amount) return parseMoney(readField(record, mapping.amount));

  const debit = mapping.debit ? parseMoney(readField(record, mapping.debit)) : 0;
  const credit = mapping.credit ? parseMoney(readField(record, mapping.credit)) : 0;

  if (credit && !debit) return Math.abs(credit);
  if (debit && !credit) return -Math.abs(debit);
  if (credit || debit) return Math.abs(credit) - Math.abs(debit);

  return Number.NaN;
}

function parseMoney(value: string) {
  const raw = String(value || "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!raw) return Number.NaN;

  const negative = raw.includes("-");
  const unsigned = raw.replace(/-/g, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalSeparator = lastComma > lastDot ? "," : lastDot > -1 ? "." : "";
  let normalized = unsigned;

  if (decimalSeparator === ",") {
    normalized = unsigned.replace(/\./g, "").replace(",", ".");
  } else if (decimalSeparator === ".") {
    normalized = unsigned.replace(/,/g, "");
  }

  const valueNumber = Number(normalized);
  return negative ? -valueNumber : valueNumber;
}

function parseDate(value: string) {
  const clean = String(value || "").trim();
  if (!clean) return "";

  const serial = Number(clean);
  if (Number.isFinite(serial) && serial > 25000 && serial < 80000) {
    const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
    return formatDate(date);
  }

  const iso = clean.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
  if (iso) return [iso[1], iso[2].padStart(2, "0"), iso[3].padStart(2, "0")].join("-");

  const pt = clean.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (pt) {
    const year = pt[3].length === 2 ? `20${pt[3]}` : pt[3];
    return [year, pt[2].padStart(2, "0"), pt[1].padStart(2, "0")].join("-");
  }

  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? "" : formatDate(parsed);
}

function formatDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function readField(record: Record<string, string>, key: string) {
  return key ? record[key] || "" : "";
}

function cleanDescription(value: string) {
  return String(value || "").replace(/\s+/g, " ").trim() || "Movimento importado";
}

function normalizeValue(value: string) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(normalizeValue(keyword)));
}

function hasTransferSignal(a: string, b: string, accountA: string, accountB: string) {
  const text = normalizeValue(`${a} ${b}`);
  const accounts = normalizeValue(`${accountA} ${accountB}`);
  return (
    matchesAny(text, [
      "transfer",
      "transferencia",
      "revolut",
      "millennium",
      "mb way",
      "sepa",
      "top up",
      "top-up",
      "card top-up",
      "carregamento"
    ]) || matchesAny(text, accounts.split(" ").filter((word) => word.length > 3))
  );
}

function amountsMatch(a: number, b: number) {
  const difference = Math.abs(a - b);
  return difference <= Math.max(0.5, Math.max(a, b) * 0.01);
}

function daysBetween(a: string, b: string) {
  const first = new Date(`${a}T00:00:00`).getTime();
  const second = new Date(`${b}T00:00:00`).getTime();
  return Math.round((first - second) / 86400000);
}

function descriptionSimilarity(a: string, b: string) {
  const first = tokenSet(a);
  const second = tokenSet(b);
  if (!first.size || !second.size) return 0;

  const overlap = Array.from(first).filter((token) => second.has(token)).length;
  const union = new Set([...Array.from(first), ...Array.from(second)]).size;
  return overlap / union;
}

function tokenSet(value: string) {
  return new Set(
    normalizeValue(value)
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2)
  );
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}
