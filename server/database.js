import dotenv from "dotenv";
import pg from "pg";

import { runMigrations } from "./migrations.js";
import {
  buildImportSeedKey,
  createImportPreview,
  extractCategorizationMatchKey,
  enrichPreviewSessionWithAi,
  getPreviewSession,
  normalizeDescription,
  validateCommitItemsShape,
  validateCommitLine,
} from "./transaction-import.js";
import { getImportAiConfig, suggestImportCategories } from "./import-ai-service.js";

dotenv.config();

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to start the backend.");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const numberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

let initializationPromise;
let cachedUser;

function parseNumeric(value) {
  return Number.parseFloat(value ?? 0);
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCurrency(value) {
  return currencyFormatter.format(parseNumeric(value));
}

function formatPercentageChange(currentValue, previousValue) {
  const current = parseNumeric(currentValue);
  const previous = parseNumeric(previousValue);

  if (!previous) {
    return {
      raw: 0,
      formatted: "0,0%",
      positive: true,
    };
  }

  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const absolute = numberFormatter.format(Math.abs(raw));

  return {
    raw,
    formatted: `${raw >= 0 ? "+" : "-"}${absolute}%`,
    positive: raw >= 0,
  };
}

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function getTransactionTypeFromAmount(amount) {
  return Number(amount) < 0 ? "expense" : "income";
}

function parseDateOnly(value) {
  return new Date(`${normalizeDateValue(value)}T12:00:00Z`);
}

function formatRelativeDate(value, referenceValue) {
  const date = parseDateOnly(value);
  const reference = parseDateOnly(referenceValue);
  const diffInDays = Math.round((reference.getTime() - date.getTime()) / 86400000);

  if (diffInDays === 0) {
    return "Hoje";
  }

  if (diffInDays === 1) {
    return "Ontem";
  }

  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = monthLabels[date.getUTCMonth()];
  return `${day} ${month}`;
}

function mapToneToColors(tone) {
  switch (tone) {
    case "warning":
      return {
        iconColor: "text-warning",
        bgColor: "bg-warning/10",
        tagColor: "bg-warning/15 text-warning",
      };
    case "success":
      return {
        iconColor: "text-income",
        bgColor: "bg-income/10",
        tagColor: "bg-income/15 text-income",
      };
    case "info":
      return {
        iconColor: "text-info",
        bgColor: "bg-info/10",
        tagColor: "bg-info/15 text-info",
      };
    default:
      return {
        iconColor: "text-primary",
        bgColor: "bg-primary/10",
        tagColor: "bg-primary/15 text-primary",
      };
  }
}

function mapTransactionRow(row, referenceDate) {
  const amount = parseNumeric(row.amount);

  return {
    id: row.id,
    description: row.description,
    amount,
    formattedAmount: `${amount < 0 ? "- " : "+ "}${formatCurrency(Math.abs(amount))}`,
    occurredOn: normalizeDateValue(row.occurred_on),
    relativeDate: referenceDate ? formatRelativeDate(row.occurred_on, referenceDate) : normalizeDateValue(row.occurred_on),
    category: {
      id: row.category_id,
      slug: row.category_slug,
      label: row.category_label,
      icon: row.category_icon,
      color: row.category_color,
      groupSlug: row.group_slug,
      groupLabel: row.group_label,
      groupColor: row.group_color,
    },
    account: {
      id: row.bank_connection_id,
      slug: row.bank_slug,
      name: row.bank_name,
      accountType: row.bank_account_type,
      color: row.bank_color,
    },
  };
}

function mapCategoryRow(row) {
  return {
    id: row.id,
    slug: row.slug,
    label: row.label,
    transactionType: row.transaction_type,
    icon: row.icon,
    color: row.color,
    groupSlug: row.group_slug,
    groupLabel: row.group_label,
    groupColor: row.group_color,
  };
}

async function getPrimaryUserRecord(client = pool) {
  const result = await client.query(`
    SELECT id, name
    FROM users
    ORDER BY id ASC
    LIMIT 1
  `);

  return result.rows[0] ?? null;
}

async function doInitializeDatabase() {
  await runMigrations(pool);
  cachedUser = await getPrimaryUserRecord();

  if (!cachedUser) {
    throw new Error("No users were found in the database after running migrations.");
  }

  return cachedUser;
}

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = doInitializeDatabase();
  }

  return initializationPromise;
}

async function getPrimaryUser() {
  if (cachedUser) {
    return cachedUser;
  }

  await initializeDatabase();
  return cachedUser;
}

async function getReferenceMonth(userId) {
  const result = await pool.query(
    `
      SELECT month_start, total_balance, total_income, total_expenses
      FROM monthly_summaries
      WHERE user_id = $1
      ORDER BY month_start DESC
      LIMIT 2
    `,
    [userId],
  );

  return result.rows;
}

export async function pingDatabase() {
  await initializeDatabase();
  const result = await pool.query("SELECT NOW() AS server_time");
  return result.rows[0];
}

export async function getSummaryCards() {
  const user = await getPrimaryUser();
  const snapshots = await getReferenceMonth(user.id);
  const [current, previous] = snapshots;

  if (!current) {
    return [];
  }

  const balanceChange = formatPercentageChange(current.total_balance, previous?.total_balance);
  const incomeChange = formatPercentageChange(current.total_income, previous?.total_income);
  const expenseChange = formatPercentageChange(current.total_expenses, previous?.total_expenses);

  return [
    {
      label: "Saldo Total",
      value: parseNumeric(current.total_balance),
      formattedValue: formatCurrency(current.total_balance),
      change: balanceChange.formatted,
      positive: balanceChange.positive,
      description: "vs mes anterior",
    },
    {
      label: "Receitas",
      value: parseNumeric(current.total_income),
      formattedValue: formatCurrency(current.total_income),
      change: incomeChange.formatted,
      positive: incomeChange.positive,
      description: "vs mes anterior",
    },
    {
      label: "Despesas",
      value: parseNumeric(current.total_expenses),
      formattedValue: formatCurrency(current.total_expenses),
      change: expenseChange.formatted,
      positive: false,
      description: "vs mes anterior",
    },
  ];
}

export async function listBanks() {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      SELECT id, slug, name, account_type, connected, color, current_balance, sort_order
      FROM bank_connections
      WHERE user_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    accountType: row.account_type,
    connected: row.connected,
    color: row.color,
    currentBalance: parseNumeric(row.current_balance),
    formattedBalance: formatCurrency(row.current_balance),
  }));
}

export async function listRecentTransactions(limit = 8) {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        b.id AS bank_connection_id,
        b.slug AS bank_slug,
        b.name AS bank_name,
        b.account_type AS bank_account_type,
        b.color AS bank_color,
        c.id AS category_id,
        c.slug AS category_slug,
        c.label AS category_label,
        c.icon AS category_icon,
        c.color AS category_color,
        c.group_slug,
        c.group_label,
        c.group_color
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
      LIMIT $2
    `,
    [user.id, limit],
  );

  const referenceDate = normalizeDateValue(result.rows[0]?.occurred_on);

  return result.rows.map((row) => mapTransactionRow(row, referenceDate));
}

export async function listTransactions(limit) {
  const user = await getPrimaryUser();
  const hasLimit = Number.isInteger(limit) && limit > 0;
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        b.id AS bank_connection_id,
        b.slug AS bank_slug,
        b.name AS bank_name,
        b.account_type AS bank_account_type,
        b.color AS bank_color,
        c.id AS category_id,
        c.slug AS category_slug,
        c.label AS category_label,
        c.icon AS category_icon,
        c.color AS category_color,
        c.group_slug,
        c.group_label,
        c.group_color
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
      LIMIT COALESCE($2, 1000)
    `,
    [user.id, hasLimit ? limit : null],
  );

  const referenceDate = normalizeDateValue(result.rows[0]?.occurred_on);
  return result.rows.map((row) => mapTransactionRow(row, referenceDate));
}

export async function listCategories() {
  await initializeDatabase();
  const result = await pool.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color
      FROM categories
      ORDER BY sort_order ASC, label ASC, id ASC
    `,
  );

  return result.rows.map(mapCategoryRow);
}

export async function createCategory(input) {
  const label = String(input.label ?? "").trim();
  const transactionType = input.transactionType === "income" ? "income" : input.transactionType === "expense" ? "expense" : null;
  const icon = String(input.icon ?? "").trim();
  const color = String(input.color ?? "").trim();
  const groupLabel = String(input.groupLabel ?? "").trim();
  const groupColor = String(input.groupColor ?? "").trim();

  if (!label || !transactionType || !icon || !color || !groupLabel || !groupColor) {
    throw new Error("label, transactionType, icon, color, groupLabel and groupColor are required");
  }

  const slugBase = slugify(label);
  const groupSlug = slugify(groupLabel);

  if (!slugBase || !groupSlug) {
    throw new Error("invalid category label");
  }

  const slugResult = await pool.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM categories
      WHERE slug = $1 OR slug LIKE $2
    `,
    [slugBase, `${slugBase}-%`],
  );

  const total = Number(slugResult.rows[0]?.total ?? 0);
  const slug = total === 0 ? slugBase : `${slugBase}-${total + 1}`;
  const sortOrderResult = await pool.query(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort_order FROM categories`);

  const result = await pool.query(
    `
      INSERT INTO categories (slug, label, transaction_type, icon, color, group_slug, group_label, group_color, sort_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color
    `,
    [slug, label, transactionType, icon, color, groupSlug, groupLabel, groupColor, sortOrderResult.rows[0].next_sort_order],
  );

  return mapCategoryRow(result.rows[0]);
}

async function getCategoryById(categoryId) {
  const result = await pool.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color
      FROM categories
      WHERE id = $1
      LIMIT 1
    `,
    [categoryId],
  );

  return result.rows[0] ?? null;
}

async function getBankConnectionById(userId, bankConnectionId) {
  const result = await pool.query(
    `
      SELECT id, slug, name, account_type, connected, color, current_balance
      FROM bank_connections
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, bankConnectionId],
  );

  return result.rows[0] ?? null;
}

async function listTransactionFingerprintRows(userId) {
  const result = await pool.query(
    `
      SELECT occurred_on, amount, description
      FROM transactions
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows;
}

async function listHistoricalCategorizationRows(userId) {
  const result = await pool.query(
    `
      SELECT t.description, t.amount, t.category_id, t.occurred_on, c.transaction_type
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      WHERE user_id = $1
        AND t.category_id IS NOT NULL
    `,
    [userId],
  );

  return result.rows;
}

async function listRecurringCategorizationRules(userId) {
  const result = await pool.query(
    `
      SELECT match_key, type, category_id, times_confirmed, source
      FROM transaction_categorization_rules
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows;
}

async function upsertTransactionCategorizationRule({ categoryId, matchKey, type, userId }, client = pool) {
  if (!matchKey || !type || !Number.isInteger(Number(categoryId))) {
    return;
  }

  const existing = await client.query(
    `
      SELECT id, type, category_id, times_confirmed
      FROM transaction_categorization_rules
      WHERE user_id = $1
        AND match_key = $2
      LIMIT 1
    `,
    [userId, matchKey],
  );

  if (!existing.rowCount) {
    await client.query(
      `
        INSERT INTO transaction_categorization_rules (
          user_id,
          match_key,
          type,
          category_id,
          source,
          times_confirmed,
          last_used_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, 'user_confirmed', 1, NOW(), NOW(), NOW())
      `,
      [userId, matchKey, type, Number(categoryId)],
    );
    return;
  }

  const row = existing.rows[0];
  const sameDecision = row.type === type && Number(row.category_id) === Number(categoryId);
  const nextCount = sameDecision ? Number(row.times_confirmed ?? 0) + 1 : 1;
  const source = nextCount >= 3 ? "learned_recurring" : "user_confirmed";

  await client.query(
    `
      UPDATE transaction_categorization_rules
      SET type = $2,
          category_id = $3,
          source = $4,
          times_confirmed = $5,
          last_used_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [row.id, type, Number(categoryId), source, nextCount],
  );
}

async function createImportedTransaction({ userId, bankConnectionId, categoryId, description, amount, occurredOn, seedKey }) {
  const result = await pool.query(
    `
      INSERT INTO transactions (user_id, bank_connection_id, category_id, description, amount, occurred_on, seed_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, seed_key) DO NOTHING
      RETURNING id
    `,
    [userId, bankConnectionId, categoryId, description, amount, occurredOn, seedKey],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = await getTransactionById(userId, result.rows[0].id);
  return mapTransactionRow(row, occurredOn);
}

async function getTransactionById(userId, transactionId) {
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        b.id AS bank_connection_id,
        b.slug AS bank_slug,
        b.name AS bank_name,
        b.account_type AS bank_account_type,
        b.color AS bank_color,
        c.id AS category_id,
        c.slug AS category_slug,
        c.label AS category_label,
        c.icon AS category_icon,
        c.color AS category_color,
        c.group_slug,
        c.group_label,
        c.group_color
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = $1
        AND t.id = $2
      LIMIT 1
    `,
    [userId, transactionId],
  );

  return result.rows[0] ?? null;
}

export async function createTransaction(input) {
  const user = await getPrimaryUser();
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const categoryId = Number(input.categoryId);
  const bankConnectionId = Number(input.bankConnectionId);

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(categoryId) || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn, categoryId and bankConnectionId are required");
  }

  const category = await getCategoryById(categoryId);

  if (!category) {
    throw new Error("category not found");
  }

  if (category.transaction_type !== getTransactionTypeFromAmount(amount)) {
    throw new Error("category does not match transaction type");
  }

  const bankConnection = await getBankConnectionById(user.id, bankConnectionId);

  if (!bankConnection) {
    throw new Error("bank connection not found");
  }

  const result = await pool.query(
    `
      INSERT INTO transactions (user_id, bank_connection_id, category_id, description, amount, occurred_on)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [user.id, bankConnectionId, categoryId, description, amount, occurredOn],
  );

  const row = await getTransactionById(user.id, result.rows[0].id);
  return mapTransactionRow(row, occurredOn);
}

export async function updateTransaction(transactionId, input) {
  const user = await getPrimaryUser();
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const categoryId = Number(input.categoryId);
  const bankConnectionId = Number(input.bankConnectionId);

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(categoryId) || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn, categoryId and bankConnectionId are required");
  }

  const category = await getCategoryById(categoryId);

  if (!category) {
    throw new Error("category not found");
  }

  if (category.transaction_type !== getTransactionTypeFromAmount(amount)) {
    throw new Error("category does not match transaction type");
  }

  const bankConnection = await getBankConnectionById(user.id, bankConnectionId);

  if (!bankConnection) {
    throw new Error("bank connection not found");
  }

  const result = await pool.query(
    `
      UPDATE transactions
      SET bank_connection_id = $3,
          category_id = $4,
          description = $5,
          amount = $6,
          occurred_on = $7
      WHERE user_id = $1
        AND id = $2
      RETURNING id
    `,
    [user.id, transactionId, bankConnectionId, categoryId, description, amount, occurredOn],
  );

  if (!result.rowCount) {
    throw new Error("transaction not found");
  }

  const row = await getTransactionById(user.id, transactionId);
  return mapTransactionRow(row, occurredOn);
}

export async function deleteTransaction(transactionId) {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      DELETE FROM transactions
      WHERE user_id = $1
        AND id = $2
    `,
    [user.id, transactionId],
  );

  if (!result.rowCount) {
    throw new Error("transaction not found");
  }
}

export async function previewTransactionImport(fileBuffer, importSource = "bank_statement", bankConnectionId) {
  const user = await getPrimaryUser();
  const parsedBankConnectionId = Number(bankConnectionId);

  if (!Number.isInteger(parsedBankConnectionId)) {
    throw new Error("bankConnectionId is required");
  }

  const bankConnection = await getBankConnectionById(user.id, parsedBankConnectionId);

  if (!bankConnection) {
    throw new Error("bank connection not found");
  }

  if (importSource === "credit_card_statement" && bankConnection.account_type !== "credit_card") {
    throw new Error("A fatura do cartao precisa ser vinculada a uma conta do tipo cartao.");
  }

  if (importSource === "bank_statement" && bankConnection.account_type !== "bank_account") {
    throw new Error("O extrato bancario precisa ser vinculado a uma conta bancaria.");
  }

  const [categories, fingerprintRows, historicalRows, recurringRules] = await Promise.all([
    listCategories(),
    listTransactionFingerprintRows(user.id),
    listHistoricalCategorizationRows(user.id),
    listRecurringCategorizationRules(user.id),
  ]);

  const existingFingerprints = new Set(
    fingerprintRows.map((row) =>
      buildImportSeedKey(user.id, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
    ),
  );

  return createImportPreview({
    categories,
    existingFingerprints,
    bankConnectionId: parsedBankConnectionId,
    bankConnectionName: bankConnection.name,
    fileBuffer,
    historicalRows,
    importSource,
    recurringRules,
    userId: user.id,
  });
}

export async function getTransactionImportAiSuggestions(input) {
  const user = await getPrimaryUser();
  const session = getPreviewSession(input.previewToken, user.id);
  const categories = await listCategories();
  const config = getImportAiConfig();

  if (!config.enabled) {
    return {
      previewToken: String(input.previewToken),
      status: "disabled",
      autoApplyThreshold: config.autoApplyThreshold,
      items: [],
      summary: {
        requestedRows: Array.isArray(input.rowIndexes) ? input.rowIndexes.length : 0,
        suggestedRows: 0,
        noMatchRows: 0,
        failedRows: 0,
      },
    };
  }

  const result = await enrichPreviewSessionWithAi({
    session,
    categories,
    rowIndexes: input.rowIndexes,
    maxRows: config.maxRowsPerRequest,
    suggestCategories: async ({ items, categories: allowedCategories }) => {
      const response = await suggestImportCategories({
        items,
        categories: allowedCategories,
      });

      return response.items;
    },
  });

  return {
    previewToken: String(input.previewToken),
    status: "completed",
    autoApplyThreshold: config.autoApplyThreshold,
    items: result.items,
    summary: result.summary,
  };
}

export async function commitTransactionImport(input) {
  const user = await getPrimaryUser();
  const session = getPreviewSession(input.previewToken, user.id);
  validateCommitItemsShape(input.items, session);

  const [categories, fingerprintRows] = await Promise.all([listCategories(), listTransactionFingerprintRows(user.id)]);
  const existingFingerprints = new Set(
    fingerprintRows.map((row) =>
      buildImportSeedKey(user.id, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
    ),
  );
  const commitFingerprints = new Set(existingFingerprints);
  const results = [];
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;

  for (const item of input.items) {
    try {
      const normalized = validateCommitLine(item, categories);

      if (normalized.exclude) {
        skippedCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          status: "skipped",
          reason: "excluded",
          message: "Linha removida pelo usuario.",
        });
        continue;
      }

      const seedKey = buildImportSeedKey(
        user.id,
        normalized.normalizedOccurredOn,
        normalized.signedAmount,
        normalized.normalizedFinalDescription,
      );

      if (commitFingerprints.has(seedKey) && !normalized.ignoreDuplicate) {
        skippedCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          status: "skipped",
          reason: "duplicate",
          message: "Linha pulada por duplicata provavel.",
        });
        continue;
      }

      const transaction = await createImportedTransaction({
        userId: user.id,
        bankConnectionId: session.bankConnectionId,
        categoryId: normalized.categoryId,
        description: normalized.description,
        amount: normalized.signedAmount,
        occurredOn: normalized.normalizedOccurredOn,
        seedKey,
      });

      commitFingerprints.add(seedKey);

      if (!transaction) {
        skippedCount += 1;
        results.push({
          rowIndex: item.rowIndex,
          status: "skipped",
          reason: "already_imported",
          message: "Linha ja importada anteriormente.",
        });
        continue;
      }

      importedCount += 1;
      await upsertTransactionCategorizationRule({
        userId: user.id,
        matchKey: extractCategorizationMatchKey(normalized.description),
        type: normalized.type,
        categoryId: normalized.categoryId,
      });
      results.push({
        rowIndex: item.rowIndex,
        status: "imported",
        reason: "success",
        message: "Linha importada com sucesso.",
        transaction,
      });
    } catch (error) {
      failedCount += 1;
      results.push({
        rowIndex: item.rowIndex,
        status: "failed",
        reason: "invalid",
        message: error instanceof Error ? error.message : "Linha invalida.",
      });
    }
  }

  return {
    importedCount,
    skippedCount,
    failedCount,
    results,
  };
}

export async function listSpendingByCategory() {
  const user = await getPrimaryUser();
  const totalsResult = await pool.query(
    `
      WITH latest_month AS (
        SELECT MAX(month_start) AS month_start
        FROM monthly_summaries
        WHERE user_id = $1
      )
      SELECT
        c.group_slug,
        c.group_label,
        c.group_color,
        ABS(SUM(t.amount))::NUMERIC(12, 2) AS total
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      INNER JOIN latest_month lm
        ON DATE_TRUNC('month', t.occurred_on)::DATE = lm.month_start
      WHERE t.user_id = $1
        AND t.amount < 0
      GROUP BY c.group_slug, c.group_label, c.group_color
      ORDER BY total DESC, c.group_label ASC
    `,
    [user.id],
  );

  const totalSpent = totalsResult.rows.reduce((acc, row) => acc + parseNumeric(row.total), 0);

  return totalsResult.rows.map((row) => ({
    slug: row.group_slug,
    label: row.group_label,
    color: row.group_color,
    total: parseNumeric(row.total),
    formattedTotal: formatCurrency(row.total),
    percentage: totalSpent > 0 ? Math.round((parseNumeric(row.total) / totalSpent) * 100) : 0,
  }));
}

export async function listInsights() {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      SELECT id, title, description, tag, tone
      FROM insights
      WHERE user_id = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [user.id],
  );

  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    tag: row.tag,
    tone: row.tone,
    ...mapToneToColors(row.tone),
  }));
}

export async function listChatMessages(limit = 20) {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      SELECT id, role, content, created_at
      FROM (
        SELECT id, role, content, created_at
        FROM chat_messages
        WHERE user_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT $2
      ) recent
      ORDER BY created_at ASC, id ASC
    `,
    [user.id, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

async function getDeliverySpend(userId) {
  const result = await pool.query(
    `
      WITH latest_month AS (
        SELECT MAX(month_start) AS month_start
        FROM monthly_summaries
        WHERE user_id = $1
      )
      SELECT COALESCE(ABS(SUM(t.amount)), 0) AS total
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      INNER JOIN latest_month lm
        ON DATE_TRUNC('month', t.occurred_on)::DATE = lm.month_start
      WHERE t.user_id = $1
        AND t.amount < 0
        AND c.slug IN ('restaurantes', 'cafe')
    `,
    [userId],
  );

  return parseNumeric(result.rows[0]?.total);
}

function buildAssistantReply(message, context) {
  const text = message.toLowerCase();
  const balanceCard = context.summaryCards.find((card) => card.label === "Saldo Total");
  const expenseCard = context.summaryCards.find((card) => card.label === "Despesas");
  const topCategory = context.spendingByCategory[0];

  if (text.includes("delivery") || text.includes("ifood") || text.includes("alimenta")) {
    return [
      `Hoje a sua maior pressao continua em ${topCategory?.label ?? "Alimentacao"} (${topCategory?.percentage ?? 0}% do total mensal).`,
      `So em delivery, cafes e restaurantes voce ja consumiu ${formatCurrency(context.deliverySpend)} no mes.`,
      "",
      "Sugestoes praticas:",
      "1. Defina um teto semanal para delivery e acompanhe toda sexta.",
      "2. Troque 2 pedidos por mercado planejado no fim de semana.",
      "3. Centralize assinaturas e cupons em um unico dia para evitar compras por impulso.",
    ].join("\n");
  }

  if (text.includes("econom")) {
    return [
      `Seu saldo atual esta em ${balanceCard?.formattedValue ?? formatCurrency(0)} e as despesas do mes somam ${expenseCard?.formattedValue ?? formatCurrency(0)}.`,
      `Hoje o maior peso esta em ${topCategory?.label ?? "Moradia"} (${topCategory?.percentage ?? 0}% do total).`,
      "",
      "Se quiser economizar mais rapido, comece por:",
      "1. Alimentacao fora de casa.",
      "2. Transporte por aplicativo nas sextas.",
      "3. Assinaturas com pouco uso.",
    ].join("\n");
  }

  if (text.includes("uber") || text.includes("transporte")) {
    return [
      "O gasto com transporte esta concentrado em corridas curtas e picos nas sextas.",
      "Uma regra simples para testar por 2 semanas:",
      "1. Use Uber apenas para deslocamentos acima de 5 km.",
      "2. Agrupe compromissos no mesmo dia.",
      "3. Compare o total semanal com a media atual.",
    ].join("\n");
  }

  return [
    `Seu saldo atual esta em ${balanceCard?.formattedValue ?? formatCurrency(0)}.`,
    `As despesas do mes estao em ${expenseCard?.formattedValue ?? formatCurrency(0)} e a categoria mais pesada e ${topCategory?.label ?? "Moradia"}.`,
    "Se quiser, eu posso detalhar onde cortar gastos por categoria.",
  ].join("\n");
}

async function insertChatMessage(userId, role, content) {
  const result = await pool.query(
    `
      INSERT INTO chat_messages (user_id, role, content)
      VALUES ($1, $2, $3)
      RETURNING id, role, content, created_at
    `,
    [userId, role, content],
  );

  const row = result.rows[0];

  return {
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  };
}

export async function createChatReply(message) {
  const user = await getPrimaryUser();
  const userMessage = await insertChatMessage(user.id, "user", message);
  const [summaryCards, spendingByCategory, deliverySpend] = await Promise.all([
    getSummaryCards(),
    listSpendingByCategory(),
    getDeliverySpend(user.id),
  ]);

  const assistantContent = buildAssistantReply(message, {
    summaryCards,
    spendingByCategory,
    deliverySpend,
  });

  const assistantMessage = await insertChatMessage(user.id, "assistant", assistantContent);

  return {
    userMessage,
    assistantMessage,
  };
}

export async function getDashboardData() {
  const user = await getPrimaryUser();
  const [summaryCards, recentTransactions, spendingByCategory, insights, banks, chatMessages, snapshots] =
    await Promise.all([
      getSummaryCards(),
      listRecentTransactions(),
      listSpendingByCategory(),
      listInsights(),
      listBanks(),
      listChatMessages(),
      getReferenceMonth(user.id),
    ]);

  return {
    user,
    referenceMonth: normalizeDateValue(snapshots[0]?.month_start),
    summaryCards,
    recentTransactions,
    spendingByCategory,
    insights,
    banks,
    chatMessages,
  };
}

export async function closeDatabase() {
  await pool.end();
}
