import { buildIssue, normalizeAmountInput, normalizeDateInput, normalizeHeaderKey } from "./tabular-utils.js";
import { CLEARLY_RECEIVED_INCOME_KEYWORDS } from "../received-income-detector.js";

const PORTUGUESE_MONTHS = {
  janeiro: 1,
  fevereiro: 2,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

// Canonical received-income keywords imported from shared detector.
// All are treated as positive (inbound) for sign inference.
const POSITIVE_KEYWORDS = CLEARLY_RECEIVED_INCOME_KEYWORDS;

const NEGATIVE_KEYWORDS = [
  "pix enviado",
  "compra no debito",
  "compra no credito",
  "pagamento",
  "transferencia enviada",
  "ted",
  "doc",
  "saque",
  "boleto",
  "tarifa",
  "juros",
  "iof",
  "anuidade",
];

const NOISE_PATTERNS = [
  "solicitado em",
  "cpf cnpj",
  "instituicao",
  "agencia",
  "conta",
  "periodo",
  "saldo total",
  "saldo disponivel",
  "saldo bloqueado",
  "saldo do dia",
  "valor saldo por transacao",
  "fale com a gente",
  "sac",
  "ouvidoria",
  "deficiencia de fala e audicao",
  "subtotal",
  "total",
  "totais",
  "resumo",
];

const BANK_STATEMENT_KEYWORD_PATTERN =
  /(pix|transferencia|transferência|ted|doc|saque|deposito|depósito|boleto|pagamento|compra|tarifa|juros|iof|anuidade|reembolso|estorno)/;
const AMOUNT_TOKEN_PATTERN =
  /(?:\(\s*(?:R\$\s*)?-?\d{1,3}(?:\.\d{3})*(?:,\d{2})\s*\))|(?:\(\s*(?:R\$\s*)?-?\d+(?:\.\d{2})\s*\))|(?:-?\s*(?:R\$\s*)?\d{1,3}(?:\.\d{3})*(?:,\d{2}))|(?:-?\s*(?:R\$\s*)?\d+(?:\.\d{2}))/gi;

function normalizeWhitespace(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatementText(value) {
  return normalizeHeaderKey(value);
}

function findKeywordMatch(line) {
  const normalized = normalizeStatementText(line);
  const candidates = [...POSITIVE_KEYWORDS, ...NEGATIVE_KEYWORDS].sort((left, right) => right.length - left.length);

  for (const keyword of candidates) {
    if (normalized.includes(keyword)) {
      return keyword;
    }
  }

  return null;
}

function inferSignedAmount(amountToken, keyword) {
  if (amountToken.explicitSign) {
    return amountToken.value;
  }

  if (keyword && POSITIVE_KEYWORDS.includes(keyword)) {
    return Math.abs(amountToken.value);
  }

  if (keyword && NEGATIVE_KEYWORDS.includes(keyword)) {
    return -Math.abs(amountToken.value);
  }

  if (amountToken.value < 0) {
    return amountToken.value;
  }

  return null;
}

function buildConfidence({ hasDate, keyword, hasBalance, ambiguousAmounts }) {
  let confidence = 0.55;

  if (hasDate) {
    confidence += 0.15;
  }

  if (keyword) {
    confidence += 0.1;
  }

  if (hasBalance) {
    confidence += 0.08;
  }

  if (ambiguousAmounts) {
    confidence = Math.min(confidence, 0.45);
  }

  return Math.min(0.92, confidence);
}

export function parseStatementAmountTokens(line) {
  const matches = Array.from(String(line ?? "").matchAll(AMOUNT_TOKEN_PATTERN));

  return matches
    .map((match) => {
      const raw = String(match[0] ?? "").trim();
      const value = normalizeAmountInput(raw);

      if (value === null) {
        return null;
      }

      return {
        raw,
        value,
        index: match.index ?? -1,
        explicitSign: /^\(/.test(raw) || /-\s*(?:R\$)?/i.test(raw),
      };
    })
    .filter(Boolean);
}

export function parseStatementDateHeader(line, options = {}) {
  const rawLine = normalizeWhitespace(line);

  if (!rawLine) {
    return null;
  }

  const normalizedLine = normalizeStatementText(rawLine);
  const longDateMatch = normalizedLine.match(/(?:^|\b)(\d{1,2}) de ([a-z]+) de (\d{4})(?:\b|$)/);

  if (longDateMatch) {
    const day = Number(longDateMatch[1]);
    const month = PORTUGUESE_MONTHS[longDateMatch[2]];
    const year = Number(longDateMatch[3]);

    if (Number.isInteger(day) && Number.isInteger(month) && Number.isInteger(year)) {
      return {
        occurredOn: `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        issues: [],
      };
    }
  }

  const numericDateMatch = rawLine.match(/(?:^|\b)(\d{4}-\d{2}-\d{2}|\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?)(?:\b|$)/);

  if (!numericDateMatch) {
    return null;
  }

  const occurredOn = normalizeDateInput(numericDateMatch[1], options);

  if (!occurredOn) {
    return null;
  }

  return {
    occurredOn,
    issues: /^\d{1,2}[\/.-]\d{1,2}$/.test(numericDateMatch[1])
      ? [
          buildIssue(
            "import_inferred_date",
            "O ano desta linha foi inferido a partir do contexto do arquivo.",
            "warning",
          ),
        ]
      : [],
  };
}

export function isStatementNoiseLine(line) {
  const rawLine = normalizeWhitespace(line);

  if (!rawLine) {
    return true;
  }

  if (findKeywordMatch(rawLine)) {
    return false;
  }

  const normalized = normalizeStatementText(rawLine);

  if (/^--?\s*\d+\s+of\s+\d+\s*--?$/.test(normalized) || /^pagina\s+\d+/.test(normalized)) {
    return true;
  }

  if (NOISE_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return true;
  }

  return false;
}

export function parseStatementTransactionLine(line, context = {}) {
  const rawLine = normalizeWhitespace(line);

  if (!rawLine || isStatementNoiseLine(rawLine)) {
    return null;
  }

  const keyword = findKeywordMatch(rawLine);
  const amountTokens = parseStatementAmountTokens(rawLine);

  if (!keyword || amountTokens.length === 0) {
    return null;
  }

  if (!context.occurredOn) {
    return null;
  }

  const description = normalizeWhitespace(
    amountTokens[0].index > 0 ? rawLine.slice(0, amountTokens[0].index) : rawLine,
  );

  if (!description) {
    return null;
  }

  const signedAmount = inferSignedAmount(amountTokens[0], keyword);

  if (signedAmount === null) {
    return null;
  }

  const issues = [...(context.dateIssues ?? [])];
  const ambiguousAmounts = amountTokens.length > 2;

  if (ambiguousAmounts) {
    issues.push(
      buildIssue(
        "import_ambiguous_amount",
        "A linha possui multiplos valores monetarios; revise antes de importar.",
        "warning",
      ),
    );
  }

  return {
    occurredOn: context.occurredOn,
    description,
    amount: signedAmount,
    balanceAfter: amountTokens[1] ? amountTokens[1].value : null,
    confidence: buildConfidence({
      hasDate: true,
      keyword,
      hasBalance: Boolean(amountTokens[1]),
      ambiguousAmounts,
    }),
    issues,
    sourceRow: {
      raw: rawLine,
      dateHeader: context.occurredOn,
    },
    raw: {
      source: "statement_fallback",
      text: rawLine,
      amounts: amountTokens.map((token) => token.raw),
      keyword,
    },
  };
}

/**
 * Strip a leading date token (numeric or long-Portuguese) from a description
 * string so that inline-date rows don't carry the date prefix in their
 * description field.
 *
 * @param {string} description
 * @returns {string}
 */
function stripDatePrefixFromDescription(description) {
  // Numeric formats at the start: YYYY-MM-DD or DD/MM/YYYY, DD.MM.YYYY, etc.
  let cleaned = description
    .replace(/^\d{4}-\d{2}-\d{2}\s+/, "")
    .replace(/^\d{1,2}[\/.-]\d{1,2}(?:[\/.-]\d{2,4})?\s+/, "");

  // Long Portuguese format (normalized, no accents): "01 de marco de 2026 ..."
  cleaned = cleaned.replace(/^\d{1,2}\s+de\s+\S+\s+de\s+\d{4}\s+/i, "");

  return normalizeWhitespace(cleaned);
}

export function parseFallbackStatementLines(lines, options = {}) {
  const rows = [];
  let activeDate = null;
  let activeDateIssues = [];

  for (const rawLine of lines) {
    const line = normalizeWhitespace(rawLine);

    if (!line) {
      continue;
    }

    const dateHeader = parseStatementDateHeader(line, options);

    if (dateHeader) {
      activeDate = dateHeader.occurredOn;
      activeDateIssues = dateHeader.issues;

      // The same line may also contain an inline transaction
      // (e.g. "27/02/2026 Pix recebido: \"...\" R$ 115,00 R$ 230,00").
      // Attempt to parse the full line as a transaction using the date we
      // just extracted as context.  If it yields a valid row we keep it;
      // a pure date-header line (no keyword / amount) produces null here.
      const inlineRow = parseStatementTransactionLine(line, {
        occurredOn: activeDate,
        dateIssues: activeDateIssues,
        referenceYear: options.referenceYear,
      });

      if (inlineRow) {
        const cleanedDescription = stripDatePrefixFromDescription(inlineRow.description);
        rows.push({
          ...inlineRow,
          description: cleanedDescription || inlineRow.description,
          sourceRow: { raw: line, dateHeader: activeDate },
        });
      }

      continue;
    }

    if (isStatementNoiseLine(line)) {
      continue;
    }

    const row = parseStatementTransactionLine(line, {
      occurredOn: activeDate,
      dateIssues: activeDateIssues,
      referenceYear: options.referenceYear,
    });

    if (row) {
      rows.push(row);
    }
  }

  return rows;
}

export function inferFallbackStatementSourceKind(rows) {
  const hasBalance = rows.some((row) => row.balanceAfter !== null && row.balanceAfter !== undefined);
  const bankKeywordRows = rows.filter((row) =>
    BANK_STATEMENT_KEYWORD_PATTERN.test(normalizeStatementText(row.description)),
  ).length;

  if (hasBalance || bankKeywordRows >= 2) {
    return {
      sourceKind: "bank_statement",
      confidence: hasBalance ? 0.88 : 0.78,
    };
  }

  return {
    sourceKind: "generic_transactions",
    confidence: 0.72,
  };
}
