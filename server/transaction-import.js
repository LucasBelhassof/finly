import crypto from "crypto";
import { PDFParse } from "pdf-parse";
import { suggestKnownMerchantCategory } from "./merchant-category-rules.js";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const PREVIEW_TTL_MS = 15 * 60 * 1000;
export const IMPORT_AI_MAX_REASON_LENGTH = 160;
export const RECURRING_RULE_MIN_CONFIRMATIONS = 3;
const DEFAULT_EXPENSE_CATEGORY_SLUG = "outros-despesas";
const IMPORT_FINGERPRINT_VERSION = "v1";
const PDF_PAGE_JOINER = "\n-- page_number of total_number --\n";

const previewSessions = new Map();

const headerAliases = {
  date: ["data", "data lancamento", "data lançamento", "data movimento", "dt lancamento", "dt lançamento", "date"],
  description: ["descricao", "descrição", "historico", "histórico", "lançamento", "lancamento", "detalhes", "descricao movimento"],
  amount: ["valor", "amount", "valor rs", "valor r$", "valor (r$)", "valor da transacao", "valor da transação"],
  debit: ["debito", "débito", "saidas", "saída", "saida", "valor debito", "valor débito"],
  credit: ["credito", "crédito", "entradas", "entrada", "valor credito", "valor crédito"],
};

headerAliases.description.push("title", "titulo");

const categoryKeyResolvers = {
  grocery: ["supermercado"],
  food_delivery: ["restaurantes", "cafe"],
  transport: ["transporte"],
  housing: ["moradia"],
  utilities: ["energia"],
  subscriptions: ["assinaturas"],
  health: ["saude"],
  leisure: ["lazer"],
  salary: ["salario"],
  freelance: ["freelance"],
};

const categoryKeys = Object.keys(categoryKeyResolvers);
const ptShortMonthMap = new Map([
  ["jan", 1],
  ["fev", 2],
  ["mar", 3],
  ["abr", 4],
  ["mai", 5],
  ["jun", 6],
  ["jul", 7],
  ["ago", 8],
  ["set", 9],
  ["out", 10],
  ["nov", 11],
  ["dez", 12],
]);
const matchKeyNoiseTokens = new Set([
  "transferencia",
  "recebida",
  "recebido",
  "enviada",
  "enviado",
  "pix",
  "pelo",
  "pela",
  "ted",
  "doc",
  "pagamento",
  "boleto",
  "debito",
  "credito",
  "conta",
  "agencia",
  "bco",
  "banco",
  "sa",
]);

const importRules = [
  { id: "salary", priority: 100, matchType: "contains", patterns: ["salario", "salary", "folha pag"], categoryKey: "salary", typeOverride: "income" },
  { id: "freelance", priority: 95, matchType: "contains", patterns: ["freelance", "projeto freelance"], categoryKey: "freelance", typeOverride: "income" },
  { id: "market", priority: 75, matchType: "contains", patterns: ["mercado", "supermercado", "pao de acucar", "pão de açucar", "feira"], categoryKey: "grocery", typeOverride: "expense" },
  { id: "transport", priority: 70, matchType: "contains", patterns: ["uber", "99app", "taxi", "combustivel", "combustível", "posto"], categoryKey: "transport", typeOverride: "expense" },
  { id: "housing", priority: 60, matchType: "contains", patterns: ["aluguel", "condominio", "condomínio", "internet residencial"], categoryKey: "housing", typeOverride: "expense" },
  { id: "utilities", priority: 55, matchType: "contains", patterns: ["energia", "conta de luz", "enel"], categoryKey: "utilities", typeOverride: "expense" },
  { id: "health", priority: 50, matchType: "contains", patterns: ["farmacia", "farmácia", "academia", "hospital", "clinica", "clínica"], categoryKey: "health", typeOverride: "expense" },
];

function cleanupExpiredPreviewSessions() {
  const now = Date.now();

  for (const [token, session] of previewSessions.entries()) {
    if (session.expiresAtMs <= now) {
      previewSessions.delete(token);
    }
  }
}

function toAsciiSlug(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function normalizeDescription(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractCategorizationMatchKey(value) {
  const normalized = normalizeDescription(value);

  if (!normalized) {
    return "";
  }

  const tokens = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean)
    .filter((token) => !matchKeyNoiseTokens.has(token))
    .filter((token) => !/\d/.test(token))
    .filter((token) => token.length > 1);

  if (tokens.length >= 2) {
    return tokens.join(" ");
  }

  return normalized;
}

function normalizeHeader(value) {
  return normalizeDescription(value);
}

function normalizeAmountString(value) {
  return Number(value).toFixed(2);
}

function signedAmountFromType(type, amount) {
  const absolute = Math.abs(Number(amount));
  return type === "expense" ? -absolute : absolute;
}

function buildFingerprint(userId, occurredOn, signedAmount, normalizedDescription) {
  return crypto
    .createHash("sha256")
    .update(
      [
        String(userId),
        String(occurredOn),
        normalizeAmountString(signedAmount),
        String(normalizedDescription),
        IMPORT_FINGERPRINT_VERSION,
      ].join("|"),
    )
    .digest("hex");
}

function decodeCsvBuffer(buffer) {
  const utf8 = buffer.toString("utf8").replace(/^\uFEFF/, "");

  if (!utf8.includes("\uFFFD")) {
    return utf8;
  }

  return buffer.toString("latin1").replace(/^\uFEFF/, "");
}

function isPdfUpload(contentType, filename) {
  return String(contentType ?? "").toLowerCase().includes("pdf") || /\.pdf$/i.test(String(filename ?? ""));
}

function titleCaseWords(value) {
  return String(value ?? "")
    .split(/[\s_-]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeMonthReference(year, month) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

function getDaysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function resolveStatementReferenceMonth(fileMetadata) {
  if (fileMetadata?.statementReferenceMonth && /^\d{4}-\d{2}$/.test(fileMetadata.statementReferenceMonth)) {
    return fileMetadata.statementReferenceMonth;
  }

  if (fileMetadata?.statementDueDate && /^\d{4}-\d{2}-\d{2}$/.test(fileMetadata.statementDueDate)) {
    return fileMetadata.statementDueDate.slice(0, 7);
  }

  return null;
}

export function normalizeOccurredOnToStatementMonth(occurredOn, fileMetadata) {
  if (!occurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn)) {
    return occurredOn;
  }

  const statementReferenceMonth = resolveStatementReferenceMonth(fileMetadata);

  if (!statementReferenceMonth) {
    return occurredOn;
  }

  const [, , rawDay] = occurredOn.split("-").map(Number);
  const [statementYear, statementMonth] = statementReferenceMonth.split("-").map(Number);
  const clampedDay = Math.min(rawDay, getDaysInMonth(statementYear, statementMonth));

  return `${String(statementYear).padStart(4, "0")}-${String(statementMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function addMonthsToOccurredOn(occurredOn, monthsToAdd) {
  if (!occurredOn || !/^\d{4}-\d{2}-\d{2}$/.test(occurredOn) || !Number.isInteger(monthsToAdd)) {
    throw new Error("Data base invalida para calcular parcelas.");
  }

  const [year, month, day] = occurredOn.split("-").map(Number);
  const nextMonthIndex = month - 1 + monthsToAdd;
  const nextYear = year + Math.floor(nextMonthIndex / 12);
  const normalizedMonthIndex = ((nextMonthIndex % 12) + 12) % 12;
  const nextMonth = normalizedMonthIndex + 1;
  const clampedDay = Math.min(day, getDaysInMonth(nextYear, nextMonth));

  return `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`;
}

export function extractInstallmentMetadata(description) {
  const normalizedDescription = String(description ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  if (!normalizedDescription) {
    return {
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
    };
  }

  const patterns = [
    /\bparcela\s+(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})\b/i,
    /\b(\d{1,2})\/(\d{1,2})\b/,
  ];

  for (const pattern of patterns) {
    const match = normalizedDescription.match(pattern);

    if (!match) {
      continue;
    }

    const installmentIndex = Number(match[1]);
    const installmentCount = Number(match[2]);

    if (
      !Number.isInteger(installmentIndex) ||
      !Number.isInteger(installmentCount) ||
      installmentIndex < 1 ||
      installmentCount < 2 ||
      installmentIndex > installmentCount
    ) {
      continue;
    }

    return {
      isInstallment: true,
      installmentIndex,
      installmentCount,
      generatedInstallmentCount: installmentCount,
    };
  }

  return {
    isInstallment: false,
    installmentIndex: null,
    installmentCount: null,
    generatedInstallmentCount: null,
  };
}

export function stripInstallmentMarker(description) {
  const rawDescription = String(description ?? "").trim();

  if (!rawDescription) {
    return "";
  }

  const withoutParenthesizedMarker = rawDescription
    .replace(/\(\s*parcela\s+\d{1,2}\s*(?:de|\/)\s*\d{1,2}\s*\)/i, "")
    .trim();
  const withoutInlineMarker = withoutParenthesizedMarker
    .replace(/\bparcela\s+\d{1,2}\s*(?:de|\/)\s*\d{1,2}\b/i, "")
    .replace(/\b\d{1,2}\/\d{1,2}\b/, "")
    .replace(/\s+-\s*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return withoutInlineMarker || rawDescription;
}

export function formatInstallmentDescription(descriptionBase, installmentNumber, installmentCount) {
  const base = String(descriptionBase ?? "").trim();

  if (!base || !Number.isInteger(installmentNumber) || !Number.isInteger(installmentCount)) {
    return base;
  }

  return `${base} ${installmentNumber}/${installmentCount}`.trim();
}

export function buildInstallmentPurchaseSeedKey(
  userId,
  bankConnectionId,
  purchaseOccurredOn,
  normalizedDescriptionBase,
  amountPerInstallment,
  installmentCount,
) {
  return crypto
    .createHash("sha256")
    .update(
      [
        String(userId),
        String(bankConnectionId),
        String(purchaseOccurredOn),
        String(normalizedDescriptionBase),
        normalizeAmountString(Math.abs(Number(amountPerInstallment))),
        String(installmentCount),
        "installment_purchase_v1",
      ].join("|"),
    )
    .digest("hex");
}

export function buildInstallmentTransactionSeedKey(userId, installmentPurchaseSeedKey, installmentNumber) {
  return crypto
    .createHash("sha256")
    .update([String(userId), String(installmentPurchaseSeedKey), String(installmentNumber), "installment_transaction_v1"].join("|"))
    .digest("hex");
}

export function extractImportFileMetadata(filename) {
  const rawFilename = String(filename ?? "").trim();
  const basename = rawFilename.replace(/\.[^.]+$/, "");

  if (!basename) {
    return {
      originalFilename: rawFilename || "extrato.csv",
      issuerName: null,
      statementDueDate: null,
      statementReferenceMonth: null,
    };
  }

  const fullDateMatch = basename.match(/(.+?)[-_ ](\d{4})[-_ ](\d{2})[-_ ](\d{2})$/);

  if (fullDateMatch) {
    const issuerName = titleCaseWords(fullDateMatch[1]);
    const year = Number(fullDateMatch[2]);
    const month = Number(fullDateMatch[3]);
    const day = Number(fullDateMatch[4]);
    const statementDueDate = parseOccurredOnInput(`${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);

    return {
      originalFilename: rawFilename,
      issuerName: issuerName || null,
      statementDueDate,
      statementReferenceMonth: normalizeMonthReference(year, month),
    };
  }

  const yearMonthMatch = basename.match(/(.+?)[-_ ](\d{4})[-_ ](\d{2})$/);

  if (yearMonthMatch) {
    const issuerName = titleCaseWords(yearMonthMatch[1]);
    const year = Number(yearMonthMatch[2]);
    const month = Number(yearMonthMatch[3]);

    return {
      originalFilename: rawFilename,
      issuerName: issuerName || null,
      statementDueDate: null,
      statementReferenceMonth: normalizeMonthReference(year, month),
    };
  }

  const monthYearMatch = basename.match(/(.+?)[-_ ](\d{2})[-_ ](\d{4})$/);

  if (monthYearMatch) {
    const issuerName = titleCaseWords(monthYearMatch[1]);
    const month = Number(monthYearMatch[2]);
    const year = Number(monthYearMatch[3]);

    return {
      originalFilename: rawFilename,
      issuerName: issuerName || null,
      statementDueDate: null,
      statementReferenceMonth: normalizeMonthReference(year, month),
    };
  }

  return {
    originalFilename: rawFilename,
    issuerName: titleCaseWords(basename) || null,
    statementDueDate: null,
    statementReferenceMonth: null,
  };
}

function compactNormalizedText(value) {
  return normalizeDescription(value).replace(/\s+/g, "");
}

function normalizePdfLine(line) {
  return String(line ?? "")
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parsePdfDateWithMonthName(day, monthLabel, year) {
  const month = ptShortMonthMap.get(normalizeDescription(monthLabel).slice(0, 3));

  if (!month) {
    throw new Error("Mes invalido na fatura PDF.");
  }

  return parseOccurredOnInput(`${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`);
}

function inferYearFromReferenceMonth(day, month, referenceMonth) {
  if (!referenceMonth || !/^\d{4}-\d{2}$/.test(referenceMonth)) {
    return null;
  }

  const [referenceYear, referenceMonthNumber] = referenceMonth.split("-").map(Number);
  return month > referenceMonthNumber ? referenceYear - 1 : referenceYear;
}

function normalizeMerchantDescription(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/\s+\)/g, ")")
    .replace(/\(\s+/g, "(")
    .trim();
}

function addCardContextToDescription(rows) {
  const distinctCards = new Set(rows.map((row) => row.cardSuffix).filter(Boolean));

  return rows.map((row) => ({
    ...row,
    description: distinctCards.size > 1 && row.cardSuffix ? `Cartao ${row.cardSuffix} - ${row.description}` : row.description,
  }));
}

function parseInterDueDate(text) {
  const match = text.match(/Data de Vencimento\s+(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseOccurredOnInput(match[1]) : null;
}

function parseItauDueDate(text) {
  const match = text.match(/Vencimento:\s*(\d{2}\/\d{2}\/\d{4})/i);
  return match ? parseOccurredOnInput(match[1]) : null;
}

function parseItauEmissionDate(text) {
  const match = text.match(/Emiss[aã]o:\s*(\d{2}\/\d{2}\/\d{4})/i);

  if (!match) {
    return null;
  }

  const occurredOn = parseOccurredOnInput(match[1]);
  return occurredOn.slice(0, 7);
}

function parseItauChargeRows(text, occurredOn) {
  if (!occurredOn) {
    return [];
  }

  const chargePatterns = [
    "Juros do rotativo",
    "Juros de mora",
    "Multa por atraso",
    "IOF de financiamento",
    "IOF adicional",
    "Anuidade",
    "Tarifa",
  ];
  const rows = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = normalizePdfLine(rawLine);
    const normalizedLine = normalizeDescription(line);

    if (!normalizedLine) {
      continue;
    }

    const chargePattern = chargePatterns.find((pattern) => normalizedLine.includes(normalizeDescription(pattern)));

    if (!chargePattern) {
      continue;
    }

    const amountMatch = line.match(/(\d{1,3}(?:\.\d{3})*,\d{2})\s*$/);

    if (!amountMatch) {
      continue;
    }

    const amount = Math.abs(parseAmountInput(amountMatch[1]));

    if (amount <= 0) {
      continue;
    }

    rows.push({
      occurredOn,
      description: chargePattern,
      amount: normalizeAmountString(amount),
      cardSuffix: null,
    });
  }

  return rows;
}

export function detectPdfIssuer(text, filename) {
  const normalizedFilename = compactNormalizedText(filename);
  const normalizedText = compactNormalizedText(text);

  if (normalizedFilename.includes("inter") || normalizedText.includes("bancointer")) {
    return "inter";
  }

  if (normalizedFilename.includes("itau") || normalizedText.includes("itaucartoes") || normalizedText.includes("itau")) {
    return "itau";
  }

  return null;
}

function parseInterCreditCardPdfText(text) {
  const lines = text.split(/\r?\n/).map(normalizePdfLine).filter(Boolean);
  const rows = [];
  let currentCardSuffix = null;
  let insideTransactions = false;

  for (const line of lines) {
    const compact = compactNormalizedText(line);

    if (compact.includes("despesasdafatura")) {
      insideTransactions = true;
      continue;
    }

    if (!insideTransactions) {
      continue;
    }

    if (compact.startsWith("proximafatura") || compact.startsWith("limitedecreditototal")) {
      break;
    }

    const cardMatch = line.match(/^CART[ÃA]O\s+([0-9*]+)(\d{4})?$/i);

    if (cardMatch) {
      currentCardSuffix = (cardMatch[2] || cardMatch[1].slice(-4)).replace(/\D/g, "").slice(-4) || null;
      continue;
    }

    const transactionMatch = line.match(
      /^(\d{2}) de ([A-Za-zçÇ]{3})\.?\s+(\d{4})\s+(.+?)\s+([+-]?\s*R\$\s*[\d\.,]+)$/i,
    );

    if (!transactionMatch) {
      continue;
    }

    const amountToken = transactionMatch[5].replace(/\s+/g, " ").trim();

    if (amountToken.includes("+")) {
      continue;
    }

    rows.push({
      occurredOn: parsePdfDateWithMonthName(transactionMatch[1], transactionMatch[2], Number(transactionMatch[3])),
      description: normalizeMerchantDescription(transactionMatch[4]),
      amount: normalizeAmountString(Math.abs(parseAmountInput(amountToken))),
      cardSuffix: currentCardSuffix,
    });
  }

  return addCardContextToDescription(rows);
}

function parseItauCreditCardPdfText(text, referenceMonth) {
  const lines = text.split(/\r?\n/).map(normalizePdfLine).filter(Boolean);
  const rows = [];
  let insideTransactions = false;

  for (const line of lines) {
    const compact = compactNormalizedText(line);

    if (compact.includes("lancamentoscomprasesaques")) {
      insideTransactions = true;
      continue;
    }

    if (!insideTransactions) {
      continue;
    }

    if (compact.includes("lancamentosnocartao") || compact.includes("ltotaldoslancamentosatuais")) {
      break;
    }

    const transactionMatch = line.match(/(\d{2})\/\s*(\d{2})\s+(.+?)\s+(\d{1,3}(?:\.\d{3})*,\d{2})/);

    if (!transactionMatch) {
      continue;
    }

    const day = Number(transactionMatch[1]);
    const month = Number(transactionMatch[2]);
    const year = inferYearFromReferenceMonth(day, month, referenceMonth);

    if (!year) {
      continue;
    }

    rows.push({
      occurredOn: parseOccurredOnInput(`${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`),
      description: normalizeMerchantDescription(transactionMatch[3]),
      amount: normalizeAmountString(Math.abs(parseAmountInput(transactionMatch[4]))),
      cardSuffix: null,
    });
  }

  return rows;
}

export function parseCreditCardPdfStatement({ text, filename }) {
  const issuer = detectPdfIssuer(text, filename);

  if (!issuer) {
    throw new Error("Nao foi possivel identificar o emissor da fatura PDF. Use Inter, Itau ou exporte CSV.");
  }

  if (issuer === "inter") {
    const rows = parseInterCreditCardPdfText(text);
    return {
      issuer,
      rows,
      metadata: {
        issuerName: "Inter",
        statementDueDate: parseInterDueDate(text),
        statementReferenceMonth: rows.length > 0 ? rows[0].occurredOn.slice(0, 7) : null,
      },
    };
  }

  const statementReferenceMonth = parseItauEmissionDate(text);
  const statementDueDate = parseItauDueDate(text);
  const rows = [
    ...parseItauChargeRows(text, statementDueDate),
    ...parseItauCreditCardPdfText(text, statementReferenceMonth),
  ];

  return {
    issuer,
    rows,
    metadata: {
      issuerName: "Itau",
      statementDueDate,
      statementReferenceMonth,
    },
  };
}

async function extractPdfText(buffer) {
  const parser = new PDFParse({
    data: buffer,
  });

  try {
    const result = await parser.getText({
      pageJoiner: PDF_PAGE_JOINER,
    });
    return result.text;
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

async function extractImportRowsFromFile({ fileBuffer, contentType, filename, importSource }) {
  if (isPdfUpload(contentType, filename)) {
    if (importSource !== "credit_card_statement") {
      throw new Error("PDF e suportado apenas para fatura do cartao nesta versao.");
    }

    const text = await extractPdfText(fileBuffer);

    if (!text || !text.trim()) {
      throw new Error("Nao foi possivel extrair texto do PDF. Use um PDF com texto selecionavel ou exporte CSV.");
    }

    const parsedPdf = parseCreditCardPdfStatement({
      text,
      filename,
    });

    if (!parsedPdf.rows.length) {
      throw new Error("Nao foi possivel localizar despesas validas na fatura PDF.");
    }

    return {
      headerRow: ["date", "title", "amount"],
      rows: parsedPdf.rows.map((row) => [row.occurredOn, row.description, row.amount]),
      importLayout: "credit_card_statement",
      fileMetadata: {
        ...extractImportFileMetadata(filename),
        issuerName: parsedPdf.metadata.issuerName,
        statementDueDate: parsedPdf.metadata.statementDueDate,
        statementReferenceMonth: parsedPdf.metadata.statementReferenceMonth,
      },
    };
  }

  const decodedText = decodeCsvBuffer(fileBuffer);
  const rows = parseCsvText(decodedText);
  const nonEmptyRows = rows.filter((row) => !isBlankCsvRow(row));

  if (nonEmptyRows.length < 2) {
    throw new Error("O arquivo CSV precisa ter cabecalho e ao menos uma linha de dados.");
  }

  if (nonEmptyRows.length - 1 > MAX_IMPORT_ROWS) {
    throw new Error("O arquivo excede o limite de 5.000 linhas.");
  }

  const fileMetadata = extractImportFileMetadata(filename);

  if (importSource === "credit_card_statement" && !resolveStatementReferenceMonth(fileMetadata)) {
    const dataRows = nonEmptyRows.slice(1);
    const headerIndexes = resolveHeaderIndexes(nonEmptyRows[0]);
    const candidateDates = dataRows
      .map((row) => {
        try {
          return parseOccurredOnInput(row[headerIndexes.date]);
        } catch {
          return null;
        }
      })
      .filter(Boolean)
      .sort();

    if (candidateDates.length > 0) {
      fileMetadata.statementReferenceMonth = candidateDates[candidateDates.length - 1].slice(0, 7);
    }
  }

  return {
    headerRow: nonEmptyRows[0],
    rows: nonEmptyRows.slice(1),
    importLayout: importSource,
    fileMetadata,
  };
}

function isBlankCsvRow(row) {
  return row.every((cell) => !String(cell ?? "").trim());
}

function splitCsvRows(text, delimiter) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (character === "\"") {
      if (quoted && next === "\"") {
        current += "\"";
        index += 1;
        continue;
      }

      quoted = !quoted;
      continue;
    }

    if (!quoted && character === delimiter) {
      row.push(current);
      current = "";
      continue;
    }

    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && next === "\n") {
        index += 1;
      }

      row.push(current);
      rows.push(row);
      row = [];
      current = "";
      continue;
    }

    current += character;
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function chooseDelimiter(text) {
  const firstLine = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return ";";
  }

  const semicolonCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;

  return semicolonCount >= commaCount ? ";" : ",";
}

function parseCsvText(text) {
  const trimmed = text.replace(/^\uFEFF/, "");

  if (!trimmed.trim()) {
    throw new Error("O arquivo CSV esta vazio.");
  }

  return splitCsvRows(trimmed, chooseDelimiter(trimmed));
}

function resolveHeaderIndexes(headerRow) {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const mapping = {};

  for (const [key, aliases] of Object.entries(headerAliases)) {
    const index = normalizedHeaders.findIndex((header) => aliases.includes(header));

    if (index >= 0) {
      mapping[key] = index;
    }
  }

  if (
    typeof mapping.date !== "number" ||
    typeof mapping.description !== "number" ||
    !(typeof mapping.amount === "number" || (typeof mapping.debit === "number" && typeof mapping.credit === "number"))
  ) {
    throw new Error(
      "Nao foi possivel identificar as colunas obrigatorias. O CSV precisa ter data, descricao/historico e valor ou debito/credito.",
    );
  }

  return mapping;
}

function detectImportLayout(headerRow, dataRows, headerIndexes) {
  const normalizedHeaders = headerRow.map(normalizeHeader);
  const hasTitleHeader = normalizedHeaders.includes("title");

  if (!hasTitleHeader || typeof headerIndexes.amount !== "number") {
    return "bank_statement";
  }

  let paymentRows = 0;
  let purchaseRows = 0;

  for (const rowValues of dataRows.slice(0, 25)) {
    const rawDescription = String(rowValues[headerIndexes.description] ?? "").trim();
    const normalizedDescriptionValue = normalizeDescription(rawDescription);

    if (!normalizedDescriptionValue) {
      continue;
    }

    let parsedAmount;

    try {
      parsedAmount = parseAmountInput(rowValues[headerIndexes.amount]);
    } catch {
      continue;
    }

    if (parsedAmount < 0 && normalizedDescriptionValue.includes("pagamento recebido")) {
      paymentRows += 1;
    }

    if (parsedAmount > 0 && !normalizedDescriptionValue.includes("pagamento recebido")) {
      purchaseRows += 1;
    }
  }

  return paymentRows > 0 && purchaseRows > 0 ? "credit_card_statement" : "bank_statement";
}

function isCreditCardPaymentReceived(normalizedDescriptionValue) {
  return normalizedDescriptionValue.includes("pagamento recebido");
}

export function parseAmountInput(rawValue) {
  const original = String(rawValue ?? "").trim();

  if (!original) {
    throw new Error("Valor ausente.");
  }

  let value = original.replace(/[R$\s]/gi, "");
  let negative = false;

  if (value.startsWith("(") && value.endsWith(")")) {
    negative = true;
    value = value.slice(1, -1);
  }

  if (value.startsWith("-")) {
    negative = true;
    value = value.slice(1);
  }

  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      value = value.replace(/\./g, "").replace(",", ".");
    } else {
      value = value.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    value = value.replace(/\./g, "").replace(",", ".");
  } else {
    const dotCount = (value.match(/\./g) ?? []).length;

    if (dotCount > 1) {
      value = value.replace(/\./g, "");
    }
  }

  const parsed = Number.parseFloat(value);

  if (!Number.isFinite(parsed)) {
    throw new Error("Valor invalido.");
  }

  const absolute = Math.round(Math.abs(parsed) * 100) / 100;
  return negative ? -absolute : absolute;
}

export function parseOccurredOnInput(rawValue) {
  const input = String(rawValue ?? "").trim();

  if (!input) {
    throw new Error("Data ausente.");
  }

  let year;
  let month;
  let day;

  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    [year, month, day] = input.split("-").map(Number);
  } else if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) {
    [day, month, year] = input.split("/").map(Number);
  } else if (/^\d{2}-\d{2}-\d{4}$/.test(input)) {
    [day, month, year] = input.split("-").map(Number);
  } else {
    throw new Error("Data invalida.");
  }

  const normalized = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${normalized}T12:00:00Z`);

  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== normalized) {
    throw new Error("Data invalida.");
  }

  return normalized;
}

function doesRuleMatch(rule, normalizedDescriptionValue) {
  return rule.patterns.some((pattern) => {
    const normalizedPattern = normalizeDescription(pattern);

    switch (rule.matchType) {
      case "equals":
        return normalizedDescriptionValue === normalizedPattern;
      case "token":
        return normalizedDescriptionValue.split(" ").includes(normalizedPattern);
      case "regex":
        return new RegExp(pattern, "i").test(normalizedDescriptionValue);
      default:
        return normalizedDescriptionValue.includes(normalizedPattern);
    }
  });
}

function resolveCategoryForKey(categoryKey, categories) {
  const slugs = categoryKeyResolvers[categoryKey] ?? [];

  for (const slug of slugs) {
    const category = categories.find((item) => item.slug === slug);

    if (category) {
      return category;
    }
  }

  return null;
}

function isCategoryCompatibleWithType(category, type) {
  if (!category || !type) {
    return false;
  }

  return category.transactionType === type;
}

export function listAllowedCategoryKeys(categories) {
  return categoryKeys.filter((categoryKey) => Boolean(resolveCategoryForKey(categoryKey, categories)));
}

export function resolveAllowedCategoryMap(categories) {
  return new Map(
    listAllowedCategoryKeys(categories)
      .map((categoryKey) => [categoryKey, resolveCategoryForKey(categoryKey, categories)])
      .filter((entry) => entry[1]),
  );
}

function suggestCategory(normalizedDescriptionValue, categories) {
  const merchantSuggestion = suggestKnownMerchantCategory(normalizedDescriptionValue, categories);

  if (merchantSuggestion.category) {
    return merchantSuggestion;
  }

  const rule = [...importRules]
    .sort((left, right) => right.priority - left.priority)
    .find((candidate) => doesRuleMatch(candidate, normalizedDescriptionValue));

  if (!rule) {
    return {
      matchedRuleId: null,
      category: null,
      typeOverride: null,
    };
  }

  return {
    matchedRuleId: rule.id,
    category: resolveCategoryForKey(rule.categoryKey, categories),
    typeOverride: rule.typeOverride ?? null,
  };
}

function chooseHistoricalMatch(matchKey, categories, historicalMatches, recurringRuleMatches) {
  if (recurringRuleMatches?.has(matchKey)) {
    const match = recurringRuleMatches.get(matchKey);
    const category = categories.find((item) => Number(item.id) === Number(match.categoryId));

    if (isCategoryCompatibleWithType(category, match.type)) {
      return {
        category,
        typeOverride: match.type,
        source: "recurring_rule",
      };
    }
  }

  if (historicalMatches?.has(matchKey)) {
    const match = historicalMatches.get(matchKey);
    const category = categories.find((item) => Number(item.id) === Number(match.categoryId));

    if (isCategoryCompatibleWithType(category, match.type)) {
      return {
        category,
        typeOverride: match.type,
        source: "history",
      };
    }
  }

  return null;
}

function buildRowSource(headerRow, rowValues) {
  const source = {};

  headerRow.forEach((header, index) => {
    const key = String(header ?? "").trim();

    if (key) {
      source[key] = String(rowValues[index] ?? "").trim();
    }
  });

  return source;
}

function buildPreviewItem({
  importLayout,
  fileMetadata,
  bankConnectionId,
  rowIndex,
  rowValues,
  headerRow,
  headerIndexes,
  categories,
  historicalMatches,
  recurringRuleMatches,
  userId,
  seenFingerprints,
  existingFingerprints,
}) {
  const errors = [];
  const warnings = [];
  const sourceRow = buildRowSource(headerRow, rowValues);
  const rawDescription = String(rowValues[headerIndexes.description] ?? "").trim();
  const normalizedDescriptionValue = normalizeDescription(rawDescription);
  const categorizationMatchKey = extractCategorizationMatchKey(rawDescription);
  let type = "expense";
  let absoluteAmount = null;
  let occurredOn = "";
  let purchaseOccurredOn = null;
  let defaultExclude = false;
  let installmentMetadata = {
    purchaseDescriptionBase: null,
    normalizedPurchaseDescriptionBase: null,
    isInstallment: false,
    installmentIndex: null,
    installmentCount: null,
    generatedInstallmentCount: null,
  };

  if (!rawDescription) {
    errors.push("Descricao ausente.");
  }

  try {
    purchaseOccurredOn = parseOccurredOnInput(rowValues[headerIndexes.date]);
    occurredOn = purchaseOccurredOn;
    if (importLayout === "credit_card_statement") {
      occurredOn = normalizeOccurredOnToStatementMonth(occurredOn, fileMetadata);
    }
  } catch (error) {
    errors.push(error.message);
  }

  try {
    if (typeof headerIndexes.amount === "number") {
      const parsed = parseAmountInput(rowValues[headerIndexes.amount]);
      type = importLayout === "credit_card_statement"
        ? parsed < 0
          ? "income"
          : "expense"
        : parsed < 0
          ? "expense"
          : "income";
      absoluteAmount = Math.abs(parsed);
    } else {
      const debitValue = String(rowValues[headerIndexes.debit] ?? "").trim();
      const creditValue = String(rowValues[headerIndexes.credit] ?? "").trim();

      if (debitValue && creditValue) {
        throw new Error("Linha com debito e credito ao mesmo tempo.");
      }

      if (!debitValue && !creditValue) {
        throw new Error("Linha sem valor.");
      }

      if (creditValue) {
        type = "income";
        absoluteAmount = Math.abs(parseAmountInput(creditValue));
      } else {
        type = "expense";
        absoluteAmount = Math.abs(parseAmountInput(debitValue));
      }
    }
  } catch (error) {
    errors.push(error.message);
  }

  const suggestion = suggestCategory(normalizedDescriptionValue, categories);
  const historicalSuggestion =
    !suggestion.category && categorizationMatchKey
      ? chooseHistoricalMatch(categorizationMatchKey, categories, historicalMatches, recurringRuleMatches)
      : null;

  if (suggestion.typeOverride || historicalSuggestion?.typeOverride) {
    type = historicalSuggestion?.typeOverride ?? suggestion.typeOverride;
  }

  if (importLayout === "credit_card_statement" && isCreditCardPaymentReceived(normalizedDescriptionValue)) {
    defaultExclude = true;
    warnings.push("Pagamento recebido de fatura sera ignorado por padrao.");
  }

  if (importLayout === "credit_card_statement" && type === "expense") {
    const parsedInstallmentMetadata = extractInstallmentMetadata(rawDescription);
    const purchaseDescriptionBase = stripInstallmentMarker(rawDescription);
    const normalizedPurchaseDescriptionBase = normalizeDescription(purchaseDescriptionBase);
    installmentMetadata = {
      purchaseDescriptionBase,
      normalizedPurchaseDescriptionBase,
      ...parsedInstallmentMetadata,
    };

    if (installmentMetadata.isInstallment && installmentMetadata.generatedInstallmentCount) {
      warnings.push(
        `Compra parcelada detectada: ${installmentMetadata.generatedInstallmentCount} despesas mensais serao geradas ao importar, incluindo parcelas anteriores.`,
      );
    }
  }

  let normalizedAmount = absoluteAmount !== null ? normalizeAmountString(absoluteAmount) : "";
  let signedAmount = absoluteAmount !== null ? signedAmountFromType(type, absoluteAmount) : null;

  let possibleDuplicate = false;
  let duplicateReason = "";

  if (occurredOn && signedAmount !== null && normalizedDescriptionValue) {
    const fingerprint =
      installmentMetadata.isInstallment &&
      purchaseOccurredOn &&
      installmentMetadata.normalizedPurchaseDescriptionBase &&
      Number.isInteger(installmentMetadata.installmentIndex) &&
      Number.isInteger(installmentMetadata.installmentCount)
        ? buildInstallmentTransactionSeedKey(
            userId,
            buildInstallmentPurchaseSeedKey(
              userId,
              bankConnectionId,
              purchaseOccurredOn,
              installmentMetadata.normalizedPurchaseDescriptionBase,
              absoluteAmount,
              installmentMetadata.installmentCount,
            ),
            installmentMetadata.installmentIndex,
          )
        : buildFingerprint(userId, occurredOn, signedAmount, normalizedDescriptionValue);

    if (existingFingerprints.has(fingerprint)) {
      possibleDuplicate = true;
      duplicateReason = "Ja existe uma transacao importada com os mesmos dados.";
      warnings.push("Duplicata provavel encontrada.");
    } else if (seenFingerprints.has(fingerprint)) {
      possibleDuplicate = true;
      duplicateReason = "Linha duplicada dentro do mesmo arquivo.";
      warnings.push("Linha duplicada no arquivo.");
    }

    seenFingerprints.add(fingerprint);
  }

  const finalSuggestedCategory = historicalSuggestion?.category ?? suggestion.category ?? null;
  const finalSuggestionSource = historicalSuggestion?.source ?? (suggestion.category ? "rule" : null);
  const finalRequiresCategorySelection = !defaultExclude && type === "income" && !finalSuggestedCategory;

  if (finalRequiresCategorySelection) {
    warnings.push("Selecione uma categoria antes de importar.");
  } else if (!defaultExclude && type === "expense" && !finalSuggestedCategory) {
    warnings.push("Se nenhuma categoria for escolhida, a despesa sera importada como Outros.");
  }

  const canImport = errors.length === 0 && !finalRequiresCategorySelection;

  return {
    rowIndex,
    description: rawDescription,
    normalizedDescription: normalizedDescriptionValue,
    purchaseDescriptionBase: installmentMetadata.purchaseDescriptionBase,
    normalizedPurchaseDescriptionBase: installmentMetadata.normalizedPurchaseDescriptionBase,
    amount: normalizedAmount,
    normalizedAmount,
    occurredOn,
    normalizedOccurredOn: occurredOn,
    purchaseOccurredOn,
    isInstallment: installmentMetadata.isInstallment,
    installmentIndex: installmentMetadata.installmentIndex,
    installmentCount: installmentMetadata.installmentCount,
    generatedInstallmentCount: installmentMetadata.generatedInstallmentCount,
    type,
    suggestedCategoryId: finalSuggestedCategory?.id ?? null,
    suggestedCategoryLabel: finalSuggestedCategory?.label ?? null,
    suggestionSource: finalSuggestionSource,
    importSource: importLayout,
    bankConnectionId: null,
    bankConnectionName: "",
    matchedRuleId: suggestion.matchedRuleId,
    aiSuggestedType: null,
    aiSuggestedCategoryId: null,
    aiSuggestedCategoryLabel: null,
    aiConfidence: null,
    aiReason: null,
    aiStatus: "idle",
    possibleDuplicate,
    duplicateReason,
    canImport,
    requiresCategorySelection: finalRequiresCategorySelection,
    requiresUserAction: (!canImport || possibleDuplicate) && !defaultExclude,
    defaultExclude,
    warnings,
    errors,
    sourceRow,
  };
}

function buildHistoricalCategorizationMatches(rows) {
  const grouped = new Map();

  for (const row of rows ?? []) {
    const matchKey = extractCategorizationMatchKey(row.description);

    if (!matchKey) {
      continue;
    }

    const type = row.transaction_type === "income" || row.transaction_type === "expense"
      ? row.transaction_type
      : Number(row.amount) >= 0
        ? "income"
        : "expense";
    const comboKey = `${type}:${row.category_id}`;
    const entry = grouped.get(matchKey) ?? new Map();
    const current = entry.get(comboKey) ?? { type, categoryId: row.category_id, count: 0, latestOccurredOn: "" };
    current.count += 1;
    current.latestOccurredOn = String(row.occurred_on ?? "");
    entry.set(comboKey, current);
    grouped.set(matchKey, entry);
  }

  const resolved = new Map();

  for (const [matchKey, options] of grouped.entries()) {
    const ranked = Array.from(options.values()).sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return String(right.latestOccurredOn).localeCompare(String(left.latestOccurredOn));
    });

    if (ranked.length === 1 || ranked[0].count > ranked[1].count) {
      resolved.set(matchKey, ranked[0]);
    }
  }

  return resolved;
}

function getDefaultExpenseCategory(categories) {
  return categories.find(
    (item) => item.transactionType === "expense" && String(item.slug ?? "") === DEFAULT_EXPENSE_CATEGORY_SLUG,
  ) ?? null;
}

function buildRecurringRuleMatches(rows) {
  const resolved = new Map();

  for (const row of rows ?? []) {
    if (!row.match_key || Number(row.times_confirmed) < RECURRING_RULE_MIN_CONFIRMATIONS) {
      continue;
    }

    resolved.set(String(row.match_key), {
      type: row.type,
      categoryId: row.category_id,
      timesConfirmed: Number(row.times_confirmed),
    });
  }

  return resolved;
}

function buildPreviewItems({
  bankConnectionId,
  categories,
  existingFingerprints,
  fileMetadata,
  headerIndexes,
  headerRow,
  historicalRows,
  importSource,
  recurringRules,
  rows,
  userId,
}) {
  const seenFingerprints = new Set();
  const historicalMatches = buildHistoricalCategorizationMatches(historicalRows);
  const recurringRuleMatches = buildRecurringRuleMatches(recurringRules);
  const importLayout = importSource || detectImportLayout(headerRow, rows, headerIndexes);

  return rows.map((rowValues, index) =>
    buildPreviewItem({
      importLayout,
      fileMetadata,
      bankConnectionId,
      rowIndex: index + 1,
      rowValues,
      headerRow,
      headerIndexes,
      categories,
      historicalMatches,
      recurringRuleMatches,
      userId,
      seenFingerprints,
      existingFingerprints,
    }),
  );
}

function normalizeRowIndexes(rowIndexes, session, maxRows) {
  if (rowIndexes === undefined) {
    const allIndexes = session.items.map((item) => item.rowIndex);

    if (allIndexes.length > maxRows) {
      throw new Error(`O enriquecimento permite no maximo ${maxRows} linhas por chamada.`);
    }

    return allIndexes;
  }

  if (!Array.isArray(rowIndexes)) {
    throw new Error("rowIndexes precisa ser uma lista de linhas.");
  }

  if (rowIndexes.length === 0) {
    return [];
  }

  if (rowIndexes.length > maxRows) {
    throw new Error(`O enriquecimento permite no maximo ${maxRows} linhas por chamada.`);
  }

  const allowedIndexes = new Set(session.items.map((item) => item.rowIndex));
  const seenIndexes = new Set();

  return rowIndexes.map((rowIndex) => {
    if (!Number.isInteger(rowIndex) || !allowedIndexes.has(rowIndex)) {
      throw new Error("Uma ou mais linhas nao pertencem a esta previa.");
    }

    if (seenIndexes.has(rowIndex)) {
      throw new Error("A mesma linha foi enviada mais de uma vez para sugestao por IA.");
    }

    seenIndexes.add(rowIndex);
    return rowIndex;
  });
}

function hasMeaningfulDescription(normalizedDescription) {
  const tokens = String(normalizedDescription ?? "")
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);

  return tokens.length >= 2 || String(normalizedDescription ?? "").length >= 12;
}

export function isPreviewItemEligibleForAi(item) {
  if (!item || item.errors.length > 0) {
    return false;
  }

  if (item.suggestedCategoryId) {
    return false;
  }

  return hasMeaningfulDescription(item.normalizedDescription);
}

function createAiSuggestionResult(rowIndex, patch) {
  return {
    rowIndex,
    aiSuggestedType: patch.aiSuggestedType ?? null,
    aiSuggestedCategoryId: patch.aiSuggestedCategoryId ?? null,
    aiSuggestedCategoryLabel: patch.aiSuggestedCategoryLabel ?? null,
    aiConfidence: patch.aiConfidence ?? null,
    aiReason: patch.aiReason ?? null,
    aiStatus: patch.aiStatus ?? "idle",
    suggestionSource: patch.suggestionSource ?? null,
  };
}

function applyAiSuggestionPatch(item, patch) {
  item.aiSuggestedType = patch.aiSuggestedType ?? null;
  item.aiSuggestedCategoryId = patch.aiSuggestedCategoryId ?? null;
  item.aiSuggestedCategoryLabel = patch.aiSuggestedCategoryLabel ?? null;
  item.aiConfidence = patch.aiConfidence ?? null;
  item.aiReason = patch.aiReason ?? null;
  item.aiStatus = patch.aiStatus ?? "idle";
  item.suggestionSource = patch.suggestionSource ?? null;
  item.requiresUserAction = Boolean(item.possibleDuplicate) || item.errors.length > 0 || item.requiresCategorySelection;
  return item;
}

function buildCachedSuggestionFromOriginal(item) {
  if (!isPreviewItemEligibleForAi(item.original)) {
    return createAiSuggestionResult(item.rowIndex, {
      aiStatus: "no_match",
      suggestionSource: null,
    });
  }

  return null;
}

function normalizeAiConfidence(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const confidence = Number(value);

  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    return null;
  }

  return confidence;
}

function isRawAiConfidenceInvalid(value) {
  if (value === null || value === undefined) {
    return false;
  }

  const confidence = Number(value);
  return !Number.isFinite(confidence) || confidence < 0 || confidence > 1;
}

function normalizeAiReason(value) {
  const reason = String(value ?? "").trim();

  if (!reason) {
    return null;
  }

  return reason.slice(0, IMPORT_AI_MAX_REASON_LENGTH);
}

export function normalizeAiCategorizationResult(raw, allowedCategoryMap) {
  const rowIndex = Number(raw?.rowIndex);

  if (!Number.isInteger(rowIndex)) {
    throw new Error("Resultado de IA sem rowIndex valido.");
  }

  const status = raw?.status;
  const suggestedType = raw?.suggestedType === "income" || raw?.suggestedType === "expense" ? raw.suggestedType : null;
  const confidence = normalizeAiConfidence(raw?.confidence);
  const categoryKey = typeof raw?.categoryKey === "string" ? raw.categoryKey.trim() : "";
  const reason = normalizeAiReason(raw?.reason);

  if (status === "error" || status === "invalid") {
    return {
      rowIndex,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: confidence,
      aiReason: reason,
      aiStatus: status,
      suggestionSource: null,
    };
  }

  if (isRawAiConfidenceInvalid(raw?.confidence)) {
    return {
      rowIndex,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: null,
      aiReason: reason,
      aiStatus: "invalid",
      suggestionSource: null,
    };
  }

  if (!categoryKey && suggestedType) {
    return {
      rowIndex,
      aiSuggestedType: suggestedType,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: confidence,
      aiReason: reason,
      aiStatus: "no_match",
      suggestionSource: null,
    };
  }

  if (!categoryKey) {
    return {
      rowIndex,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: confidence,
      aiReason: reason,
      aiStatus: "no_match",
      suggestionSource: null,
    };
  }

  if (!suggestedType) {
    return {
      rowIndex,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: null,
      aiReason: reason,
      aiStatus: "invalid",
      suggestionSource: null,
    };
  }

  const category = allowedCategoryMap.get(categoryKey);

  if (!category || !isCategoryCompatibleWithType(category, suggestedType)) {
    return {
      rowIndex,
      aiSuggestedType: null,
      aiSuggestedCategoryId: null,
      aiSuggestedCategoryLabel: null,
      aiConfidence: confidence,
      aiReason: reason,
      aiStatus: "invalid",
      suggestionSource: null,
    };
  }

  return {
    rowIndex,
    aiSuggestedType: suggestedType,
    aiSuggestedCategoryId: category.id,
    aiSuggestedCategoryLabel: category.label,
    aiConfidence: confidence,
    aiReason: reason,
    aiStatus: "suggested",
    suggestionSource: "ai",
  };
}

export async function enrichPreviewSessionWithAi({
  session,
  categories,
  rowIndexes,
  maxRows,
  suggestCategories,
}) {
  const requestedIndexes = normalizeRowIndexes(rowIndexes, session, maxRows);
  const targetItems = session.items.filter((item) => requestedIndexes.includes(item.rowIndex));
  const pendingItems = [];
  const responseItems = [];

  for (const sessionItem of targetItems) {
    if (sessionItem.aiSuggestion) {
      applyAiSuggestionPatch(sessionItem.original, sessionItem.aiSuggestion);
      responseItems.push(createAiSuggestionResult(sessionItem.rowIndex, sessionItem.aiSuggestion));
      continue;
    }

    const localResult = buildCachedSuggestionFromOriginal(sessionItem);

    if (localResult) {
      sessionItem.aiSuggestion = localResult;
      applyAiSuggestionPatch(sessionItem.original, localResult);
      responseItems.push(localResult);
      continue;
    }

    pendingItems.push(sessionItem);
  }

  if (pendingItems.length > 0) {
    const allowedCategoryMap = resolveAllowedCategoryMap(categories);

    try {
      const providerResults = await suggestCategories({
        items: pendingItems.map((item) => ({
          rowIndex: item.rowIndex,
          description: item.original.description,
          normalizedDescription: item.original.normalizedDescription,
          type: item.original.type,
        })),
        categories: Array.from(allowedCategoryMap.entries()).map(([categoryKey, category]) => ({
          categoryKey,
          id: category.id,
          label: category.label,
          transactionType: category.transactionType,
        })),
      });

      const normalizedResults = new Map(
        (providerResults ?? []).flatMap((result) => {
          try {
            const normalizedResult = normalizeAiCategorizationResult(result, allowedCategoryMap);
            return [[normalizedResult.rowIndex, normalizedResult]];
          } catch {
            return [];
          }
        }),
      );

      for (const sessionItem of pendingItems) {
        const suggestion =
          normalizedResults.get(sessionItem.rowIndex) ??
          createAiSuggestionResult(sessionItem.rowIndex, {
            aiStatus: "no_match",
            suggestionSource: null,
          });
        sessionItem.aiSuggestion = suggestion;
        applyAiSuggestionPatch(sessionItem.original, suggestion);
        responseItems.push(suggestion);
      }
    } catch (error) {
      for (const sessionItem of pendingItems) {
        const suggestion = createAiSuggestionResult(sessionItem.rowIndex, {
          aiStatus: "error",
          aiReason: normalizeAiReason(error?.message),
          suggestionSource: null,
        });
        sessionItem.aiSuggestion = suggestion;
        applyAiSuggestionPatch(sessionItem.original, suggestion);
        responseItems.push(suggestion);
      }
    }
  }

  const items = targetItems
    .map((item) => responseItems.find((result) => result.rowIndex === item.rowIndex))
    .filter(Boolean);

  return {
    items,
    summary: {
      requestedRows: requestedIndexes.length,
      suggestedRows: items.filter((item) => item.aiStatus === "suggested").length,
      noMatchRows: items.filter((item) => item.aiStatus === "no_match").length,
      failedRows: items.filter((item) => item.aiStatus === "error" || item.aiStatus === "invalid").length,
    },
  };
}

export function parseMultipartCsvUpload(contentType, bodyBuffer) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? "");
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];

  if (!boundary) {
    throw new Error("Nao foi possivel ler o upload do arquivo.");
  }

  if (!Buffer.isBuffer(bodyBuffer) || !bodyBuffer.length) {
    throw new Error("Nenhum arquivo foi enviado.");
  }

  const multipartText = bodyBuffer.toString("latin1");
  const parts = multipartText.split(`--${boundary}`);

  for (const part of parts) {
    if (!part.includes("filename=")) {
      continue;
    }

    const normalizedPart = part.replace(/^\r\n/, "").replace(/\r\n$/, "");
    const separatorIndex = normalizedPart.indexOf("\r\n\r\n");

    if (separatorIndex < 0) {
      continue;
    }

    const headersText = normalizedPart.slice(0, separatorIndex);
    const contentText = normalizedPart.slice(separatorIndex + 4).replace(/\r\n$/, "");
    const filenameMatch = /filename="([^"]+)"/i.exec(headersText);
    const contentTypeMatch = /content-type:\s*([^\r\n]+)/i.exec(headersText);

    return {
      filename: filenameMatch?.[1] ?? "extrato.csv",
      contentType: contentTypeMatch?.[1]?.trim() ?? "text/csv",
      buffer: Buffer.from(contentText, "latin1"),
    };
  }

  throw new Error("O upload nao contem um arquivo CSV valido.");
}

export async function createImportPreview({
  categories,
  existingFingerprints,
  bankConnectionId,
  bankConnectionName,
  contentType = "text/csv",
  fileBuffer,
  filename = "extrato.csv",
  historicalRows = [],
  importSource = "bank_statement",
  recurringRules = [],
  userId,
}) {
  if (fileBuffer.length > MAX_IMPORT_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }

  cleanupExpiredPreviewSessions();
  const extracted = await extractImportRowsFromFile({
    fileBuffer,
    contentType,
    filename,
    importSource,
  });
  const headerRow = extracted.headerRow;
  const headerIndexes = resolveHeaderIndexes(headerRow);
  const items = buildPreviewItems({
    bankConnectionId,
    categories,
    existingFingerprints,
    fileMetadata: extracted.fileMetadata,
    headerIndexes,
    headerRow,
    historicalRows,
    importSource: extracted.importLayout,
    recurringRules,
    rows: extracted.rows,
    userId,
  }).map((item) => ({
    ...item,
    bankConnectionId,
    bankConnectionName,
  }));
  const fileMetadata = extracted.fileMetadata;

  const previewToken = crypto.randomUUID();
  const expiresAtMs = Date.now() + PREVIEW_TTL_MS;

  previewSessions.set(previewToken, {
    createdAtMs: Date.now(),
    expiresAtMs,
    bankConnectionId,
    bankConnectionName,
    fileMetadata,
    userId: String(userId),
    items: items.map((item) => ({
      rowIndex: item.rowIndex,
      original: item,
      aiSuggestion: null,
    })),
  });

  return {
    previewToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
    importSource: extracted.importLayout,
    bankConnectionId,
    bankConnectionName,
    fileMetadata,
    fileSummary: {
      totalRows: items.length,
      importableRows: items.filter((item) => item.canImport && !item.possibleDuplicate).length,
      errorRows: items.filter((item) => item.errors.length > 0).length,
      duplicateRows: items.filter((item) => item.possibleDuplicate).length,
      actionRequiredRows: items.filter((item) => item.requiresUserAction).length,
    },
    items,
  };
}

export function getPreviewSession(previewToken, userId) {
  cleanupExpiredPreviewSessions();
  const session = previewSessions.get(String(previewToken));

  if (!session || session.userId !== String(userId)) {
    throw new Error("Preview invalido ou expirado.");
  }

  if (session.expiresAtMs <= Date.now()) {
    previewSessions.delete(String(previewToken));
    throw new Error("A previa expirou. Gere a previa novamente para continuar.");
  }

  return session;
}

function ensureCommitItemShape(item) {
  const allowedKeys = new Set(["rowIndex", "description", "amount", "occurredOn", "type", "categoryId", "exclude", "ignoreDuplicate"]);
  const keys = Object.keys(item ?? {});

  if (!keys.every((key) => allowedKeys.has(key))) {
    throw new Error("Payload de importacao fora do contrato.");
  }
}

export function validateCommitItemsShape(items, session) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Nenhuma linha foi enviada para importacao.");
  }

  const sessionIndexes = new Set(session.items.map((item) => item.rowIndex));
  const seenIndexes = new Set();

  for (const item of items) {
    ensureCommitItemShape(item);

    if (!Number.isInteger(item.rowIndex) || !sessionIndexes.has(item.rowIndex)) {
      throw new Error("Uma ou mais linhas nao pertencem a esta previa.");
    }

    if (seenIndexes.has(item.rowIndex)) {
      throw new Error("A mesma linha foi enviada mais de uma vez no commit.");
    }

    seenIndexes.add(item.rowIndex);
  }
}

export function validateCommitLine(input, categories) {
  const description = String(input.description ?? "").trim();

  if (!description) {
    throw new Error("Descricao ausente.");
  }

  const occurredOn = parseOccurredOnInput(input.occurredOn);
  const amount = Math.abs(parseAmountInput(input.amount));
  const type = input.type === "income" ? "income" : input.type === "expense" ? "expense" : null;

  if (!type) {
    throw new Error("Tipo invalido.");
  }

  const rawCategoryId = input.categoryId;
  let category = null;

  if (rawCategoryId === undefined || rawCategoryId === null || rawCategoryId === "") {
    if (type === "income") {
      throw new Error("Categoria obrigatoria para receitas.");
    }

    category = getDefaultExpenseCategory(categories);

    if (!category) {
      throw new Error("Categoria padrao de despesa nao encontrada.");
    }
  } else {
    const categoryId = Number(rawCategoryId);

    if (!Number.isInteger(categoryId)) {
      throw new Error("Categoria invalida.");
    }

    category = categories.find((item) => Number(item.id) === categoryId);

    if (!category) {
      throw new Error("Categoria invalida.");
    }

    if (category.transactionType !== type) {
      throw new Error("A categoria selecionada nao corresponde ao tipo da transacao.");
    }
  }

  const signedAmount = signedAmountFromType(type, amount);
  const normalizedFinalDescription = normalizeDescription(description);

  return {
    description,
    normalizedFinalDescription,
    occurredOn,
    normalizedOccurredOn: occurredOn,
    type,
    categoryId: category.id,
    signedAmount,
    normalizedSignedAmount: normalizeAmountString(signedAmount),
    exclude: Boolean(input.exclude),
    ignoreDuplicate: Boolean(input.ignoreDuplicate),
  };
}

export function buildImportedTransactionEntries({ normalizedLine, previewItem }) {
  const generatedInstallmentCount =
    previewItem?.importSource === "credit_card_statement" &&
    previewItem?.isInstallment &&
    Number.isInteger(previewItem.generatedInstallmentCount) &&
    Number(previewItem.generatedInstallmentCount) > 0
      ? Number(previewItem.generatedInstallmentCount)
      : 1;
  const installmentStartOffset =
    previewItem?.isInstallment && Number.isInteger(previewItem.installmentIndex) ? 1 - Number(previewItem.installmentIndex) : 0;

  return Array.from({ length: generatedInstallmentCount }, (_, index) => ({
    description:
      previewItem?.isInstallment &&
      previewItem?.purchaseDescriptionBase &&
      Number.isInteger(previewItem.installmentCount) &&
      Number.isInteger(previewItem.installmentIndex)
        ? formatInstallmentDescription(
            previewItem.purchaseDescriptionBase,
            index + 1,
            Number(previewItem.installmentCount),
          )
        : normalizedLine.description,
    descriptionBase:
      previewItem?.purchaseDescriptionBase && previewItem?.normalizedPurchaseDescriptionBase
        ? previewItem.purchaseDescriptionBase
        : normalizedLine.description,
    normalizedDescriptionBase:
      previewItem?.normalizedPurchaseDescriptionBase && previewItem?.purchaseDescriptionBase
        ? previewItem.normalizedPurchaseDescriptionBase
        : normalizedLine.normalizedFinalDescription,
    categoryId: normalizedLine.categoryId,
    amount: normalizedLine.signedAmount,
    occurredOn: addMonthsToOccurredOn(normalizedLine.normalizedOccurredOn, installmentStartOffset + index),
    purchaseOccurredOn: previewItem?.purchaseOccurredOn ?? normalizedLine.normalizedOccurredOn,
    type: normalizedLine.type,
    installmentCount:
      previewItem?.isInstallment && Number.isInteger(previewItem.installmentCount) ? Number(previewItem.installmentCount) : null,
    installmentNumber: previewItem?.isInstallment ? index + 1 : null,
  }));
}

export function buildImportSeedKey(userId, occurredOn, signedAmount, normalizedFinalDescription) {
  return buildFingerprint(userId, occurredOn, signedAmount, normalizedFinalDescription);
}
