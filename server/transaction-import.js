import crypto from "crypto";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;
export const PREVIEW_TTL_MS = 15 * 60 * 1000;
export const IMPORT_AI_MAX_REASON_LENGTH = 160;
export const RECURRING_RULE_MIN_CONFIRMATIONS = 3;
const IMPORT_FINGERPRINT_VERSION = "v1";

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
  let defaultExclude = false;

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

  const finalSuggestedCategory = historicalSuggestion?.category ?? suggestion.category ?? null;
  const finalSuggestionSource = historicalSuggestion?.source ?? (suggestion.category ? "rule" : null);
  const finalRequiresCategorySelection = !defaultExclude && !finalSuggestedCategory;

  if (finalRequiresCategorySelection) {
    warnings.push("Selecione uma categoria antes de importar.");
  }

  const canImport = errors.length === 0 && !finalRequiresCategorySelection;

  return {
    rowIndex,
    description: rawDescription,
    normalizedDescription: normalizedDescriptionValue,
    amount: normalizedAmount,
    normalizedAmount,
    occurredOn,
    normalizedOccurredOn: occurredOn,
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
  categories,
  existingFingerprints,
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

export function createImportPreview({
  categories,
  existingFingerprints,
  bankConnectionId,
  bankConnectionName,
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
  const items = buildPreviewItems({
    categories,
    existingFingerprints,
    headerIndexes,
    headerRow,
    historicalRows,
    importSource,
    recurringRules,
    rows: nonEmptyRows.slice(1),
    userId,
  }).map((item) => ({
    ...item,
    bankConnectionId,
    bankConnectionName,
  }));
  const fileMetadata = extractImportFileMetadata(filename);

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
    importSource,
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

  const categoryId = Number(input.categoryId);

  if (!Number.isInteger(categoryId)) {
    throw new Error("Categoria invalida.");
  }

  const category = categories.find((item) => Number(item.id) === categoryId);

  if (!category) {
    throw new Error("Categoria invalida.");
  }

  if (category.transactionType !== type) {
    throw new Error("A categoria selecionada nao corresponde ao tipo da transacao.");
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
