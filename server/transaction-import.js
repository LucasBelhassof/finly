import crypto from "crypto";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const PREVIEW_TTL_MS = 15 * 60 * 1000;
const IMPORT_FINGERPRINT_VERSION = "v1";

const previewSessions = new Map();

const headerAliases = {
  date: ["data", "data lancamento", "data lançamento", "data movimento", "dt lancamento", "dt lançamento", "date"],
  description: ["descricao", "descrição", "historico", "histórico", "lançamento", "lancamento", "detalhes", "descricao movimento"],
  amount: ["valor", "amount", "valor rs", "valor r$", "valor (r$)", "valor da transacao", "valor da transação"],
  debit: ["debito", "débito", "saidas", "saída", "saida", "valor debito", "valor débito"],
  credit: ["credito", "crédito", "entradas", "entrada", "valor credito", "valor crédito"],
};

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

const importRules = [
  { id: "salary", priority: 100, matchType: "contains", patterns: ["salario", "salary", "folha pag"], categoryKey: "salary", typeOverride: "income" },
  { id: "freelance", priority: 95, matchType: "contains", patterns: ["freelance", "projeto freelance"], categoryKey: "freelance", typeOverride: "income" },
  { id: "uber-eats", priority: 90, matchType: "contains", patterns: ["uber eats"], categoryKey: "food_delivery", typeOverride: "expense" },
  { id: "ifood", priority: 85, matchType: "contains", patterns: ["ifood"], categoryKey: "food_delivery", typeOverride: "expense" },
  { id: "restaurant", priority: 80, matchType: "contains", patterns: ["restaurante", "lanchonete", "delivery", "pizza"], categoryKey: "food_delivery", typeOverride: "expense" },
  { id: "market", priority: 75, matchType: "contains", patterns: ["mercado", "supermercado", "pao de acucar", "pão de açucar", "feira"], categoryKey: "grocery", typeOverride: "expense" },
  { id: "transport", priority: 70, matchType: "contains", patterns: ["uber", "99app", "taxi", "combustivel", "combustível", "posto"], categoryKey: "transport", typeOverride: "expense" },
  { id: "subscriptions", priority: 65, matchType: "contains", patterns: ["netflix", "spotify", "youtube", "prime video", "assinatura"], categoryKey: "subscriptions", typeOverride: "expense" },
  { id: "housing", priority: 60, matchType: "contains", patterns: ["aluguel", "condominio", "condomínio", "internet residencial"], categoryKey: "housing", typeOverride: "expense" },
  { id: "utilities", priority: 55, matchType: "contains", patterns: ["energia", "conta de luz", "enel"], categoryKey: "utilities", typeOverride: "expense" },
  { id: "health", priority: 50, matchType: "contains", patterns: ["farmacia", "farmácia", "academia", "hospital", "clinica", "clínica"], categoryKey: "health", typeOverride: "expense" },
  { id: "leisure", priority: 45, matchType: "contains", patterns: ["cinema", "show", "bar", "lazer"], categoryKey: "leisure", typeOverride: "expense" },
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

function suggestCategory(normalizedDescriptionValue, categories) {
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
  rowIndex,
  rowValues,
  headerRow,
  headerIndexes,
  categories,
  userId,
  seenFingerprints,
  existingFingerprints,
}) {
  const errors = [];
  const warnings = [];
  const sourceRow = buildRowSource(headerRow, rowValues);
  const rawDescription = String(rowValues[headerIndexes.description] ?? "").trim();
  const normalizedDescriptionValue = normalizeDescription(rawDescription);
  let type = "expense";
  let absoluteAmount = null;
  let occurredOn = "";

  if (!rawDescription) {
    errors.push("Descricao ausente.");
  }

  try {
    occurredOn = parseOccurredOnInput(rowValues[headerIndexes.date]);
  } catch (error) {
    errors.push(error.message);
  }

  try {
    if (typeof headerIndexes.amount === "number") {
      const parsed = parseAmountInput(rowValues[headerIndexes.amount]);
      type = parsed < 0 ? "expense" : "income";
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

  if (suggestion.typeOverride) {
    type = suggestion.typeOverride;
  }

  let normalizedAmount = absoluteAmount !== null ? normalizeAmountString(absoluteAmount) : "";
  let signedAmount = absoluteAmount !== null ? signedAmountFromType(type, absoluteAmount) : null;

  let possibleDuplicate = false;
  let duplicateReason = "";

  if (occurredOn && signedAmount !== null && normalizedDescriptionValue) {
    const fingerprint = buildFingerprint(userId, occurredOn, signedAmount, normalizedDescriptionValue);

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

  const requiresCategorySelection = !suggestion.category;

  if (requiresCategorySelection) {
    warnings.push("Selecione uma categoria antes de importar.");
  }

  const canImport = errors.length === 0 && !requiresCategorySelection;

  return {
    rowIndex,
    description: rawDescription,
    normalizedDescription: normalizedDescriptionValue,
    amount: normalizedAmount,
    normalizedAmount,
    occurredOn,
    normalizedOccurredOn: occurredOn,
    type,
    suggestedCategoryId: suggestion.category?.id ?? null,
    suggestedCategoryLabel: suggestion.category?.label ?? null,
    matchedRuleId: suggestion.matchedRuleId,
    possibleDuplicate,
    duplicateReason,
    canImport,
    requiresCategorySelection,
    requiresUserAction: !canImport || possibleDuplicate,
    warnings,
    errors,
    sourceRow,
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

export function createImportPreview({ categories, existingFingerprints, fileBuffer, userId }) {
  if (fileBuffer.length > MAX_IMPORT_BYTES) {
    throw new Error("O arquivo excede o limite de 5 MB.");
  }

  cleanupExpiredPreviewSessions();
  const decodedText = decodeCsvBuffer(fileBuffer);
  const rows = parseCsvText(decodedText);
  const nonEmptyRows = rows.filter((row) => !isBlankCsvRow(row));

  if (nonEmptyRows.length < 2) {
    throw new Error("O arquivo CSV precisa ter cabecalho e ao menos uma linha de dados.");
  }

  if (nonEmptyRows.length - 1 > MAX_IMPORT_ROWS) {
    throw new Error("O arquivo excede o limite de 5.000 linhas.");
  }

  const headerRow = nonEmptyRows[0];
  const headerIndexes = resolveHeaderIndexes(headerRow);
  const seenFingerprints = new Set();
  const items = nonEmptyRows.slice(1).map((rowValues, index) =>
    buildPreviewItem({
      rowIndex: index + 1,
      rowValues,
      headerRow,
      headerIndexes,
      categories,
      userId,
      seenFingerprints,
      existingFingerprints,
    }),
  );

  const previewToken = crypto.randomUUID();
  const expiresAtMs = Date.now() + PREVIEW_TTL_MS;

  previewSessions.set(previewToken, {
    createdAtMs: Date.now(),
    expiresAtMs,
    userId: String(userId),
    items: items.map((item) => ({
      rowIndex: item.rowIndex,
      original: item,
    })),
  });

  return {
    previewToken,
    expiresAt: new Date(expiresAtMs).toISOString(),
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

  const categoryId = Number(input.categoryId);

  if (!Number.isInteger(categoryId)) {
    throw new Error("Categoria invalida.");
  }

  const category = categories.find((item) => Number(item.id) === categoryId);

  if (!category) {
    throw new Error("Categoria invalida.");
  }

  const signedAmount = signedAmountFromType(type, amount);
  const normalizedFinalDescription = normalizeDescription(description);

  return {
    description,
    normalizedFinalDescription,
    occurredOn,
    normalizedOccurredOn: occurredOn,
    type,
    categoryId,
    signedAmount,
    normalizedSignedAmount: normalizeAmountString(signedAmount),
    exclude: Boolean(input.exclude),
    ignoreDuplicate: Boolean(input.ignoreDuplicate),
  };
}

export function buildImportSeedKey(userId, occurredOn, signedAmount, normalizedFinalDescription) {
  return buildFingerprint(userId, occurredOn, signedAmount, normalizedFinalDescription);
}
