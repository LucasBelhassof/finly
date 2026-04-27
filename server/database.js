import dotenv from "dotenv";
import pg from "pg";
import { randomUUID } from "node:crypto";

import { runMigrations } from "./migrations.js";
import {
  buildInstallmentPurchaseSeedKey,
  buildInstallmentTransactionSeedKey,
  buildImportedTransactionEntries,
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
import { buildInstallmentsOverviewResponse } from "./installments-overview.js";
import { buildDashboardSummaryCards } from "./dashboard-summary.js";
import { normalizeDashboardFilters, shiftDashboardDateKey } from "./dashboard-filters.js";
import {
  generateChatReply,
  generateChatSummary,
  generateChatTitle,
  generatePlanAssessment,
  generatePlanDraft,
  revisePlanDraft,
  suggestPlanLink,
} from "./chat-ai-service.js";
import { buildTransactionCategorySyncPlan } from "./transaction-update.js";
import {
  buildPreviousMonthEndDate,
  buildTransactionRowsWithRecurringProjections,
  shouldSplitRecurringTransaction,
  shouldTruncateRecurringTransaction,
} from "./recurring-income.js";

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

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

let initializationPromise;

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

function normalizeDateValue(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value).slice(0, 10);
}

function addMonthsToDate(value, monthOffset, dueDay) {
  const date = parseDateOnly(value);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + monthOffset;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const safeDay = Math.min(Math.max(Number(dueDay), 1), lastDay);

  return new Date(Date.UTC(year, month, safeDay)).toISOString().slice(0, 10);
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
    isRecurring: Boolean(row.is_recurring),
    isRecurringProjection: Boolean(row.is_recurring_projection),
    sourceTransactionId: row.recurring_source_transaction_id ?? row.id,
    recurrenceEndsOn: normalizeDateValue(row.recurrence_ends_on),
    housingId: row.housing_id ?? null,
    isInstallment: Boolean(row.installment_purchase_id),
    installmentPurchaseId: row.installment_purchase_id ?? null,
    installmentNumber: Number.isInteger(Number(row.installment_number)) ? Number(row.installment_number) : null,
    installmentCount: Number.isInteger(Number(row.installment_count)) ? Number(row.installment_count) : null,
    purchaseOccurredOn: normalizeDateValue(row.purchase_occurred_on),
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

function mapTransactionRows(rows) {
  const referenceDate = normalizeDateValue(rows[0]?.occurred_on);
  return rows.map((row) => mapTransactionRow(row, referenceDate));
}

function resolveRecurringProjectionHorizonEnd() {
  const currentDate = new Date();
  return new Date(Date.UTC(currentDate.getUTCFullYear() + 1, 11, 31)).toISOString().slice(0, 10);
}

function calculateMonthlyTotalsFromRows(rows, currentMonthRange, previousMonthRange) {
  return rows.reduce(
    (accumulator, row) => {
      const amount = parseNumeric(row.amount);
      const occurredOn = normalizeDateValue(row.occurred_on);

      if (!occurredOn) {
        return accumulator;
      }

      if (occurredOn >= currentMonthRange.start && occurredOn < currentMonthRange.end) {
        if (amount > 0) {
          accumulator.currentIncome += amount;
        } else {
          accumulator.currentExpenses += Math.abs(amount);
        }
      }

      if (occurredOn >= previousMonthRange.start && occurredOn < previousMonthRange.end) {
        if (amount > 0) {
          accumulator.previousIncome += amount;
        } else {
          accumulator.previousExpenses += Math.abs(amount);
        }
      }

      return accumulator;
    },
    {
      currentIncome: 0,
      currentExpenses: 0,
      previousIncome: 0,
      previousExpenses: 0,
    },
  );
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
    isSystem: Boolean(row.is_system),
  };
}

async function doInitializeDatabase() {
  await runMigrations(pool);
}

export async function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = doInitializeDatabase();
  }

  return initializationPromise;
}

async function requireUserId(userId) {
  await initializeDatabase();

  const normalizedUserId = Number(userId);

  if (!Number.isInteger(normalizedUserId)) {
    throw new Error("authenticated user is required");
  }

  return normalizedUserId;
}

async function getUserById(userId, client = pool) {
  const result = await client.query(
    `
      SELECT id, name, email
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
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

export async function getSummaryCards(userId) {
  const resolvedUserId = await requireUserId(userId);
  const today = new Date().toISOString().slice(0, 10);
  const currentMonthStart = new Date();
  currentMonthStart.setUTCDate(1);
  currentMonthStart.setUTCHours(0, 0, 0, 0);
  const nextMonthStart = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() + 1, 1));
  const previousMonthStart = new Date(Date.UTC(currentMonthStart.getUTCFullYear(), currentMonthStart.getUTCMonth() - 1, 1));
  const [balanceResult, monthlyTotalsResult, transactionBalanceResult] = await Promise.all([
    pool.query(
      `
        SELECT
          COALESCE(SUM(current_balance), 0)::NUMERIC(12, 2) AS current_balance,
          COUNT(*) FILTER (WHERE COALESCE(current_balance, 0) <> 0) AS configured_balance_count
        FROM bank_connections
        WHERE user_id = $1
      `,
      [resolvedUserId],
    ),
    pool.query(
      `
        SELECT
          t.id,
          t.amount,
          t.occurred_on,
          t.is_recurring,
          t.recurrence_ends_on
        FROM transactions t
        WHERE t.user_id = $1
          AND (
            t.occurred_on >= $2
            OR (t.is_recurring = TRUE AND t.amount > 0 AND t.occurred_on < $3)
          )
      `,
      [resolvedUserId, previousMonthStart.toISOString().slice(0, 10), nextMonthStart.toISOString().slice(0, 10)],
    ),
    pool.query(
      `
        SELECT COALESCE(SUM(amount), 0)::NUMERIC(12, 2) AS transaction_balance
        FROM transactions
        WHERE user_id = $1
          AND occurred_on <= $2
      `,
      [resolvedUserId, today],
    ),
  ]);

  const balanceRow = balanceResult.rows[0] ?? {};
  const transactionBalanceRow = transactionBalanceResult.rows[0] ?? {};
  const projectedRows = buildTransactionRowsWithRecurringProjections(monthlyTotalsResult.rows, {
    projectionEndDate: nextMonthStart.toISOString().slice(0, 10),
  });
  const monthlyTotalsRow = calculateMonthlyTotalsFromRows(
    projectedRows,
    {
      start: currentMonthStart.toISOString().slice(0, 10),
      end: nextMonthStart.toISOString().slice(0, 10),
    },
    {
      start: previousMonthStart.toISOString().slice(0, 10),
      end: currentMonthStart.toISOString().slice(0, 10),
    },
  );

  return buildDashboardSummaryCards({
    currentBalance: balanceRow.current_balance,
    fallbackBalance: transactionBalanceRow.transaction_balance,
    hasConfiguredBalance: Number(balanceRow.configured_balance_count ?? 0) > 0,
    currentIncome: monthlyTotalsRow.currentIncome,
    currentExpenses: monthlyTotalsRow.currentExpenses,
    previousIncome: monthlyTotalsRow.previousIncome,
    previousExpenses: monthlyTotalsRow.previousExpenses,
  });
}

async function getDashboardSummaryCardsWithFilters(userId, filters) {
  const resolvedUserId = await requireUserId(userId);
  const normalizedFilters = normalizeDashboardFilters(filters);

  if (!normalizedFilters.active) {
    return getSummaryCards(resolvedUserId);
  }

  const endDateExclusive = shiftDashboardDateKey(normalizedFilters.endDate, 1);
  const previousEndDateExclusive = shiftDashboardDateKey(normalizedFilters.previousEndDate, 1);
  const [transactionBalanceResult, monthlyTotalsResult] = await Promise.all([
    pool.query(
      `
        SELECT COALESCE(SUM(amount), 0)::NUMERIC(12, 2) AS transaction_balance
        FROM transactions
        WHERE user_id = $1
          AND occurred_on <= $2
      `,
      [resolvedUserId, normalizedFilters.endDate],
    ),
    pool.query(
      `
        SELECT
          t.id,
          t.amount,
          t.occurred_on,
          t.is_recurring,
          t.recurrence_ends_on
        FROM transactions t
        WHERE t.user_id = $1
          AND (
            t.occurred_on >= $2
            OR (t.is_recurring = TRUE AND t.amount > 0 AND t.occurred_on < $3)
          )
      `,
      [resolvedUserId, normalizedFilters.previousStartDate, endDateExclusive],
    ),
  ]);

  const projectedRows = buildTransactionRowsWithRecurringProjections(monthlyTotalsResult.rows, {
    projectionEndDate: normalizedFilters.endDate,
  }).filter((row) => {
    const occurredOn = normalizeDateValue(row.occurred_on);
    return occurredOn >= normalizedFilters.previousStartDate && occurredOn <= normalizedFilters.endDate;
  });

  const totals = calculateMonthlyTotalsFromRows(
    projectedRows,
    {
      start: normalizedFilters.startDate,
      end: endDateExclusive,
    },
    {
      start: normalizedFilters.previousStartDate,
      end: previousEndDateExclusive,
    },
  );

  return buildDashboardSummaryCards({
    currentBalance: transactionBalanceResult.rows[0]?.transaction_balance ?? 0,
    hasConfiguredBalance: true,
    currentIncome: totals.currentIncome,
    currentExpenses: totals.currentExpenses,
    previousIncome: totals.previousIncome,
    previousExpenses: totals.previousExpenses,
  });
}

export async function listBanks(userId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
        SELECT
          b.id,
          b.slug,
          b.name,
          b.account_type,
          b.connected,
          b.color,
          b.current_balance,
          b.credit_limit,
          b.sort_order,
          b.parent_bank_connection_id,
          parent.name AS parent_account_name,
          b.statement_close_day,
          b.statement_due_day,
          b.institution_name,
          b.institution_image_url
      FROM bank_connections b
      LEFT JOIN bank_connections parent ON parent.id = b.parent_bank_connection_id
      WHERE b.user_id = $1
      ORDER BY
        COALESCE(b.parent_bank_connection_id, b.id) ASC,
        CASE WHEN b.account_type = 'credit_card' THEN 1 ELSE 0 END ASC,
        b.sort_order ASC,
        b.id ASC
    `,
    [resolvedUserId],
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
    creditLimit: row.credit_limit === null ? null : parseNumeric(row.credit_limit),
    formattedCreditLimit: row.credit_limit === null ? null : formatCurrency(row.credit_limit),
    parentBankConnectionId: row.parent_bank_connection_id,
    parentAccountName: row.parent_account_name,
    statementCloseDay: row.statement_close_day,
    statementDueDay: row.statement_due_day,
    institutionName: row.institution_name ?? null,
    institutionImageUrl: row.institution_image_url ?? null,
  }));
}

export async function createBankConnection(userId, input) {
  const resolvedUserId = await requireUserId(userId);
  const normalized = await validateBankConnectionInput(resolvedUserId, input);
  const [slug, sortOrder] = await Promise.all([
    buildUniqueBankSlug(resolvedUserId, normalized.name),
    getNextBankSortOrder(resolvedUserId),
  ]);

  const result = await pool.query(
    `
      INSERT INTO bank_connections (
        user_id,
        slug,
        name,
        account_type,
        connected,
        color,
        current_balance,
        credit_limit,
        sort_order,
        parent_bank_connection_id,
        statement_close_day,
        statement_due_day
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      resolvedUserId,
      slug,
      normalized.name,
      normalized.accountType,
      normalized.connected,
      normalized.color,
      normalized.currentBalance,
      normalized.creditLimit,
      sortOrder,
      normalized.parentBankConnectionId,
      normalized.statementCloseDay,
      normalized.statementDueDay,
    ],
  );

  const created = await listBanks(resolvedUserId);
  const bank = created.find((item) => String(item.id) === String(result.rows[0].id));

  if (!bank) {
    throw new Error("bank connection not found after creation");
  }

  return bank;
}

export async function updateBankConnection(userId, bankConnectionId, input) {
  const resolvedUserId = await requireUserId(userId);
  const existing = await getBankConnectionById(resolvedUserId, bankConnectionId);

  if (!existing) {
    throw new Error("bank connection not found");
  }

  const normalized = await validateBankConnectionInput(resolvedUserId, input, bankConnectionId);
  const hasChildren = await hasChildBankConnections(resolvedUserId, bankConnectionId);

  if (hasChildren && normalized.accountType !== "bank_account") {
    throw new Error("accounts with linked cards must remain bank accounts");
  }

  await pool.query(
    `
      UPDATE bank_connections
        SET name = $3,
            account_type = $4,
            connected = $5,
            color = $6,
            current_balance = $7,
            credit_limit = $8,
            parent_bank_connection_id = $9,
            statement_close_day = $10,
            statement_due_day = $11,
            updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
      `,
    [
      resolvedUserId,
      bankConnectionId,
      normalized.name,
        normalized.accountType,
        normalized.connected,
        normalized.color,
        normalized.currentBalance,
        normalized.creditLimit,
        normalized.parentBankConnectionId,
        normalized.statementCloseDay,
        normalized.statementDueDay,
      ],
  );

  const updated = await listBanks(resolvedUserId);
  const bank = updated.find((item) => String(item.id) === String(bankConnectionId));

  if (!bank) {
    throw new Error("bank connection not found after update");
  }

  return bank;
}

export async function deleteBankConnection(userId, bankConnectionId) {
  const resolvedUserId = await requireUserId(userId);
  const existing = await getBankConnectionById(resolvedUserId, bankConnectionId);

  if (!existing) {
    throw new Error("bank connection not found");
  }

  if (await hasChildBankConnections(resolvedUserId, bankConnectionId)) {
    throw new Error("delete linked cards before deleting the parent bank account");
  }

  if (await hasTransactionsForBankConnection(resolvedUserId, bankConnectionId)) {
    throw new Error("cannot delete a bank connection already used by transactions");
  }

  if (existing.account_type === "cash" && (await countCashBankConnections(resolvedUserId)) <= 1) {
    throw new Error("at least one cash account must remain");
  }

  const result = await pool.query(
    `
      DELETE FROM bank_connections
      WHERE user_id = $1
        AND id = $2
    `,
    [resolvedUserId, bankConnectionId],
  );

  if (!result.rowCount) {
    throw new Error("bank connection not found");
  }
}

export async function listRecentTransactions(userId, limit = 8, filters = {}) {
  const resolvedUserId = await requireUserId(userId);
  const normalizedFilters = normalizeDashboardFilters(filters);

  if (normalizedFilters.active) {
    const endDateExclusive = shiftDashboardDateKey(normalizedFilters.endDate, 1);
    const result = await pool.query(
      `
        SELECT
          t.id,
          t.description,
          t.amount,
          t.occurred_on,
          t.housing_id,
          t.installment_purchase_id,
          t.installment_number,
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
          c.group_color,
          t.is_recurring,
          t.recurrence_ends_on,
          ip.installment_count,
          ip.purchase_occurred_on
        FROM transactions t
        INNER JOIN bank_connections b ON b.id = t.bank_connection_id
        INNER JOIN categories c ON c.id = t.category_id
        LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
        WHERE t.user_id = $1
          AND (
            t.occurred_on >= $2
            OR (t.is_recurring = TRUE AND t.amount > 0 AND t.occurred_on < $3)
          )
        ORDER BY t.occurred_on DESC, t.id DESC
      `,
      [resolvedUserId, normalizedFilters.startDate, endDateExclusive],
    );

    const filteredRows = buildTransactionRowsWithRecurringProjections(result.rows, {
      projectionEndDate: normalizedFilters.endDate,
    })
      .filter((row) => {
        const occurredOn = normalizeDateValue(row.occurred_on);
        return occurredOn >= normalizedFilters.startDate && occurredOn <= normalizedFilters.endDate;
      })
      .slice(0, limit);

    return mapTransactionRows(filteredRows);
  }

  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        t.housing_id,
        t.installment_purchase_id,
        t.installment_number,
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
        c.group_color,
        t.is_recurring,
        t.recurrence_ends_on,
        ip.installment_count,
        ip.purchase_occurred_on
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
    `,
    [resolvedUserId],
  );

  return mapTransactionRows(
    buildTransactionRowsWithRecurringProjections(result.rows, {
      projectionEndDate: new Date().toISOString().slice(0, 10),
      projectionLimit: limit,
    }),
  );
}

export async function listTransactions(userId, limit) {
  const resolvedUserId = await requireUserId(userId);
  const hasLimit = Number.isInteger(limit) && limit > 0;
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        t.housing_id,
        t.installment_purchase_id,
        t.installment_number,
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
        c.group_color,
        t.is_recurring,
        t.recurrence_ends_on,
        ip.installment_count,
        ip.purchase_occurred_on
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
      LIMIT COALESCE($2, 1000)
    `,
    [resolvedUserId, hasLimit ? limit : null],
  );

  return mapTransactionRows(
    buildTransactionRowsWithRecurringProjections(result.rows, {
      projectionEndDate: resolveRecurringProjectionHorizonEnd(),
      projectionLimit: hasLimit ? limit : null,
    }),
  );
}

export async function getInstallmentsOverview(userId, filters = {}) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      SELECT
        ip.id AS installment_purchase_id,
        ip.description_base,
        ip.purchase_occurred_on,
        ip.installment_count,
        ip.amount_per_installment,
        b.id AS card_id,
        b.name AS card_name,
        b.statement_due_day,
        COALESCE(ip.category_id, t.category_id) AS category_id,
        c.label AS category_label,
        t.id AS transaction_id,
        t.occurred_on,
        t.installment_number
      FROM installment_purchases ip
      INNER JOIN bank_connections b ON b.id = ip.bank_connection_id
      LEFT JOIN transactions t ON t.installment_purchase_id = ip.id
      LEFT JOIN categories c ON c.id = COALESCE(ip.category_id, t.category_id)
      WHERE ip.user_id = $1
        AND (b.account_type = 'credit_card' OR ip.housing_id IS NOT NULL)
        AND ip.installment_count >= 2
      ORDER BY ip.id ASC, t.installment_number ASC NULLS LAST, t.id ASC
    `,
    [resolvedUserId],
  );

  const rows = result.rows.map((row) => ({
    installmentPurchaseId: row.installment_purchase_id,
    descriptionBase: row.description_base,
    purchaseDate: normalizeDateValue(row.purchase_occurred_on),
    installmentCount: Number(row.installment_count),
    installmentAmount: parseNumeric(row.amount_per_installment),
    cardId: row.card_id,
    cardName: row.card_name,
    statementDueDay: Number.isInteger(Number(row.statement_due_day)) ? Number(row.statement_due_day) : null,
    categoryId: row.category_id,
    categoryLabel: row.category_label ?? "Sem categoria",
    transactionId: row.transaction_id,
    occurredOn: normalizeDateValue(row.occurred_on),
    installmentNumber: Number.isInteger(Number(row.installment_number)) ? Number(row.installment_number) : null,
  }));

  return buildInstallmentsOverviewResponse(rows, filters);
}

const housingExpenseTypes = new Set(["rent", "home_financing", "electricity", "water", "condo", "vehicle_financing", "other"]);
const housingFinancingTypes = new Set(["home_financing", "vehicle_financing"]);
const investmentContributionModes = new Set(["fixed_amount", "income_percentage"]);
const investmentStatuses = new Set(["active", "paused", "archived"]);

function mapHousingRow(row, transactions = []) {
  const amount = parseNumeric(row.amount);

  return {
    id: row.id,
    description: row.description,
    expenseType: row.expense_type,
    amount,
    formattedAmount: formatCurrency(amount),
    dueDay: Number(row.due_day),
    startDate: normalizeDateValue(row.start_date),
    installmentCount: Number.isInteger(Number(row.installment_count)) ? Number(row.installment_count) : null,
    notes: row.notes ?? "",
    status: row.status,
    bank: {
      id: row.bank_connection_id,
      slug: row.bank_slug,
      name: row.bank_name,
      accountType: row.bank_account_type,
      color: row.bank_color,
    },
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
    installmentPurchaseId: row.installment_purchase_id ?? null,
    transactionIds: transactions.map((transaction) => transaction.id),
    transactions: transactions.map((transaction) => ({
      id: transaction.id,
      occurredOn: normalizeDateValue(transaction.occurred_on),
      amount: parseNumeric(transaction.amount),
      installmentNumber: Number.isInteger(Number(transaction.installment_number)) ? Number(transaction.installment_number) : null,
    })),
  };
}

function validateHousingInput(input) {
  const description = String(input.description ?? "").trim();
  const expenseType = String(input.expenseType ?? input.expense_type ?? "").trim();
  const amount = Number(input.amount);
  const dueDay = Number(input.dueDay ?? input.due_day);
  const startDate = normalizeDateValue(input.startDate ?? input.start_date);
  const bankConnectionId = Number(input.bankConnectionId ?? input.bank_connection_id);
  const notes = String(input.notes ?? "").trim();
  const status = input.status === "inactive" ? "inactive" : "active";
  const isFinancing = housingFinancingTypes.has(expenseType);
  const installmentCountValue = input.installmentCount ?? input.installment_count;
  const installmentCount =
    installmentCountValue === undefined || installmentCountValue === null || installmentCountValue === ""
      ? null
      : Number(installmentCountValue);

  if (!description || !housingExpenseTypes.has(expenseType)) {
    throw new Error("description and valid expenseType are required");
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("amount must be greater than zero");
  }

  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31 || !startDate) {
    throw new Error("dueDay and startDate are required");
  }

  if (!Number.isInteger(bankConnectionId)) {
    throw new Error("bankConnectionId is required");
  }

  if (isFinancing && (!Number.isInteger(installmentCount) || installmentCount < 2)) {
    throw new Error("installmentCount must be at least 2 for financing housing expenses");
  }

  return {
    description,
    expenseType,
    amount,
    dueDay,
    startDate,
    bankConnectionId,
    notes,
    status,
    installmentCount: isFinancing ? installmentCount : null,
  };
}

async function getHousingRows(userId, housingId = null, client = pool) {
  const result = await client.query(
    `
      SELECT
        h.id,
        h.description,
        h.expense_type,
        h.amount,
        h.due_day,
        h.start_date,
        h.installment_count,
        h.notes,
        h.status,
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
        c.group_color,
        ip.id AS installment_purchase_id
      FROM housing h
      INNER JOIN bank_connections b ON b.id = h.bank_connection_id
      INNER JOIN categories c ON c.id = h.category_id
      LEFT JOIN installment_purchases ip ON ip.housing_id = h.id
      WHERE h.user_id = $1
        AND ($2::INTEGER IS NULL OR h.id = $2)
      ORDER BY h.id DESC
    `,
    [userId, housingId],
  );

  if (!result.rows.length) {
    return [];
  }

  const transactionsResult = await client.query(
    `
      SELECT id, housing_id, amount, occurred_on, installment_number
      FROM transactions
      WHERE user_id = $1
        AND housing_id = ANY($2::INTEGER[])
      ORDER BY housing_id ASC, installment_number ASC NULLS LAST, occurred_on ASC, id ASC
    `,
    [userId, result.rows.map((row) => row.id)],
  );

  const transactionsByHousingId = new Map();

  transactionsResult.rows.forEach((transaction) => {
    const key = String(transaction.housing_id);
    const transactions = transactionsByHousingId.get(key) ?? [];
    transactions.push(transaction);
    transactionsByHousingId.set(key, transactions);
  });

  return result.rows.map((row) => mapHousingRow(row, transactionsByHousingId.get(String(row.id)) ?? []));
}

async function generateHousingTransactions(client, userId, housing) {
  await client.query(
    `
      DELETE FROM transactions
      WHERE user_id = $1
        AND housing_id = $2
    `,
    [userId, housing.id],
  );
  await client.query(
    `
      DELETE FROM installment_purchases
      WHERE user_id = $1
        AND housing_id = $2
    `,
    [userId, housing.id],
  );

  if (housing.status !== "active") {
    return;
  }

  const amount = -Math.abs(Number(housing.amount));

  if (housingFinancingTypes.has(housing.expenseType)) {
    const installmentPurchase = await client.query(
      `
        INSERT INTO installment_purchases (
          user_id,
          bank_connection_id,
          category_id,
          seed_key,
          description_base,
          normalized_description_base,
          purchase_occurred_on,
          installment_count,
          amount_per_installment,
          housing_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        userId,
        housing.bankConnectionId,
        housing.categoryId,
        `housing:${housing.id}`,
        housing.description,
        normalizeDescription(housing.description),
        housing.startDate,
        housing.installmentCount,
        Math.abs(Number(housing.amount)),
        housing.id,
      ],
    );

    for (let installmentNumber = 1; installmentNumber <= housing.installmentCount; installmentNumber += 1) {
      await client.query(
        `
          INSERT INTO transactions (
            user_id,
            bank_connection_id,
            category_id,
            description,
            amount,
            occurred_on,
            seed_key,
            installment_purchase_id,
            installment_number,
            housing_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          userId,
          housing.bankConnectionId,
          housing.categoryId,
          `${housing.description} (${installmentNumber}/${housing.installmentCount})`,
          amount,
          addMonthsToDate(housing.startDate, installmentNumber - 1, housing.dueDay),
          `housing:${housing.id}:installment:${installmentNumber}`,
          installmentPurchase.rows[0].id,
          installmentNumber,
          housing.id,
        ],
      );
    }

    return;
  }

  await client.query(
    `
      INSERT INTO transactions (
        user_id,
        bank_connection_id,
        category_id,
        description,
        amount,
        occurred_on,
        seed_key,
        housing_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,
    [
      userId,
      housing.bankConnectionId,
      housing.categoryId,
      housing.description,
      amount,
      addMonthsToDate(housing.startDate, 0, housing.dueDay),
      `housing:${housing.id}:recurring`,
      housing.id,
    ],
  );
}

export async function listHousing(userId) {
  const resolvedUserId = await requireUserId(userId);
  return getHousingRows(resolvedUserId);
}

export async function createHousing(userId, input) {
  const resolvedUserId = await requireUserId(userId);
  const normalized = validateHousingInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [bankConnection, category] = await Promise.all([
      getBankConnectionById(resolvedUserId, normalized.bankConnectionId, client),
      resolveCategoryForTransactionInput(input.categoryId, -Math.abs(normalized.amount), client),
    ]);

    if (!bankConnection) {
      throw new Error("bank connection not found");
    }

    const result = await client.query(
      `
        INSERT INTO housing (
          user_id,
          bank_connection_id,
          category_id,
          description,
          expense_type,
          amount,
          due_day,
          start_date,
          installment_count,
          notes,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `,
      [
        resolvedUserId,
        normalized.bankConnectionId,
        category.id,
        normalized.description,
        normalized.expenseType,
        normalized.amount,
        normalized.dueDay,
        normalized.startDate,
        normalized.installmentCount,
        normalized.notes,
        normalized.status,
      ],
    );

    await generateHousingTransactions(client, resolvedUserId, {
      id: result.rows[0].id,
      ...normalized,
      categoryId: category.id,
    });

    const [housing] = await getHousingRows(resolvedUserId, result.rows[0].id, client);
    await client.query("COMMIT");
    return housing;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateHousing(userId, housingId, input) {
  const resolvedUserId = await requireUserId(userId);
  const normalized = validateHousingInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [bankConnection, category] = await Promise.all([
      getBankConnectionById(resolvedUserId, normalized.bankConnectionId, client),
      resolveCategoryForTransactionInput(input.categoryId, -Math.abs(normalized.amount), client),
    ]);

    if (!bankConnection) {
      throw new Error("bank connection not found");
    }

    const result = await client.query(
      `
        UPDATE housing
        SET bank_connection_id = $3,
            category_id = $4,
            description = $5,
            expense_type = $6,
            amount = $7,
            due_day = $8,
            start_date = $9,
            installment_count = $10,
            notes = $11,
            status = $12,
            updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
        RETURNING id
      `,
      [
        resolvedUserId,
        housingId,
        normalized.bankConnectionId,
        category.id,
        normalized.description,
        normalized.expenseType,
        normalized.amount,
        normalized.dueDay,
        normalized.startDate,
        normalized.installmentCount,
        normalized.notes,
        normalized.status,
      ],
    );

    if (!result.rowCount) {
      throw new Error("housing expense not found");
    }

    await generateHousingTransactions(client, resolvedUserId, {
      id: housingId,
      ...normalized,
      categoryId: category.id,
    });

    const [housing] = await getHousingRows(resolvedUserId, housingId, client);
    await client.query("COMMIT");
    return housing;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteHousing(userId, housingId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      DELETE FROM housing
      WHERE user_id = $1
        AND id = $2
    `,
    [resolvedUserId, housingId],
  );

  if (!result.rowCount) {
    throw new Error("housing expense not found");
  }
}

function mapInvestmentRow(row) {
  const currentAmount = parseNumeric(row.current_amount);
  const targetAmount = row.target_amount === null || row.target_amount === undefined ? null : parseNumeric(row.target_amount);
  const fixedAmount = row.fixed_amount === null || row.fixed_amount === undefined ? null : parseNumeric(row.fixed_amount);
  const incomePercentage =
    row.income_percentage === null || row.income_percentage === undefined ? null : parseNumeric(row.income_percentage);

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    contributionMode: row.contribution_mode,
    fixedAmount,
    incomePercentage,
    currentAmount,
    formattedCurrentAmount: formatCurrency(currentAmount),
    targetAmount,
    formattedTargetAmount: targetAmount === null ? null : formatCurrency(targetAmount),
    status: investmentStatuses.has(row.status) ? row.status : "active",
    color: row.color ?? null,
    notes: row.notes ?? "",
    bank:
      row.bank_connection_id === null || row.bank_connection_id === undefined
        ? null
        : {
            id: row.bank_connection_id,
            slug: row.bank_slug,
            name: row.bank_name,
            accountType: row.bank_account_type,
            color: row.bank_color,
          },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function validateInvestmentInput(input = {}, options = {}) {
  const name = String(input.name ?? "").replace(/\s+/g, " ").trim();
  const description = String(input.description ?? "").trim();
  const contributionMode = String(input.contributionMode ?? input.contribution_mode ?? "").trim();
  const fixedAmountValue = input.fixedAmount ?? input.fixed_amount;
  const incomePercentageValue = input.incomePercentage ?? input.income_percentage;
  const currentAmountValue = input.currentAmount ?? input.current_amount;
  const targetAmountValue = input.targetAmount ?? input.target_amount;
  const bankConnectionValue = input.bankConnectionId ?? input.bank_connection_id;
  const status = String(input.status ?? "active").trim();
  const color = String(input.color ?? "").trim() || null;
  const notes = String(input.notes ?? "").trim();
  const fixedAmount =
    fixedAmountValue === undefined || fixedAmountValue === null || fixedAmountValue === "" ? null : Number(fixedAmountValue);
  const incomePercentage =
    incomePercentageValue === undefined || incomePercentageValue === null || incomePercentageValue === ""
      ? null
      : Number(incomePercentageValue);
  const currentAmount =
    currentAmountValue === undefined || currentAmountValue === null || currentAmountValue === "" ? 0 : Number(currentAmountValue);
  const targetAmount =
    targetAmountValue === undefined || targetAmountValue === null || targetAmountValue === "" ? null : Number(targetAmountValue);
  const bankConnectionId =
    bankConnectionValue === undefined || bankConnectionValue === null || bankConnectionValue === "" ? null : Number(bankConnectionValue);

  if (!name) {
    throw new Error("investment name is required");
  }

  if (!investmentContributionModes.has(contributionMode)) {
    throw new Error("valid contributionMode is required");
  }

  if (contributionMode === "fixed_amount") {
    if (!Number.isFinite(fixedAmount) || fixedAmount < 0) {
      throw new Error("fixedAmount must be zero or greater");
    }
  }

  if (contributionMode === "income_percentage") {
    if (!Number.isFinite(incomePercentage) || incomePercentage < 0 || incomePercentage > 100) {
      throw new Error("incomePercentage must be between 0 and 100");
    }
  }

  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    throw new Error("currentAmount must be zero or greater");
  }

  if (targetAmount !== null && (!Number.isFinite(targetAmount) || targetAmount < 0)) {
    throw new Error("targetAmount must be zero or greater");
  }

  if (bankConnectionId !== null && !Number.isInteger(bankConnectionId)) {
    throw new Error("bankConnectionId must be a valid integer");
  }

  if (!investmentStatuses.has(status)) {
    throw new Error("valid investment status is required");
  }

  return {
    name,
    description,
    contributionMode,
    fixedAmount: contributionMode === "fixed_amount" ? Number(fixedAmount.toFixed(2)) : null,
    incomePercentage: contributionMode === "income_percentage" ? Number(incomePercentage.toFixed(2)) : null,
    currentAmount: Number(currentAmount.toFixed(2)),
    targetAmount: targetAmount === null ? null : Number(targetAmount.toFixed(2)),
    status,
    color,
    notes,
    bankConnectionId,
  };
}

async function getInvestmentRows(userId, investmentId = null, client = pool) {
  const result = await client.query(
    `
      SELECT
        i.id,
        i.name,
        i.description,
        i.contribution_mode,
        i.fixed_amount,
        i.income_percentage,
        i.current_amount,
        i.target_amount,
        i.status,
        i.color,
        i.notes,
        i.created_at,
        i.updated_at,
        b.id AS bank_connection_id,
        b.slug AS bank_slug,
        b.name AS bank_name,
        b.account_type AS bank_account_type,
        b.color AS bank_color
      FROM investments i
      LEFT JOIN bank_connections b ON b.id = i.bank_connection_id
      WHERE i.user_id = $1
        AND ($2::INTEGER IS NULL OR i.id = $2)
      ORDER BY i.updated_at DESC, i.id DESC
    `,
    [userId, investmentId],
  );

  return result.rows.map(mapInvestmentRow);
}

async function getInvestmentRowById(userId, investmentId, client = pool) {
  const result = await client.query(
    `
      SELECT id, user_id, current_amount
      FROM investments
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, investmentId],
  );

  return result.rows[0] ?? null;
}

export async function listInvestments(userId) {
  const resolvedUserId = await requireUserId(userId);
  return getInvestmentRows(resolvedUserId);
}

export async function createInvestment(userId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const normalized = validateInvestmentInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    if (normalized.bankConnectionId !== null) {
      const bankConnection = await getBankConnectionById(resolvedUserId, normalized.bankConnectionId, client);

      if (!bankConnection) {
        throw new Error("bank connection not found");
      }
    }

    const result = await client.query(
      `
        INSERT INTO investments (
          user_id,
          bank_connection_id,
          name,
          description,
          contribution_mode,
          fixed_amount,
          income_percentage,
          current_amount,
          target_amount,
          status,
          color,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING id
      `,
      [
        resolvedUserId,
        normalized.bankConnectionId,
        normalized.name,
        normalized.description,
        normalized.contributionMode,
        normalized.fixedAmount,
        normalized.incomePercentage,
        normalized.currentAmount,
        normalized.targetAmount,
        normalized.status,
        normalized.color,
        normalized.notes,
      ],
    );

    const [investment] = await getInvestmentRows(resolvedUserId, result.rows[0].id, client);
    await client.query("COMMIT");
    return investment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateInvestment(userId, investmentId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const normalized = validateInvestmentInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await getInvestmentRowById(resolvedUserId, investmentId, client);

    if (!existing) {
      throw new Error("investment not found");
    }

    if (normalized.bankConnectionId !== null) {
      const bankConnection = await getBankConnectionById(resolvedUserId, normalized.bankConnectionId, client);

      if (!bankConnection) {
        throw new Error("bank connection not found");
      }
    }

    await client.query(
      `
        UPDATE investments
        SET bank_connection_id = $3,
            name = $4,
            description = $5,
            contribution_mode = $6,
            fixed_amount = $7,
            income_percentage = $8,
            current_amount = $9,
            target_amount = $10,
            status = $11,
            color = $12,
            notes = $13,
            updated_at = NOW()
        WHERE user_id = $1
          AND id = $2
      `,
      [
        resolvedUserId,
        investmentId,
        normalized.bankConnectionId,
        normalized.name,
        normalized.description,
        normalized.contributionMode,
        normalized.fixedAmount,
        normalized.incomePercentage,
        normalized.currentAmount,
        normalized.targetAmount,
        normalized.status,
        normalized.color,
        normalized.notes,
      ],
    );

    const [investment] = await getInvestmentRows(resolvedUserId, investmentId, client);
    await client.query("COMMIT");
    return investment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteInvestment(userId, investmentId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      DELETE FROM investments
      WHERE user_id = $1
        AND id = $2
    `,
    [resolvedUserId, investmentId],
  );

  if (!result.rowCount) {
    throw new Error("investment not found");
  }
}

export async function listCategories() {
  await initializeDatabase();
  const result = await pool.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system
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
      INSERT INTO categories (slug, label, transaction_type, icon, color, group_slug, group_label, group_color, sort_order, is_system)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, FALSE)
      RETURNING id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system
    `,
    [slug, label, transactionType, icon, color, groupSlug, groupLabel, groupColor, sortOrderResult.rows[0].next_sort_order],
  );

  return mapCategoryRow(result.rows[0]);
}

export async function updateCategory(categoryId, input) {
  const label = String(input.label ?? "").trim();
  const icon = String(input.icon ?? "").trim();
  const color = String(input.color ?? "").trim();
  const groupLabel = String(input.groupLabel ?? "").trim();
  const groupColor = String(input.groupColor ?? "").trim();

  if (!label || !icon || !color || !groupLabel || !groupColor) {
    throw new Error("label, icon, color, groupLabel and groupColor are required");
  }

  const groupSlug = slugify(groupLabel);

  if (!groupSlug) {
    throw new Error("invalid category label");
  }

  const existing = await getCategoryById(categoryId);

  if (!existing) {
    throw new Error("category not found");
  }

  const result = await pool.query(
    `
      UPDATE categories
      SET label = $2,
          icon = $3,
          color = $4,
          group_slug = $5,
          group_label = $6,
          group_color = $7
      WHERE id = $1
      RETURNING id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system
    `,
    [categoryId, label, icon, color, groupSlug, groupLabel, groupColor],
  );

  return mapCategoryRow(result.rows[0]);
}

async function getCategoryById(categoryId, client = pool) {
  const result = await client.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system
      FROM categories
      WHERE id = $1
      LIMIT 1
    `,
    [categoryId],
  );

  return result.rows[0] ?? null;
}

async function getCategoryBySlugAndType(slug, transactionType, client = pool) {
  const result = await client.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system
      FROM categories
      WHERE slug = $1
        AND transaction_type = $2
      LIMIT 1
    `,
    [slug, transactionType],
  );

  return result.rows[0] ?? null;
}

async function getDefaultExpenseCategory(client = pool) {
  return getCategoryBySlugAndType("outros-despesas", "expense", client);
}

async function getFallbackCategoryForDeletion(category, client = pool) {
  if (category.transaction_type === "income") {
    return getCategoryBySlugAndType("salario", "income", client);
  }

  return getDefaultExpenseCategory(client);
}

export async function deleteCategory(categoryId) {
  await initializeDatabase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const category = await getCategoryById(categoryId, client);

    if (!category) {
      throw new Error("category not found");
    }

    if (category.is_system) {
      throw new Error("system categories cannot be deleted");
    }

    const fallbackCategory = await getFallbackCategoryForDeletion(category, client);

    if (!fallbackCategory) {
      throw new Error("fallback category not found");
    }

    await client.query(`UPDATE transactions SET category_id = $2 WHERE category_id = $1`, [categoryId, fallbackCategory.id]);
    await client.query(`UPDATE housing SET category_id = $2 WHERE category_id = $1`, [categoryId, fallbackCategory.id]);
    await client.query(`UPDATE installment_purchases SET category_id = $2 WHERE category_id = $1`, [categoryId, fallbackCategory.id]);
    await client.query(`UPDATE transaction_categorization_rules SET category_id = $2 WHERE category_id = $1`, [categoryId, fallbackCategory.id]);
    await client.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveCategoryForTransactionInput(rawCategoryId, amount, client = pool) {
  const transactionType = getTransactionTypeFromAmount(amount);
  const categoryId = rawCategoryId === undefined || rawCategoryId === null || rawCategoryId === "" ? null : Number(rawCategoryId);

  if (categoryId === null) {
    if (transactionType === "income") {
      throw new Error("categoryId is required for income transactions");
    }

    const defaultExpenseCategory = await getDefaultExpenseCategory(client);

    if (!defaultExpenseCategory) {
      throw new Error("default expense category not found");
    }

    return defaultExpenseCategory;
  }

  if (!Number.isInteger(categoryId)) {
    throw new Error("category not found");
  }

  const category = await getCategoryById(categoryId);

  if (!category) {
    throw new Error("category not found");
  }

  if (category.transaction_type !== transactionType) {
    throw new Error("category does not match transaction type");
  }

  return category;
}

async function getBankConnectionById(userId, bankConnectionId, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        slug,
        name,
        account_type,
        connected,
        color,
        current_balance,
        credit_limit,
        parent_bank_connection_id,
        statement_close_day,
        statement_due_day
      FROM bank_connections
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, bankConnectionId],
  );

  return result.rows[0] ?? null;
}

async function getNextBankSortOrder(userId, client = pool) {
  const result = await client.query(
    `
      SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort_order
      FROM bank_connections
      WHERE user_id = $1
    `,
    [userId],
  );

  return Number(result.rows[0]?.next_sort_order ?? 10);
}

async function hasChildBankConnections(userId, bankConnectionId, client = pool) {
  const result = await client.query(
    `
      SELECT 1
      FROM bank_connections
      WHERE user_id = $1
        AND parent_bank_connection_id = $2
      LIMIT 1
    `,
    [userId, bankConnectionId],
  );

  return result.rowCount > 0;
}

async function countCashBankConnections(userId, client = pool) {
  const result = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM bank_connections
      WHERE user_id = $1
        AND account_type = 'cash'
    `,
    [userId],
  );

  return Number(result.rows[0]?.total ?? 0);
}

async function hasTransactionsForBankConnection(userId, bankConnectionId, client = pool) {
  const result = await client.query(
    `
      SELECT 1
      FROM transactions
      WHERE user_id = $1
        AND bank_connection_id = $2
      LIMIT 1
    `,
    [userId, bankConnectionId],
  );

  return result.rowCount > 0;
}

async function buildUniqueBankSlug(userId, name, client = pool) {
  const slugBase = slugify(name);

  if (!slugBase) {
    throw new Error("invalid bank connection name");
  }

  const result = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM bank_connections
      WHERE user_id = $1
        AND (slug = $2 OR slug LIKE $3)
    `,
    [userId, slugBase, `${slugBase}-%`],
  );

  const total = Number(result.rows[0]?.total ?? 0);
  return total === 0 ? slugBase : `${slugBase}-${total + 1}`;
}

function parseOptionalInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function validateStatementDay(value, fieldName) {
  if (value === null) {
    return null;
  }

  if (!Number.isInteger(value) || value < 1 || value > 31) {
    throw new Error(`${fieldName} must be between 1 and 31`);
  }

  return value;
}

async function validateBankConnectionInput(userId, input, currentId = null) {
  const name = String(input.name ?? "").trim();
  const accountType =
    input.accountType === "credit_card"
      ? "credit_card"
      : input.accountType === "cash"
        ? "cash"
        : input.accountType === "bank_account"
          ? "bank_account"
          : null;
  const color = String(input.color ?? "").trim() || "bg-secondary";
  const connected = input.connected === false ? false : true;
  const currentBalance = Number(input.currentBalance ?? 0);
  const rawCreditLimit = input.creditLimit;
  const creditLimit =
    rawCreditLimit === undefined || rawCreditLimit === null || rawCreditLimit === "" ? null : Number(rawCreditLimit);
  const parentBankConnectionId = parseOptionalInteger(input.parentBankConnectionId);
  const statementCloseDay = validateStatementDay(parseOptionalInteger(input.statementCloseDay), "statementCloseDay");
  const statementDueDay = validateStatementDay(parseOptionalInteger(input.statementDueDay), "statementDueDay");

  if (!name || !accountType || !Number.isFinite(currentBalance)) {
    throw new Error("name, accountType and currentBalance are required");
  }

  if (accountType === "credit_card") {
    if (!Number.isFinite(creditLimit) || Number(creditLimit) < 0) {
      throw new Error("creditLimit is required for credit cards");
    }

    if (!Number.isInteger(parentBankConnectionId)) {
      throw new Error("parentBankConnectionId is required for credit cards");
    }

    if (statementCloseDay === null || statementDueDay === null) {
      throw new Error("statementCloseDay and statementDueDay are required for credit cards");
    }

    const parentBankConnection = await getBankConnectionById(userId, parentBankConnectionId);

    if (!parentBankConnection) {
      throw new Error("parent bank connection not found");
    }

    if (parentBankConnection.account_type !== "bank_account") {
      throw new Error("credit cards must be linked to a bank account");
    }

    if (currentId !== null && Number(parentBankConnectionId) === Number(currentId)) {
      throw new Error("a credit card cannot be linked to itself");
    }
  } else {
    if (creditLimit !== null) {
      throw new Error("creditLimit is allowed only for credit cards");
    }

    if (parentBankConnectionId !== null) {
      throw new Error("parentBankConnectionId is allowed only for credit cards");
    }

    if (statementCloseDay !== null || statementDueDay !== null) {
      throw new Error("statement days are allowed only for credit cards");
    }
  }

  return {
    name,
    accountType,
    color,
    connected,
    currentBalance,
    creditLimit,
    parentBankConnectionId,
    statementCloseDay,
    statementDueDay,
  };
}

async function listTransactionFingerprintRows(userId) {
  const result = await pool.query(
    `
      SELECT occurred_on, amount, description, seed_key
      FROM transactions
      WHERE user_id = $1
    `,
    [userId],
  );

  return result.rows;
}

export async function listHistoricalCategorizationRows(userId) {
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

export async function listRecurringCategorizationRules(userId) {
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

export async function upsertTransactionCategorizationRule({ categoryId, matchKey, type, userId }, client = pool) {
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

async function findInstallmentPurchaseBySeedKey(userId, seedKey, client = pool) {
  const result = await client.query(
    `
      SELECT id, installment_count, purchase_occurred_on
      FROM installment_purchases
      WHERE user_id = $1
        AND seed_key = $2
      LIMIT 1
    `,
    [userId, seedKey],
  );

  return result.rows[0] ?? null;
}

async function createInstallmentPurchase(
  {
    userId,
    bankConnectionId,
    categoryId,
    seedKey,
    descriptionBase,
    normalizedDescriptionBase,
    purchaseOccurredOn,
    installmentCount,
    amountPerInstallment,
  },
  client = pool,
) {
  const result = await client.query(
    `
      INSERT INTO installment_purchases (
        user_id,
        bank_connection_id,
        category_id,
        seed_key,
        description_base,
        normalized_description_base,
        purchase_occurred_on,
        installment_count,
        amount_per_installment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, seed_key) DO UPDATE
      SET category_id = EXCLUDED.category_id,
          updated_at = NOW()
      RETURNING id, installment_count, purchase_occurred_on
    `,
    [
      userId,
      bankConnectionId,
      categoryId,
      seedKey,
      descriptionBase,
      normalizedDescriptionBase,
      purchaseOccurredOn,
      installmentCount,
      Math.abs(Number(amountPerInstallment)),
    ],
  );

  return result.rows[0];
}

async function getOrCreateInstallmentPurchase(input, client = pool) {
  const existing = await findInstallmentPurchaseBySeedKey(input.userId, input.seedKey, client);

  if (existing) {
    return existing;
  }

  return createInstallmentPurchase(input, client);
}

async function createImportedTransaction(
  { userId, bankConnectionId, categoryId, description, amount, occurredOn, seedKey, installmentPurchaseId = null, installmentNumber = null },
  client = pool,
) {
  const result = await client.query(
    `
      INSERT INTO transactions (
        user_id,
        bank_connection_id,
        category_id,
        description,
        amount,
        occurred_on,
        seed_key,
        installment_purchase_id,
        installment_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, seed_key) DO NOTHING
      RETURNING id
    `,
    [userId, bankConnectionId, categoryId, description, amount, occurredOn, seedKey, installmentPurchaseId, installmentNumber],
  );

  if (!result.rowCount) {
    return null;
  }

  const row = await getTransactionById(userId, result.rows[0].id, client);
  return mapTransactionRow(row, occurredOn);
}

function formatImportEntryCount(count, singularLabel, pluralLabel = `${singularLabel}s`) {
  return `${count} ${count === 1 ? singularLabel : pluralLabel}`;
}

async function getTransactionById(userId, transactionId, client = pool) {
  const result = await client.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        t.housing_id,
        t.installment_purchase_id,
        t.installment_number,
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
        c.group_color,
        t.is_recurring,
        t.recurrence_ends_on,
        ip.installment_count,
        ip.purchase_occurred_on
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      WHERE t.user_id = $1
        AND t.id = $2
      LIMIT 1
    `,
    [userId, transactionId],
  );

  return result.rows[0] ?? null;
}

export async function createTransaction(userId, input) {
  const resolvedUserId = await requireUserId(userId);
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const bankConnectionId = Number(input.bankConnectionId);
  const isRecurring = Boolean(input.isRecurring) && amount > 0;

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn and bankConnectionId are required");
  }

  const category = await resolveCategoryForTransactionInput(input.categoryId, amount);

  const bankConnection = await getBankConnectionById(resolvedUserId, bankConnectionId);

  if (!bankConnection) {
    throw new Error("bank connection not found");
  }

  if (amount > 0 && bankConnection.account_type === "credit_card") {
    throw new Error("income transactions cannot use credit cards");
  }

  const result = await pool.query(
    `
      INSERT INTO transactions (user_id, bank_connection_id, category_id, description, amount, occurred_on, is_recurring)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [resolvedUserId, bankConnectionId, category.id, description, amount, occurredOn, isRecurring],
  );

  const row = await getTransactionById(resolvedUserId, result.rows[0].id);
  const transaction = mapTransactionRow(row, occurredOn);
  await reevaluateAffectedPlansForTransactions(resolvedUserId, [transaction], "transaction_created");
  return transaction;
}

async function createRecurringTransactionSeries(
  { userId, bankConnectionId, categoryId, description, amount, occurredOn, isRecurring },
  client = pool,
) {
  const result = await client.query(
    `
      INSERT INTO transactions (user_id, bank_connection_id, category_id, description, amount, occurred_on, is_recurring)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [userId, bankConnectionId, categoryId, description, amount, occurredOn, isRecurring],
  );

  return result.rows[0]?.id ?? null;
}

export async function updateTransaction(userId, transactionId, input) {
  const resolvedUserId = await requireUserId(userId);
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const bankConnectionId = Number(input.bankConnectionId);
  const isRecurring = Boolean(input.isRecurring) && amount > 0;

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn and bankConnectionId are required");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingTransaction = await getTransactionById(resolvedUserId, transactionId, client);

    if (!existingTransaction) {
      throw new Error("transaction not found");
    }

    const category = await resolveCategoryForTransactionInput(input.categoryId, amount, client);
    const bankConnection = await getBankConnectionById(resolvedUserId, bankConnectionId, client);

    if (!bankConnection) {
      throw new Error("bank connection not found");
    }

    if (amount > 0 && bankConnection.account_type === "credit_card") {
      throw new Error("income transactions cannot use credit cards");
    }

    const syncPlan = buildTransactionCategorySyncPlan(existingTransaction, category.id);

    if (syncPlan.syncInstallmentPurchase) {
      await client.query(
        `
          UPDATE transactions
          SET category_id = $3
          WHERE user_id = $1
            AND installment_purchase_id = $2
        `,
        [resolvedUserId, syncPlan.installmentPurchaseId, category.id],
      );

      await client.query(
        `
          UPDATE installment_purchases
          SET category_id = $3,
              updated_at = NOW()
          WHERE user_id = $1
            AND id = $2
        `,
        [resolvedUserId, syncPlan.installmentPurchaseId, category.id],
      );
    }

    if (
      shouldSplitRecurringTransaction({
        existingOccurredOn: existingTransaction.occurred_on,
        nextOccurredOn: occurredOn,
        existingIsRecurring: existingTransaction.is_recurring,
        nextIsRecurring: isRecurring,
        nextAmount: amount,
      })
    ) {
      await client.query(
        `
          UPDATE transactions
          SET recurrence_ends_on = $3
          WHERE user_id = $1
            AND id = $2
        `,
        [resolvedUserId, transactionId, buildPreviousMonthEndDate(occurredOn)],
      );

      const nextTransactionId = await createRecurringTransactionSeries(
        {
          userId: resolvedUserId,
          bankConnectionId,
          categoryId: category.id,
          description,
          amount,
          occurredOn,
          isRecurring,
        },
        client,
      );

      if (!nextTransactionId) {
        throw new Error("transaction not found");
      }

      const row = await getTransactionById(resolvedUserId, nextTransactionId, client);
      await client.query("COMMIT");
      const transaction = mapTransactionRow(row, occurredOn);
      await reevaluateAffectedPlansForTransactions(
        resolvedUserId,
        [mapTransactionRow(existingTransaction), transaction],
        "transaction_updated",
      );
      return transaction;
    }

    const result = await client.query(
      `
        UPDATE transactions
        SET bank_connection_id = $3,
            category_id = $4,
            description = $5,
            amount = $6,
            occurred_on = $7,
            is_recurring = $8,
            recurrence_ends_on = NULL
        WHERE user_id = $1
          AND id = $2
        RETURNING id
      `,
      [resolvedUserId, transactionId, bankConnectionId, category.id, description, amount, occurredOn, isRecurring],
    );

    if (!result.rowCount) {
      throw new Error("transaction not found");
    }

    const row = await getTransactionById(resolvedUserId, transactionId, client);
    await client.query("COMMIT");
    const transaction = mapTransactionRow(row, occurredOn);
    await reevaluateAffectedPlansForTransactions(
      resolvedUserId,
      [mapTransactionRow(existingTransaction), transaction],
      "transaction_updated",
    );
    return transaction;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteTransaction(userId, transactionId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const effectiveOccurredOn = normalizeDateValue(input.occurredOn);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingTransaction = await getTransactionById(resolvedUserId, transactionId, client);

    if (!existingTransaction) {
      throw new Error("transaction not found");
    }

    if (
      shouldTruncateRecurringTransaction({
        existingOccurredOn: existingTransaction.occurred_on,
        effectiveOccurredOn,
        existingIsRecurring: existingTransaction.is_recurring,
      })
    ) {
      await client.query(
        `
          UPDATE transactions
          SET recurrence_ends_on = $3
          WHERE user_id = $1
            AND id = $2
        `,
        [resolvedUserId, transactionId, buildPreviousMonthEndDate(effectiveOccurredOn)],
      );

      await client.query("COMMIT");
      await reevaluateAffectedPlansForTransactions(resolvedUserId, [mapTransactionRow(existingTransaction)], "transaction_deleted");
      return;
    }

    const result = await client.query(
      `
        DELETE FROM transactions
        WHERE user_id = $1
          AND id = $2
      `,
      [resolvedUserId, transactionId],
    );

    if (!result.rowCount) {
      throw new Error("transaction not found");
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function previewTransactionImport(userId, fileBuffer, importSource = "bank_statement", bankConnectionId, filename, contentType, filePassword) {
  const resolvedUserId = await requireUserId(userId);
  const parsedBankConnectionId = Number(bankConnectionId);

  if (!Number.isInteger(parsedBankConnectionId)) {
    throw new Error("bankConnectionId is required");
  }

  const bankConnection = await getBankConnectionById(resolvedUserId, parsedBankConnectionId);

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
    listTransactionFingerprintRows(resolvedUserId),
    listHistoricalCategorizationRows(resolvedUserId),
    listRecurringCategorizationRules(resolvedUserId),
  ]);

  const existingFingerprints = new Set(
    fingerprintRows.map((row) =>
      String(
        row.seed_key ??
          buildImportSeedKey(resolvedUserId, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
      ),
    ),
  );

  return await createImportPreview({
    categories,
    existingFingerprints,
    bankConnectionId: parsedBankConnectionId,
    bankConnectionName: bankConnection.name,
    contentType,
    fileBuffer,
    filePassword,
    filename,
    historicalRows,
    importSource,
    recurringRules,
    userId: resolvedUserId,
  });
}

export async function getTransactionImportAiSuggestions(userId, input) {
  const resolvedUserId = await requireUserId(userId);
  const session = getPreviewSession(input.previewToken, resolvedUserId);
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

export async function commitTransactionImport(userId, input) {
  const resolvedUserId = await requireUserId(userId);
  const session = getPreviewSession(input.previewToken, resolvedUserId);
  validateCommitItemsShape(input.items, session);
  const sessionItemsByRowIndex = new Map(session.items.map((item) => [item.rowIndex, item.original]));

  const [categories, fingerprintRows] = await Promise.all([listCategories(), listTransactionFingerprintRows(resolvedUserId)]);
  const existingFingerprints = new Set(
    fingerprintRows.map((row) =>
      String(
        row.seed_key ??
          buildImportSeedKey(resolvedUserId, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
      ),
    ),
  );
  const commitFingerprints = new Set(existingFingerprints);
  const results = [];
  let importedCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const allImportedTransactions = [];

  for (const item of input.items) {
    try {
      const normalized = validateCommitLine(item, categories);
      const previewItem = sessionItemsByRowIndex.get(item.rowIndex) ?? null;
      const entriesToImport = buildImportedTransactionEntries({
        normalizedLine: normalized,
        previewItem,
      });
      const entryLabelSingular = previewItem?.isInstallment ? "parcela" : "transacao";
      const entryLabelPlural = previewItem?.isInstallment ? "parcelas" : "transacoes";

      if (normalized.exclude) {
        skippedCount += entriesToImport.length;
        results.push({
          rowIndex: item.rowIndex,
          status: "skipped",
          reason: "excluded",
          message: `${formatImportEntryCount(entriesToImport.length, entryLabelSingular, entryLabelPlural)} removida${
            entriesToImport.length === 1 ? "" : "s"
          } pelo usuario.`,
        });
        continue;
      }

      const isInstallmentEntry =
        Boolean(previewItem?.isInstallment) &&
        Boolean(previewItem?.purchaseOccurredOn) &&
        Boolean(previewItem?.normalizedPurchaseDescriptionBase) &&
        Number.isInteger(previewItem?.installmentCount);

      const installmentPurchaseSeedKey = isInstallmentEntry
        ? buildInstallmentPurchaseSeedKey(
            resolvedUserId,
            session.bankConnectionId,
            previewItem.purchaseOccurredOn,
            previewItem.normalizedPurchaseDescriptionBase,
            Math.abs(normalized.signedAmount),
            Number(previewItem.installmentCount),
          )
        : null;
      const importedTransactions = [];
      let duplicateEntries = 0;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        let installmentPurchase = null;

        if (installmentPurchaseSeedKey) {
          installmentPurchase = await getOrCreateInstallmentPurchase(
            {
              userId: resolvedUserId,
              bankConnectionId: session.bankConnectionId,
              categoryId: normalized.categoryId,
              seedKey: installmentPurchaseSeedKey,
              descriptionBase: previewItem.purchaseDescriptionBase,
              normalizedDescriptionBase: previewItem.normalizedPurchaseDescriptionBase,
              purchaseOccurredOn: previewItem.purchaseOccurredOn,
              installmentCount: Number(previewItem.installmentCount),
              amountPerInstallment: Math.abs(normalized.signedAmount),
            },
            client,
          );
        }

        for (const entry of entriesToImport) {
          const seedKey =
            installmentPurchaseSeedKey && Number.isInteger(entry.installmentNumber)
              ? buildInstallmentTransactionSeedKey(resolvedUserId, installmentPurchaseSeedKey, entry.installmentNumber)
              : buildImportSeedKey(
                  resolvedUserId,
                  entry.occurredOn,
                  entry.amount,
                  normalized.normalizedFinalDescription,
                );

          if (commitFingerprints.has(seedKey) && !normalized.ignoreDuplicate) {
            duplicateEntries += 1;
            continue;
          }

          const transaction = await createImportedTransaction(
            {
              userId: resolvedUserId,
              bankConnectionId: session.bankConnectionId,
              categoryId: entry.categoryId,
              description: entry.description,
              amount: entry.amount,
              occurredOn: entry.occurredOn,
              seedKey,
              installmentPurchaseId: installmentPurchase?.id ?? null,
              installmentNumber: entry.installmentNumber,
            },
            client,
          );

          commitFingerprints.add(seedKey);

          if (!transaction) {
            duplicateEntries += 1;
            continue;
          }

          importedTransactions.push(transaction);
        }

        if (importedTransactions.length > 0) {
          await upsertTransactionCategorizationRule({
            userId: resolvedUserId,
            matchKey: extractCategorizationMatchKey(normalized.description),
            type: normalized.type,
            categoryId: normalized.categoryId,
          }, client);
        }

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      if (!importedTransactions.length) {
        skippedCount += duplicateEntries;
        results.push({
          rowIndex: item.rowIndex,
          status: "skipped",
          reason: "duplicate",
          message:
            duplicateEntries > 0
              ? `${formatImportEntryCount(duplicateEntries, entryLabelSingular, entryLabelPlural)} pulada${
                  duplicateEntries === 1 ? "" : "s"
                } por duplicata provavel.`
              : "Linha ja importada anteriormente.",
        });
        continue;
      }

      importedCount += importedTransactions.length;
      allImportedTransactions.push(...importedTransactions);
      skippedCount += duplicateEntries;
      results.push({
        rowIndex: item.rowIndex,
        status: "imported",
        reason: duplicateEntries > 0 ? "partial_success" : "success",
        message:
          duplicateEntries > 0
            ? `${formatImportEntryCount(importedTransactions.length, entryLabelSingular, entryLabelPlural)} importada${
                importedTransactions.length === 1 ? "" : "s"
              } e ${formatImportEntryCount(duplicateEntries, entryLabelSingular, entryLabelPlural)} ignorada${
                duplicateEntries === 1 ? "" : "s"
              } por duplicata.`
            : `${formatImportEntryCount(importedTransactions.length, entryLabelSingular, entryLabelPlural)} importada${
                importedTransactions.length === 1 ? "" : "s"
              } com sucesso.`,
        transaction: importedTransactions[0],
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

  await reevaluateAffectedPlansForTransactions(resolvedUserId, allImportedTransactions, "transaction_imported");

  return {
    importedCount,
    skippedCount,
    failedCount,
    results,
  };
}

export async function listSpendingByCategory(userId, filters = {}) {
  const resolvedUserId = await requireUserId(userId);
  const normalizedFilters = normalizeDashboardFilters(filters);

  if (normalizedFilters.active) {
    const totalsResult = await pool.query(
      `
        SELECT
          c.group_slug,
          c.group_label,
          c.group_color,
          ABS(SUM(t.amount))::NUMERIC(12, 2) AS total
        FROM transactions t
        INNER JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = $1
          AND t.amount < 0
          AND t.occurred_on BETWEEN $2 AND $3
        GROUP BY c.group_slug, c.group_label, c.group_color
        ORDER BY total DESC, c.group_label ASC
      `,
      [resolvedUserId, normalizedFilters.startDate, normalizedFilters.endDate],
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
    [resolvedUserId],
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

export async function listInsights(userId) {
  await requireUserId(userId);
  return [];
}

function normalizePlanStatus(value) {
  return value === "done" ? "done" : "todo";
}

function normalizePlanPriority(value) {
  if (value === "high" || value === "low") {
    return value;
  }

  return "medium";
}

function normalizePlanItems(items = []) {
  if (!Array.isArray(items)) {
    throw new Error("invalid plan items");
  }

  return items
    .map((item, index) => ({
      title: String(item?.title ?? "").replace(/\s+/g, " ").trim(),
      description: String(item?.description ?? "").trim(),
      status: normalizePlanStatus(item?.status),
      priority: normalizePlanPriority(item?.priority),
      sortOrder: Number.isFinite(Number(item?.sortOrder)) ? Number(item.sortOrder) : index,
    }))
    .filter((item) => item.title);
}

function normalizePlanGoalType(value) {
  return value === "transaction_sum" ? "transaction_sum" : "items";
}

function normalizePlanGoalSource(value, fallback = "manual") {
  if (value === "ai") {
    return "ai";
  }

  return fallback === "ai" ? "ai" : "manual";
}

function normalizePlanTransactionType(value) {
  return value === "income" ? "income" : "expense";
}

function normalizePlanGoalTargetModel(value) {
  return value === "investment_box" ? "investment_box" : "category";
}

function normalizePlanGoalDate(value) {
  const normalized = normalizeDateValue(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

function normalizePlanGoalCategoryIds(categoryIds) {
  if (!Array.isArray(categoryIds)) {
    return [];
  }

  const ids = categoryIds
    .map((categoryId) => Number(categoryId))
    .filter((categoryId) => Number.isInteger(categoryId) && categoryId > 0);

  return Array.from(new Set(ids));
}

function parsePlanGoalAmount(value) {
  if (typeof value === "number") {
    return value;
  }

  const text = String(value ?? "").trim();
  return Number(text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text);
}

function buildDefaultPlanGoal(source = "manual") {
  return {
    type: "items",
    source: normalizePlanGoalSource(source),
    targetAmount: null,
    transactionType: "expense",
    targetModel: "category",
    categoryIds: [],
    investmentBoxId: null,
    investmentBox: null,
    investmentBoxIds: [],
    investmentBoxes: [],
    startDate: null,
    endDate: null,
  };
}

function normalizePlanGoalInvestmentIds(goal = {}) {
  const rawIds = [
    ...(Array.isArray(goal?.investmentBoxIds) ? goal.investmentBoxIds : []),
    ...(Array.isArray(goal?.investment_box_ids) ? goal.investment_box_ids : []),
    goal?.investmentBoxId ?? goal?.investment_box_id,
  ];

  const ids = rawIds
    .filter((value) => value !== undefined && value !== null && value !== "")
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  return Array.from(new Set(ids));
}

function normalizePlanGoalInvestmentBoxes(goal = {}) {
  const rawBoxes = [
    ...(Array.isArray(goal?.investmentBoxes) ? goal.investmentBoxes : []),
    ...(Array.isArray(goal?.investment_boxes) ? goal.investment_boxes : []),
    goal?.investmentBox ?? goal?.investment_box,
  ].filter((value) => value && typeof value === "object");

  return rawBoxes.map((value) => validateInvestmentInput(value)).filter(Boolean);
}

function normalizePlanGoal(goal = {}, options = {}) {
  const source = normalizePlanGoalSource(goal?.source, options.source);
  const type = normalizePlanGoalType(goal?.type);

  if (type !== "transaction_sum") {
    return buildDefaultPlanGoal(source);
  }

  const targetAmount = parsePlanGoalAmount(goal?.targetAmount ?? goal?.target_amount);
  const startDate = normalizePlanGoalDate(goal?.startDate ?? goal?.start_date);
  const endDate = normalizePlanGoalDate(goal?.endDate ?? goal?.end_date);
  const targetModel = normalizePlanGoalTargetModel(goal?.targetModel ?? goal?.target_model);

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    throw new Error("goal target amount is required");
  }

  if (targetModel === "category" && (!startDate || !endDate)) {
    throw new Error("goal period is required");
  }

  if (startDate && endDate && startDate > endDate) {
    throw new Error("goal start date must be before end date");
  }

  const investmentBoxIds = normalizePlanGoalInvestmentIds(goal);
  const investmentBoxes = normalizePlanGoalInvestmentBoxes(goal);

  if (targetModel === "investment_box") {
    if (!investmentBoxIds.length && !investmentBoxes.length) {
      throw new Error("goal investment box is required");
    }
  }

  return {
    type,
    source,
    targetAmount: Number(targetAmount.toFixed(2)),
    transactionType: normalizePlanTransactionType(goal?.transactionType ?? goal?.transaction_type),
    targetModel,
    categoryIds: targetModel === "category" ? normalizePlanGoalCategoryIds(goal?.categoryIds ?? goal?.category_ids) : [],
    investmentBoxId: targetModel === "investment_box" ? investmentBoxIds[0] ?? null : null,
    investmentBox: targetModel === "investment_box" ? investmentBoxes[0] ?? null : null,
    investmentBoxIds: targetModel === "investment_box" ? investmentBoxIds : [],
    investmentBoxes: targetModel === "investment_box" ? investmentBoxes : [],
    startDate,
    endDate,
  };
}

function parsePlanGoalCategoryIds(value) {
  if (Array.isArray(value)) {
    return normalizePlanGoalCategoryIds(value);
  }

  if (typeof value === "string") {
    return normalizePlanGoalCategoryIds(value.replace(/[{}]/g, "").split(","));
  }

  return [];
}

function normalizePlanInput(input = {}, options = {}) {
  const title = String(input.title ?? "").replace(/\s+/g, " ").trim();

  if (!title && options.requireTitle !== false) {
    throw new Error("plan title is required");
  }

  const source = input.source === "ai" ? "ai" : "manual";

  return {
    title,
    description: String(input.description ?? "").trim(),
    source,
    goal: normalizePlanGoal(input.goal, { source }),
    items: normalizePlanItems(input.items ?? []),
    chatIds: Array.isArray(input.chatIds)
      ? Array.from(new Set(input.chatIds.map((chatId) => String(chatId ?? "").trim()).filter(Boolean)))
      : [],
  };
}

function mapPlanGoal(row) {
  const investmentBox =
    row.goal_investment_id === null || row.goal_investment_id === undefined
      ? null
      : {
          id: row.goal_investment_id,
          name: row.goal_investment_name,
          description: row.goal_investment_description ?? "",
          contributionMode: row.goal_investment_contribution_mode,
          fixedAmount:
            row.goal_investment_fixed_amount === null || row.goal_investment_fixed_amount === undefined
              ? null
              : parseNumeric(row.goal_investment_fixed_amount),
          incomePercentage:
            row.goal_investment_income_percentage === null || row.goal_investment_income_percentage === undefined
              ? null
              : parseNumeric(row.goal_investment_income_percentage),
          currentAmount: parseNumeric(row.goal_investment_current_amount),
          formattedCurrentAmount: formatCurrency(row.goal_investment_current_amount),
          targetAmount:
            row.goal_investment_target_amount === null || row.goal_investment_target_amount === undefined
              ? null
              : parseNumeric(row.goal_investment_target_amount),
          formattedTargetAmount:
            row.goal_investment_target_amount === null || row.goal_investment_target_amount === undefined
              ? null
              : formatCurrency(row.goal_investment_target_amount),
          status: row.goal_investment_status,
          color: row.goal_investment_color ?? null,
          notes: row.goal_investment_notes ?? "",
          bank:
            row.goal_investment_bank_connection_id === null || row.goal_investment_bank_connection_id === undefined
              ? null
              : {
                  id: row.goal_investment_bank_connection_id,
                  slug: row.goal_investment_bank_slug,
                  name: row.goal_investment_bank_name,
                  accountType: row.goal_investment_bank_account_type,
                  color: row.goal_investment_bank_color,
                },
          createdAt: row.goal_investment_created_at,
          updatedAt: row.goal_investment_updated_at,
        };
  const goal = {
    type: normalizePlanGoalType(row.goal_type),
    source: normalizePlanGoalSource(row.goal_source, row.source),
    targetAmount: row.goal_target_amount === null || row.goal_target_amount === undefined ? null : parseNumeric(row.goal_target_amount),
    transactionType: normalizePlanTransactionType(row.goal_transaction_type),
    targetModel: normalizePlanGoalTargetModel(row.goal_target_model),
    categoryIds: parsePlanGoalCategoryIds(row.goal_category_ids),
    investmentBoxId: row.goal_investment_id ?? null,
    investmentBox,
    investmentBoxIds: row.goal_investment_id ? [row.goal_investment_id] : [],
    investmentBoxes: investmentBox ? [investmentBox] : [],
    startDate: normalizePlanGoalDate(row.goal_start_date),
    endDate: normalizePlanGoalDate(row.goal_end_date),
  };

  return goal.type === "transaction_sum" ? goal : buildDefaultPlanGoal(goal.source);
}

function mapPlanRow(row) {
  return {
    id: row.public_id,
    title: row.title,
    description: row.description,
    source: row.source,
    goal: mapPlanGoal(row),
    progress: null,
    aiAssessment: null,
    pendingRecommendations: [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: [],
    chats: [],
  };
}

function mapPlanItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: normalizePlanStatus(row.status),
    priority: normalizePlanPriority(row.priority),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function normalizePlanAssessmentStatus(value) {
  if (value === "completed" || value === "at_risk" || value === "attention") {
    return value;
  }

  return "on_track";
}

function mapPlanAssessment(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    status: normalizePlanAssessmentStatus(row.status),
    riskSummary: row.risk_summary ?? "",
    suggestedPriority: normalizePlanPriority(row.suggested_priority),
    adjustmentRecommendation: row.adjustment_recommendation ?? "",
    assessedAt: row.assessed_at,
  };
}

function mapPlanRecommendation(row) {
  return {
    id: row.id,
    status: row.status === "applied" || row.status === "dismissed" ? row.status : "pending",
    title: row.title,
    rationale: row.rationale ?? "",
    proposedPlan: row.proposed_plan ?? {},
    createdAt: row.created_at,
    appliedAt: row.applied_at ?? null,
  };
}

function mapPlanInvestment(row) {
  return {
    id: row.investment_id,
    name: row.investment_name,
    description: row.investment_description ?? "",
    contributionMode: row.investment_contribution_mode,
    fixedAmount:
      row.investment_fixed_amount === null || row.investment_fixed_amount === undefined
        ? null
        : parseNumeric(row.investment_fixed_amount),
    incomePercentage:
      row.investment_income_percentage === null || row.investment_income_percentage === undefined
        ? null
        : parseNumeric(row.investment_income_percentage),
    currentAmount: parseNumeric(row.investment_current_amount),
    formattedCurrentAmount: formatCurrency(row.investment_current_amount),
    targetAmount:
      row.investment_target_amount === null || row.investment_target_amount === undefined
        ? null
        : parseNumeric(row.investment_target_amount),
    formattedTargetAmount:
      row.investment_target_amount === null || row.investment_target_amount === undefined
        ? null
        : formatCurrency(row.investment_target_amount),
    status: row.investment_status,
    color: row.investment_color ?? null,
    notes: row.investment_notes ?? "",
    bank:
      row.investment_bank_connection_id === null || row.investment_bank_connection_id === undefined
        ? null
        : {
            id: row.investment_bank_connection_id,
            slug: row.investment_bank_slug,
            name: row.investment_bank_name,
            accountType: row.investment_bank_account_type,
            color: row.investment_bank_color,
          },
    createdAt: row.investment_created_at,
    updatedAt: row.investment_updated_at,
  };
}

function mapPlanChat(row) {
  return {
    id: row.public_id,
    title: row.title,
    pinned: Boolean(row.pinned),
    planId: row.plan_public_id ?? null,
    planTitle: row.plan_title ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clampPlanProgress(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function buildPlanItemsProgress(plan) {
  const totalItems = plan.items.length;
  const completedItems = plan.items.filter((item) => item.status === "done").length;

  return {
    type: "items",
    percentage: totalItems > 0 ? clampPlanProgress((completedItems / totalItems) * 100) : 0,
    currentValue: null,
    targetValue: null,
    formattedCurrentValue: null,
    formattedTargetValue: null,
    completedItems,
    totalItems,
  };
}

function buildPlanTransactionProgress(plan, currentValue) {
  const targetValue = plan.goal.targetAmount ?? 0;

  return {
    type: "transaction_sum",
    percentage: targetValue > 0 ? clampPlanProgress((currentValue / targetValue) * 100) : 0,
    currentValue,
    targetValue,
    formattedCurrentValue: formatCurrency(currentValue),
    formattedTargetValue: formatCurrency(targetValue),
    completedItems: null,
    totalItems: null,
  };
}

async function getPlanTransactionGoalCurrentValue(userId, goal) {
  if (goal.targetModel === "investment_box") {
    const investmentIds = (goal.investmentBoxIds?.length ? goal.investmentBoxIds : [goal.investmentBoxId])
      .filter((value) => value !== null && value !== undefined && value !== "")
      .map(Number)
      .filter((value) => Number.isInteger(value) && value > 0);

    if (!investmentIds.length) {
      return 0;
    }

    const result = await pool.query(
      `
        SELECT COALESCE(SUM(current_amount), 0)::NUMERIC(12, 2) AS current_amount
        FROM investments
        WHERE user_id = $1
          AND id = ANY($2::int[])
      `,
      [userId, investmentIds],
    );

    return parseNumeric(result.rows[0]?.current_amount);
  }

  const params = [userId, goal.startDate, goal.endDate];
  const conditions = [
    "t.user_id = $1",
    "t.occurred_on >= $2::date",
    "t.occurred_on <= $3::date",
    goal.transactionType === "income" ? "t.amount > 0" : "t.amount < 0",
  ];

  if (goal.categoryIds.length) {
    params.push(goal.categoryIds);
    conditions.push(`t.category_id = ANY($${params.length}::int[])`);
  }

  const result = await pool.query(
    `
      SELECT COALESCE(SUM(ABS(t.amount)), 0)::NUMERIC(12, 2) AS current_value
      FROM transactions t
      WHERE ${conditions.join(" AND ")}
    `,
    params,
  );

  return parseNumeric(result.rows[0]?.current_value);
}

function transactionMatchesPlanGoal(transaction, goal) {
  if (!transaction || goal.type !== "transaction_sum" || goal.targetModel !== "category") {
    return false;
  }

  const occurredOn = normalizeDateValue(transaction.occurredOn ?? transaction.occurred_on);
  const amount = Number(transaction.amount ?? 0);
  const categoryId = Number(transaction.category?.id ?? transaction.category_id);

  if (!occurredOn || occurredOn < goal.startDate || occurredOn > goal.endDate) {
    return false;
  }

  if (goal.transactionType === "income" && amount <= 0) {
    return false;
  }

  if (goal.transactionType === "expense" && amount >= 0) {
    return false;
  }

  return !goal.categoryIds.length || goal.categoryIds.map(Number).includes(categoryId);
}

async function listAffectedPlanRowsForTransactions(userId, transactions) {
  const relevantTransactions = transactions.filter(Boolean);

  if (!relevantTransactions.length) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        id,
        public_id,
        title,
        description,
        source,
        goal_type,
        goal_source,
        goal_target_amount,
        goal_transaction_type,
        goal_target_model,
        goal_category_ids,
        goal_investment_id,
        goal_start_date,
        goal_end_date,
        created_at,
        updated_at
      FROM plans
      WHERE user_id = $1
        AND goal_type = 'transaction_sum'
        AND goal_target_model = 'category'
    `,
    [userId],
  );

  return result.rows.filter((row) => {
    const goal = mapPlanGoal(row);
    return relevantTransactions.some((transaction) => transactionMatchesPlanGoal(transaction, goal));
  });
}

async function reevaluateAffectedPlansForTransactions(userId, transactions, triggerType) {
  try {
    const planRows = await listAffectedPlanRowsForTransactions(userId, transactions);

    for (const planRow of planRows) {
      const [plan] = await hydratePlans([planRow], userId);
      await persistPlanAssessment({
        userId,
        planRow,
        plan,
        trigger: {
          type: triggerType,
          transactionIds: transactions.filter(Boolean).map((transaction) => transaction.id).filter(Boolean),
        },
      });
    }
  } catch (error) {
    console.error("plan automation failed", error);
  }
}

async function hydratePlanProgress(userId, plans) {
  await Promise.all(
    plans.map(async (plan) => {
      if (plan.goal.type !== "transaction_sum") {
        plan.progress = buildPlanItemsProgress(plan);
        return;
      }

      const currentValue = await getPlanTransactionGoalCurrentValue(userId, plan.goal);
      plan.progress = buildPlanTransactionProgress(plan, currentValue);
    }),
  );

  return plans;
}

async function hydratePlans(planRows, userId = null) {
  if (!planRows.length) {
    return [];
  }

  const plans = planRows.map(mapPlanRow);
  const plansByInternalId = new Map(planRows.map((row, index) => [row.id, plans[index]]));
  const planIds = planRows.map((row) => row.id);
  const [itemsResult, chatsResult, investmentsResult, assessmentsResult, recommendationsResult] = await Promise.all([
    pool.query(
      `
        SELECT id, plan_id, title, description, status, priority, sort_order
        FROM plan_items
        WHERE plan_id = ANY($1::int[])
        ORDER BY sort_order ASC, id ASC
      `,
      [planIds],
    ),
    pool.query(
      `
        SELECT
          c.public_id,
          c.title,
          c.pinned,
          p.public_id AS plan_public_id,
          p.title AS plan_title,
          c.plan_id,
          c.created_at,
          c.updated_at
        FROM chat_conversations c
        INNER JOIN plans p ON p.id = c.plan_id
        WHERE c.plan_id = ANY($1::int[])
        ORDER BY c.updated_at DESC, c.id DESC
      `,
      [planIds],
    ),
    pool.query(
      `
        SELECT
          pir.plan_id,
          i.id AS investment_id,
          i.name AS investment_name,
          i.description AS investment_description,
          i.contribution_mode AS investment_contribution_mode,
          i.fixed_amount AS investment_fixed_amount,
          i.income_percentage AS investment_income_percentage,
          i.current_amount AS investment_current_amount,
          i.target_amount AS investment_target_amount,
          i.status AS investment_status,
          i.color AS investment_color,
          i.notes AS investment_notes,
          i.created_at AS investment_created_at,
          i.updated_at AS investment_updated_at,
          b.id AS investment_bank_connection_id,
          b.slug AS investment_bank_slug,
          b.name AS investment_bank_name,
          b.account_type AS investment_bank_account_type,
          b.color AS investment_bank_color
        FROM plan_investment_refs pir
        INNER JOIN investments i ON i.id = pir.investment_id
        LEFT JOIN bank_connections b ON b.id = i.bank_connection_id
        WHERE pir.plan_id = ANY($1::int[])
        ORDER BY i.status ASC, i.updated_at DESC, i.id DESC
      `,
      [planIds],
    ),
    pool.query(
      `
        SELECT DISTINCT ON (plan_id)
          id,
          plan_id,
          status,
          risk_summary,
          suggested_priority,
          adjustment_recommendation,
          assessed_at
        FROM plan_ai_assessments
        WHERE plan_id = ANY($1::int[])
        ORDER BY plan_id, assessed_at DESC, id DESC
      `,
      [planIds],
    ),
    pool.query(
      `
        SELECT
          id,
          plan_id,
          status,
          title,
          rationale,
          proposed_plan,
          created_at,
          applied_at
        FROM plan_recommendations
        WHERE plan_id = ANY($1::int[])
          AND status = 'pending'
        ORDER BY created_at DESC, id DESC
      `,
      [planIds],
    ),
  ]);

  itemsResult.rows.forEach((row) => {
    plansByInternalId.get(row.plan_id)?.items.push(mapPlanItem(row));
  });

  chatsResult.rows.forEach((row) => {
    plansByInternalId.get(row.plan_id)?.chats.push(mapPlanChat(row));
  });

  investmentsResult.rows.forEach((row) => {
    const plan = plansByInternalId.get(row.plan_id);

    if (!plan || plan.goal.targetModel !== "investment_box") {
      return;
    }

    const investment = mapPlanInvestment(row);
    plan.goal.investmentBoxes.push(investment);
    plan.goal.investmentBoxIds.push(investment.id);
    plan.goal.investmentBoxId = plan.goal.investmentBoxId ?? investment.id;
    plan.goal.investmentBox = plan.goal.investmentBox ?? investment;
  });

  assessmentsResult.rows.forEach((row) => {
    const plan = plansByInternalId.get(row.plan_id);
    if (plan) {
      plan.aiAssessment = mapPlanAssessment(row);
    }
  });

  recommendationsResult.rows.forEach((row) => {
    plansByInternalId.get(row.plan_id)?.pendingRecommendations.push(mapPlanRecommendation(row));
  });

  return userId ? hydratePlanProgress(userId, plans) : plans;
}

async function getPlanRowByPublicId(userId, publicId) {
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.public_id,
        p.title,
        p.description,
        p.source,
        p.goal_type,
        p.goal_source,
        p.goal_target_amount,
        p.goal_transaction_type,
        p.goal_target_model,
        p.goal_category_ids,
        p.goal_investment_id,
        gi.name AS goal_investment_name,
        gi.description AS goal_investment_description,
        gi.contribution_mode AS goal_investment_contribution_mode,
        gi.fixed_amount AS goal_investment_fixed_amount,
        gi.income_percentage AS goal_investment_income_percentage,
        gi.current_amount AS goal_investment_current_amount,
        gi.target_amount AS goal_investment_target_amount,
        gi.status AS goal_investment_status,
        gi.color AS goal_investment_color,
        gi.notes AS goal_investment_notes,
        gi.created_at AS goal_investment_created_at,
        gi.updated_at AS goal_investment_updated_at,
        gb.id AS goal_investment_bank_connection_id,
        gb.slug AS goal_investment_bank_slug,
        gb.name AS goal_investment_bank_name,
        gb.account_type AS goal_investment_bank_account_type,
        gb.color AS goal_investment_bank_color,
        p.goal_start_date,
        p.goal_end_date,
        p.created_at,
        p.updated_at
      FROM plans p
      LEFT JOIN investments gi ON gi.id = p.goal_investment_id
      LEFT JOIN bank_connections gb ON gb.id = gi.bank_connection_id
      WHERE p.user_id = $1 AND p.public_id = $2
    `,
    [userId, publicId],
  );

  return result.rows[0] ?? null;
}

export async function getPlanDetail(userId, publicId) {
  const row = await getPlanRowByPublicId(userId, publicId);

  if (!row) {
    throw new Error("plan not found");
  }

  const [plan] = await hydratePlans([row], userId);
  return plan;
}

async function replacePlanItems(client, planId, items) {
  await client.query("DELETE FROM plan_items WHERE plan_id = $1", [planId]);

  for (const [index, item] of items.entries()) {
    await client.query(
      `
        INSERT INTO plan_items (plan_id, title, description, status, priority, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [planId, item.title, item.description, item.status, item.priority, item.sortOrder ?? index],
    );
  }
}

async function attachChatsToPlan(client, userId, planId, chatIds) {
  if (!chatIds.length) {
    return;
  }

  const result = await client.query(
    `
      UPDATE chat_conversations
      SET plan_id = $3, updated_at = NOW()
      WHERE user_id = $1 AND public_id = ANY($2::text[])
      RETURNING public_id
    `,
    [userId, chatIds, planId],
  );

  if (result.rowCount !== chatIds.length) {
    throw new Error("chat not found");
  }
}

async function replacePlanInvestmentRefs(client, planId, investmentIds) {
  await client.query("DELETE FROM plan_investment_refs WHERE plan_id = $1", [planId]);

  const normalizedIds = Array.from(
    new Set(
      (investmentIds ?? [])
        .map(Number)
        .filter((value) => Number.isInteger(value) && value > 0),
    ),
  );

  for (const investmentId of normalizedIds) {
    await client.query(
      `
        INSERT INTO plan_investment_refs (plan_id, investment_id)
        VALUES ($1, $2)
        ON CONFLICT (plan_id, investment_id) DO NOTHING
      `,
      [planId, investmentId],
    );
  }
}

export async function listPlans(userId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      SELECT
        p.id,
        p.public_id,
        p.title,
        p.description,
        p.source,
        p.goal_type,
        p.goal_source,
        p.goal_target_amount,
        p.goal_transaction_type,
        p.goal_target_model,
        p.goal_category_ids,
        p.goal_investment_id,
        gi.name AS goal_investment_name,
        gi.description AS goal_investment_description,
        gi.contribution_mode AS goal_investment_contribution_mode,
        gi.fixed_amount AS goal_investment_fixed_amount,
        gi.income_percentage AS goal_investment_income_percentage,
        gi.current_amount AS goal_investment_current_amount,
        gi.target_amount AS goal_investment_target_amount,
        gi.status AS goal_investment_status,
        gi.color AS goal_investment_color,
        gi.notes AS goal_investment_notes,
        gi.created_at AS goal_investment_created_at,
        gi.updated_at AS goal_investment_updated_at,
        gb.id AS goal_investment_bank_connection_id,
        gb.slug AS goal_investment_bank_slug,
        gb.name AS goal_investment_bank_name,
        gb.account_type AS goal_investment_bank_account_type,
        gb.color AS goal_investment_bank_color,
        p.goal_start_date,
        p.goal_end_date,
        p.created_at,
        p.updated_at
      FROM plans p
      LEFT JOIN investments gi ON gi.id = p.goal_investment_id
      LEFT JOIN bank_connections gb ON gb.id = gi.bank_connection_id
      WHERE p.user_id = $1
      ORDER BY p.updated_at DESC, p.id DESC
    `,
    [resolvedUserId],
  );

  return hydratePlans(result.rows, resolvedUserId);
}

async function createPlanGoalInvestment(client, userId, investmentInput) {
  if (investmentInput.bankConnectionId !== null) {
    const bankConnection = await getBankConnectionById(userId, investmentInput.bankConnectionId, client);

    if (!bankConnection) {
      throw new Error("bank connection not found");
    }
  }

  const result = await client.query(
    `
      INSERT INTO investments (
        user_id,
        bank_connection_id,
        name,
        description,
        contribution_mode,
        fixed_amount,
        income_percentage,
        current_amount,
        target_amount,
        status,
        color,
        notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `,
    [
      userId,
      investmentInput.bankConnectionId,
      investmentInput.name,
      investmentInput.description,
      investmentInput.contributionMode,
      investmentInput.fixedAmount,
      investmentInput.incomePercentage,
      investmentInput.currentAmount,
      investmentInput.targetAmount,
      investmentInput.status,
      investmentInput.color,
      investmentInput.notes,
    ],
  );

  return result.rows[0].id;
}

async function resolvePlanGoalInvestmentIds(client, userId, goal) {
  if (goal.type !== "transaction_sum" || goal.targetModel !== "investment_box") {
    return [];
  }

  const investmentIds = [];

  for (const investmentId of goal.investmentBoxIds ?? []) {
    const existingInvestment = await getInvestmentRowById(userId, investmentId, client);

    if (!existingInvestment) {
      throw new Error("investment not found");
    }

    investmentIds.push(investmentId);
  }

  for (const investmentBox of goal.investmentBoxes ?? []) {
    investmentIds.push(await createPlanGoalInvestment(client, userId, investmentBox));
  }

  return Array.from(new Set(investmentIds));
}

export async function createPlan(userId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const normalizedInput = normalizePlanInput(input);
  const client = await pool.connect();
  let planPublicId;

  try {
    await client.query("BEGIN");
    const goalInvestmentIds = await resolvePlanGoalInvestmentIds(client, resolvedUserId, normalizedInput.goal);
    const goalInvestmentId = goalInvestmentIds[0] ?? null;
    const result = await client.query(
      `
        INSERT INTO plans (
          user_id,
          public_id,
          title,
          description,
          source,
          goal_type,
          goal_source,
          goal_target_amount,
          goal_transaction_type,
          goal_target_model,
          goal_category_ids,
          goal_investment_id,
          goal_start_date,
          goal_end_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::int[], $12, $13::date, $14::date)
        RETURNING public_id, id
      `,
      [
        resolvedUserId,
        randomUUID(),
        normalizedInput.title,
        normalizedInput.description,
        normalizedInput.source,
        normalizedInput.goal.type,
        normalizedInput.goal.source,
        normalizedInput.goal.targetAmount,
        normalizedInput.goal.transactionType,
        normalizedInput.goal.targetModel,
        normalizedInput.goal.categoryIds,
        goalInvestmentId,
        normalizedInput.goal.startDate,
        normalizedInput.goal.endDate,
      ],
    );
    const row = result.rows[0];
    planPublicId = row.public_id;
    await replacePlanItems(client, row.id, normalizedInput.items);
    await replacePlanInvestmentRefs(client, row.id, goalInvestmentIds);
    await attachChatsToPlan(client, resolvedUserId, row.id, normalizedInput.chatIds);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getPlanDetail(resolvedUserId, planPublicId);
}

export async function updatePlan(userId, publicId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const planRow = await getPlanRowByPublicId(resolvedUserId, publicId);

  if (!planRow) {
    throw new Error("plan not found");
  }

  const hasTitle = Object.prototype.hasOwnProperty.call(input, "title");
  const hasDescription = Object.prototype.hasOwnProperty.call(input, "description");
  const hasItems = Object.prototype.hasOwnProperty.call(input, "items");
  const hasGoal = Object.prototype.hasOwnProperty.call(input, "goal");
  const title = hasTitle ? String(input.title ?? "").replace(/\s+/g, " ").trim() : planRow.title;

  if (hasTitle && !title) {
    throw new Error("plan title is required");
  }

  const description = hasDescription ? String(input.description ?? "").trim() : planRow.description;
  const items = hasItems ? normalizePlanItems(input.items ?? []) : null;
  const goal = hasGoal ? normalizePlanGoal(input.goal, { source: planRow.source }) : mapPlanGoal(planRow);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const goalInvestmentIds = await resolvePlanGoalInvestmentIds(client, resolvedUserId, goal);
    const goalInvestmentId = goalInvestmentIds[0] ?? null;
    await client.query(
      `
        UPDATE plans
        SET
          title = $3,
          description = $4,
          goal_type = $5,
          goal_source = $6,
          goal_target_amount = $7,
          goal_transaction_type = $8,
          goal_target_model = $9,
          goal_category_ids = $10::int[],
          goal_investment_id = $11,
          goal_start_date = $12::date,
          goal_end_date = $13::date,
          updated_at = NOW()
        WHERE user_id = $1 AND id = $2
      `,
      [
        resolvedUserId,
        planRow.id,
        title,
        description,
        goal.type,
        goal.source,
        goal.targetAmount,
        goal.transactionType,
        goal.targetModel,
        goal.categoryIds,
        goalInvestmentId,
        goal.startDate,
        goal.endDate,
      ],
    );

    if (items) {
      await replacePlanItems(client, planRow.id, items);
    }

    if (hasGoal) {
      await replacePlanInvestmentRefs(client, planRow.id, goalInvestmentIds);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return getPlanDetail(resolvedUserId, publicId);
}

export async function deletePlan(userId, publicId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      DELETE FROM plans
      WHERE user_id = $1 AND public_id = $2
    `,
    [resolvedUserId, publicId],
  );

  if (!result.rowCount) {
    throw new Error("plan not found");
  }
}

export async function linkChatToPlan(userId, planPublicId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const planRow = await getPlanRowByPublicId(resolvedUserId, planPublicId);

  if (!planRow) {
    throw new Error("plan not found");
  }

  const result = await pool.query(
    `
      UPDATE chat_conversations
      SET plan_id = $3, updated_at = NOW()
      WHERE user_id = $1 AND public_id = $2
      RETURNING public_id
    `,
    [resolvedUserId, chatPublicId, planRow.id],
  );

  if (!result.rowCount) {
    throw new Error("chat not found");
  }

  return getPlanDetail(resolvedUserId, planPublicId);
}

export async function unlinkChatFromPlan(userId, planPublicId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const planRow = await getPlanRowByPublicId(resolvedUserId, planPublicId);

  if (!planRow) {
    throw new Error("plan not found");
  }

  const result = await pool.query(
    `
      UPDATE chat_conversations
      SET plan_id = NULL, updated_at = NOW()
      WHERE user_id = $1 AND public_id = $2 AND plan_id = $3
      RETURNING public_id
    `,
    [resolvedUserId, chatPublicId, planRow.id],
  );

  if (!result.rowCount) {
    throw new Error("chat not found");
  }

  return getPlanDetail(resolvedUserId, planPublicId);
}

async function buildPlanAiChatPayload(userId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const conversation = await getChatConversationByPublicId(resolvedUserId, chatPublicId);

  if (!conversation) {
    throw new Error("chat not found");
  }

  const [messages, context, categories, investments] = await Promise.all([
    listChatMessages(resolvedUserId, chatPublicId, 30),
    buildChatAdvisorContext(resolvedUserId, []),
    listCategories(),
    listInvestments(resolvedUserId),
  ]);

  return {
    userId: resolvedUserId,
    chat: {
      id: conversation.public_id,
      title: conversation.title,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    },
    context: {
      ...context,
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        transactionType: category.transactionType,
        groupLabel: category.groupLabel,
      })),
      investmentBoxes: investments
        .filter((investment) => investment.status === "active")
        .map((investment) => ({
          id: investment.id,
          name: investment.name,
          contributionMode: investment.contributionMode,
          fixedAmount: investment.fixedAmount,
          incomePercentage: investment.incomePercentage,
          currentAmount: investment.currentAmount,
          targetAmount: investment.targetAmount,
          status: investment.status,
        })),
    },
  };
}

export async function generatePlanDraftFromChat(userId, chatPublicId) {
  const payload = await buildPlanAiChatPayload(userId, chatPublicId);
  return generatePlanDraft({
    chat: payload.chat,
    context: payload.context,
    generatedAt: new Date().toISOString(),
  });
}

export async function revisePlanDraftFromChat(userId, chatPublicId, draft, correction) {
  const payload = await buildPlanAiChatPayload(userId, chatPublicId);
  return revisePlanDraft({
    chat: payload.chat,
    context: payload.context,
    draft,
    correction,
    generatedAt: new Date().toISOString(),
  });
}

function normalizeRevisionMessages(messages = []) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      content: String(message?.content ?? "").trim().slice(0, 2000),
    }))
    .filter((message) => message.content);
}

function mapPlanAiDraft(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.public_id,
    chatId: row.chat_public_id,
    assistantMessageId: row.assistant_message_id ?? null,
    draft: row.draft ?? {},
    revisionMessages: normalizeRevisionMessages(row.revision_messages ?? []),
    status: row.status === "confirmed" || row.status === "dismissed" ? row.status : "pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    resolvedAt: row.resolved_at ?? null,
  };
}

async function getPlanAiDraftByPublicId(userId, draftPublicId, client = pool) {
  const result = await client.query(
    `
      SELECT
        pad.public_id,
        c.public_id AS chat_public_id,
        pad.assistant_message_id,
        pad.draft,
        pad.revision_messages,
        pad.status,
        pad.created_at,
        pad.updated_at,
        pad.resolved_at
      FROM plan_ai_drafts pad
      INNER JOIN chat_conversations c ON c.id = pad.chat_id
      WHERE pad.user_id = $1
        AND pad.public_id = $2
      LIMIT 1
    `,
    [userId, draftPublicId],
  );

  return mapPlanAiDraft(result.rows[0]);
}

async function getPendingPlanAiDraftForChat(userId, chatId, client = pool) {
  const result = await client.query(
    `
      SELECT
        pad.public_id,
        c.public_id AS chat_public_id,
        pad.assistant_message_id,
        pad.draft,
        pad.revision_messages,
        pad.status,
        pad.created_at,
        pad.updated_at,
        pad.resolved_at
      FROM plan_ai_drafts pad
      INNER JOIN chat_conversations c ON c.id = pad.chat_id
      WHERE pad.user_id = $1
        AND pad.chat_id = $2
        AND pad.status = 'pending'
      LIMIT 1
    `,
    [userId, chatId],
  );

  return mapPlanAiDraft(result.rows[0]);
}

async function insertPlanDraftAssistantMessage(client, userId, chatId) {
  const result = await client.query(
    `
      INSERT INTO chat_messages (user_id, chat_id, role, content)
      VALUES ($1, $2, 'assistant', 'Criei um rascunho de planejamento para voce revisar.')
      RETURNING id
    `,
    [userId, chatId],
  );

  await client.query("DELETE FROM plan_chat_summaries WHERE user_id = $1 AND chat_id = $2", [userId, chatId]);

  return result.rows[0].id;
}

export async function createOrGetPlanAiDraftSession(userId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const conversation = await getChatConversationByPublicId(resolvedUserId, chatPublicId);

  if (!conversation) {
    throw new Error("chat not found");
  }

  const pendingDraft = await getPendingPlanAiDraftForChat(resolvedUserId, conversation.id);

  if (pendingDraft) {
    return pendingDraft;
  }

  const draft = await generatePlanDraftFromChat(resolvedUserId, conversation.public_id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingDraft = await getPendingPlanAiDraftForChat(resolvedUserId, conversation.id, client);
    if (existingDraft) {
      await client.query("COMMIT");
      return existingDraft;
    }

    const assistantMessageId = await insertPlanDraftAssistantMessage(client, resolvedUserId, conversation.id);
    const result = await client.query(
      `
        INSERT INTO plan_ai_drafts (
          user_id,
          chat_id,
          assistant_message_id,
          public_id,
          draft,
          revision_messages
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, '[]'::jsonb)
        RETURNING public_id
      `,
      [resolvedUserId, conversation.id, assistantMessageId, randomUUID(), JSON.stringify(draft)],
    );

    await client.query(
      `
        UPDATE chat_conversations
        SET updated_at = NOW()
        WHERE user_id = $1 AND id = $2
      `,
      [resolvedUserId, conversation.id],
    );

    await client.query("COMMIT");
    return getPlanAiDraftByPublicId(resolvedUserId, result.rows[0].public_id);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getPlanAiDraft(userId, draftPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const draft = await getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);

  if (!draft) {
    throw new Error("plan draft not found");
  }

  return draft;
}

export async function updatePlanAiDraft(userId, draftPublicId, draftInput) {
  const resolvedUserId = await requireUserId(userId);

  if (!draftInput || typeof draftInput !== "object" || Array.isArray(draftInput)) {
    throw new Error("draft is required");
  }

  const result = await pool.query(
    `
      UPDATE plan_ai_drafts
      SET draft = $3::jsonb,
          updated_at = NOW()
      WHERE user_id = $1
        AND public_id = $2
        AND status = 'pending'
      RETURNING public_id
    `,
    [resolvedUserId, draftPublicId, JSON.stringify(draftInput)],
  );

  if (!result.rowCount) {
    throw new Error("pending plan draft not found");
  }

  return getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);
}

export async function revisePlanAiDraft(userId, draftPublicId, correction) {
  const resolvedUserId = await requireUserId(userId);
  const currentDraft = await getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);

  if (!currentDraft || currentDraft.status !== "pending") {
    throw new Error("pending plan draft not found");
  }

  const normalizedCorrection = String(correction ?? "").trim();

  if (!normalizedCorrection) {
    throw new Error("correction is required");
  }

  const revisedDraft = await revisePlanDraftFromChat(
    resolvedUserId,
    currentDraft.chatId,
    currentDraft.draft,
    normalizedCorrection,
  );
  const revisionMessages = [
    ...currentDraft.revisionMessages,
    { role: "user", content: normalizedCorrection },
    { role: "assistant", content: "Rascunho atualizado para revisao." },
  ];

  const result = await pool.query(
    `
      UPDATE plan_ai_drafts
      SET draft = $3::jsonb,
          revision_messages = $4::jsonb,
          updated_at = NOW()
      WHERE user_id = $1
        AND public_id = $2
        AND status = 'pending'
      RETURNING public_id
    `,
    [resolvedUserId, draftPublicId, JSON.stringify(revisedDraft), JSON.stringify(revisionMessages)],
  );

  if (!result.rowCount) {
    throw new Error("pending plan draft not found");
  }

  return getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);
}

export async function confirmPlanAiDraft(userId, draftPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const currentDraft = await getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);

  if (!currentDraft || currentDraft.status !== "pending") {
    throw new Error("pending plan draft not found");
  }

  if ((currentDraft.draft?.clarifications ?? []).some((clarification) => clarification?.required !== false)) {
    throw new Error("plan draft has required clarifications");
  }

  const plan = await createPlan(resolvedUserId, {
    ...currentDraft.draft,
    source: "ai",
    chatIds: [currentDraft.chatId],
  });

  await pool.query(
    `
      UPDATE plan_ai_drafts
      SET status = 'confirmed',
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND public_id = $2
        AND status = 'pending'
    `,
    [resolvedUserId, draftPublicId],
  );

  return plan;
}

export async function dismissPlanAiDraft(userId, draftPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      UPDATE plan_ai_drafts
      SET status = 'dismissed',
          resolved_at = NOW(),
          updated_at = NOW()
      WHERE user_id = $1
        AND public_id = $2
        AND status = 'pending'
      RETURNING public_id
    `,
    [resolvedUserId, draftPublicId],
  );

  if (!result.rowCount) {
    throw new Error("pending plan draft not found");
  }

  return getPlanAiDraftByPublicId(resolvedUserId, draftPublicId);
}

export async function suggestPlanLinkForChat(userId, chatPublicId) {
  const payload = await buildPlanAiChatPayload(userId, chatPublicId);
  const plans = await listPlans(payload.userId);

  if (!plans.length) {
    return {
      action: "create",
      planId: null,
      rationale: "Nenhum planejamento existente foi encontrado para este chat.",
    };
  }

  return suggestPlanLink({
    chat: payload.chat,
    plans: plans.map((plan) => ({
      id: plan.id,
      title: plan.title,
      description: plan.description,
      items: plan.items.map((item) => ({ title: item.title, status: item.status })),
    })),
    generatedAt: new Date().toISOString(),
  });
}

async function getPlanRowAndDetail(userId, publicId) {
  const row = await getPlanRowByPublicId(userId, publicId);

  if (!row) {
    throw new Error("plan not found");
  }

  const [plan] = await hydratePlans([row], userId);
  return { row, plan };
}

function buildPlanAssessmentContext(plan) {
  return {
    progress: plan.progress,
    goal: plan.goal,
    items: plan.items.map((item) => ({
      title: item.title,
      status: item.status,
      priority: item.priority,
    })),
    chats: plan.chats.map((chat) => ({
      title: chat.title,
      updatedAt: chat.updatedAt,
    })),
  };
}

async function insertPlanAlertNotification({ userId, planRow, assessment }) {
  if (!["attention", "at_risk"].includes(assessment.status)) {
    return null;
  }

  const alertType = assessment.status === "at_risk" ? "risk" : "attention";
  const title = assessment.status === "at_risk" ? "Planejamento em risco" : "Planejamento precisa de atencao";
  const message = `${planRow.title}: ${assessment.riskSummary || assessment.adjustmentRecommendation}`.slice(0, 1000);

  const result = await pool.query(
    `
      WITH inserted AS (
        INSERT INTO notifications (
          created_by_user_id,
          source,
          category,
          title,
          message,
          plan_id,
          plan_alert_type,
          plan_alert_window_start,
          action_href
        )
        VALUES ($1, 'user_self', 'general', $2, $3, $4, $5, DATE_TRUNC('week', NOW()), $6)
        ON CONFLICT (created_by_user_id, plan_id, plan_alert_type, plan_alert_window_start)
        WHERE plan_id IS NOT NULL AND plan_alert_type IS NOT NULL AND plan_alert_window_start IS NOT NULL
        DO NOTHING
        RETURNING id
      )
      INSERT INTO notification_recipients (notification_id, user_id)
      SELECT id, $1 FROM inserted
      ON CONFLICT (notification_id, user_id) DO NOTHING
      RETURNING notification_id
    `,
    [userId, title, message, planRow.id, alertType, `/plans/${planRow.public_id}`],
  );

  return result.rows[0]?.notification_id ?? null;
}

async function persistPlanAssessment({ userId, planRow, plan, trigger = null }) {
  const assessment = await generatePlanAssessment({
    plan,
    context: buildPlanAssessmentContext(plan),
    trigger,
    generatedAt: new Date().toISOString(),
  });

  const result = await pool.query(
    `
      INSERT INTO plan_ai_assessments (
        plan_id,
        user_id,
        status,
        risk_summary,
        suggested_priority,
        adjustment_recommendation,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      RETURNING id, status, risk_summary, suggested_priority, adjustment_recommendation, assessed_at
    `,
    [
      planRow.id,
      userId,
      normalizePlanAssessmentStatus(assessment.status),
      String(assessment.riskSummary ?? "").trim().slice(0, 1000),
      normalizePlanPriority(assessment.suggestedPriority),
      String(assessment.adjustmentRecommendation ?? "").trim().slice(0, 1000),
      JSON.stringify({ trigger }),
    ],
  );

  const assessmentRow = result.rows[0];

  if (assessment.recommendation?.title) {
    await pool.query(
      `
        INSERT INTO plan_recommendations (
          plan_id,
          user_id,
          assessment_id,
          title,
          rationale,
          proposed_plan
        )
        SELECT $1, $2, $3, $4, $5, $6::jsonb
        WHERE NOT EXISTS (
          SELECT 1
          FROM plan_recommendations
          WHERE plan_id = $1
            AND status = 'pending'
            AND title = $4
        )
      `,
      [
        planRow.id,
        userId,
        assessmentRow.id,
        String(assessment.recommendation.title).trim().slice(0, 160),
        String(assessment.recommendation.rationale ?? "").trim().slice(0, 1000),
        JSON.stringify(assessment.recommendation.proposedPlan ?? {}),
      ],
    );
  }

  await insertPlanAlertNotification({ userId, planRow, assessment: assessmentRow });

  return getPlanDetail(userId, planRow.public_id);
}

export async function evaluatePlanWithAi(userId, planPublicId, trigger = null) {
  const resolvedUserId = await requireUserId(userId);
  const { row, plan } = await getPlanRowAndDetail(resolvedUserId, planPublicId);
  return persistPlanAssessment({ userId: resolvedUserId, planRow: row, plan, trigger });
}

export async function listPlanRecommendations(userId, planPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const row = await getPlanRowByPublicId(resolvedUserId, planPublicId);

  if (!row) {
    throw new Error("plan not found");
  }

  const result = await pool.query(
    `
      SELECT id, status, title, rationale, proposed_plan, created_at, applied_at
      FROM plan_recommendations
      WHERE user_id = $1
        AND plan_id = $2
      ORDER BY created_at DESC, id DESC
      LIMIT 50
    `,
    [resolvedUserId, row.id],
  );

  return result.rows.map(mapPlanRecommendation);
}

export async function applyPlanRecommendation(userId, planPublicId, recommendationId) {
  const resolvedUserId = await requireUserId(userId);
  const row = await getPlanRowByPublicId(resolvedUserId, planPublicId);

  if (!row) {
    throw new Error("plan not found");
  }

  const recommendationResult = await pool.query(
    `
      SELECT id, proposed_plan
      FROM plan_recommendations
      WHERE user_id = $1
        AND plan_id = $2
        AND id = $3
        AND status = 'pending'
      LIMIT 1
    `,
    [resolvedUserId, row.id, recommendationId],
  );
  const recommendation = recommendationResult.rows[0];

  if (!recommendation) {
    throw new Error("recommendation not found");
  }

  const proposedPlan = recommendation.proposed_plan && typeof recommendation.proposed_plan === "object" ? recommendation.proposed_plan : {};
  const updateInput = {};

  if (proposedPlan.title) {
    updateInput.title = proposedPlan.title;
  }

  if (Object.prototype.hasOwnProperty.call(proposedPlan, "description")) {
    updateInput.description = proposedPlan.description;
  }

  if (proposedPlan.goal) {
    updateInput.goal = proposedPlan.goal;
  }

  if (Array.isArray(proposedPlan.items)) {
    updateInput.items = proposedPlan.items;
  }

  const plan = Object.keys(updateInput).length ? await updatePlan(resolvedUserId, planPublicId, updateInput) : await getPlanDetail(resolvedUserId, planPublicId);

  await pool.query(
    `
      UPDATE plan_recommendations
      SET status = 'applied',
          applied_at = NOW()
      WHERE user_id = $1
        AND plan_id = $2
        AND id = $3
    `,
    [resolvedUserId, row.id, recommendation.id],
  );

  return getPlanDetail(resolvedUserId, plan.id);
}

async function getChatSummaryState(userId, chatPublicId) {
  const conversation = await getChatConversationByPublicId(userId, chatPublicId);

  if (!conversation) {
    throw new Error("chat not found");
  }

  const stateResult = await pool.query(
    `
      SELECT
        COUNT(cm.id)::INT AS message_count,
        MAX(cm.id)::INT AS last_message_id
      FROM chat_messages cm
      WHERE cm.user_id = $1
        AND cm.chat_id = $2
    `,
    [userId, conversation.id],
  );

  return {
    conversation,
    messageCount: Number(stateResult.rows[0]?.message_count ?? 0),
    lastMessageId: stateResult.rows[0]?.last_message_id === null ? null : Number(stateResult.rows[0]?.last_message_id),
  };
}

function mapPlanChatSummary(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    chatId: row.chat_public_id,
    summary: row.summary,
    messageCount: Number(row.message_count ?? 0),
    lastMessageId: row.last_message_id === null ? null : Number(row.last_message_id),
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
    stale: Boolean(row.stale),
  };
}

export async function getPlanChatSummary(userId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const { conversation, messageCount, lastMessageId } = await getChatSummaryState(resolvedUserId, chatPublicId);
  const result = await pool.query(
    `
      SELECT
        pcs.id,
        $2 AS chat_public_id,
        pcs.summary,
        pcs.message_count,
        pcs.last_message_id,
        pcs.generated_at,
        pcs.updated_at,
        (pcs.message_count <> $3 OR pcs.last_message_id IS DISTINCT FROM $4::int) AS stale
      FROM plan_chat_summaries pcs
      WHERE pcs.user_id = $1
        AND pcs.chat_id = $5
      LIMIT 1
    `,
    [resolvedUserId, conversation.public_id, messageCount, lastMessageId, conversation.id],
  );

  return (
    mapPlanChatSummary(result.rows[0]) ?? {
      id: null,
      chatId: conversation.public_id,
      summary: "",
      messageCount,
      lastMessageId,
      generatedAt: null,
      updatedAt: null,
      stale: true,
    }
  );
}

export async function generatePlanChatSummary(userId, chatPublicId) {
  const resolvedUserId = await requireUserId(userId);
  const { conversation, messageCount, lastMessageId } = await getChatSummaryState(resolvedUserId, chatPublicId);
  const messages = await listChatMessages(resolvedUserId, conversation.public_id, 80);
  const generated = await generateChatSummary({
    chat: {
      id: conversation.public_id,
      title: conversation.title,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
        createdAt: message.createdAt,
      })),
    },
    generatedAt: new Date().toISOString(),
  });

  const result = await pool.query(
    `
      INSERT INTO plan_chat_summaries (
        chat_id,
        user_id,
        summary,
        message_count,
        last_message_id
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (chat_id)
      DO UPDATE SET
        summary = EXCLUDED.summary,
        message_count = EXCLUDED.message_count,
        last_message_id = EXCLUDED.last_message_id,
        generated_at = NOW(),
        updated_at = NOW()
      RETURNING id, $6 AS chat_public_id, summary, message_count, last_message_id, generated_at, updated_at, FALSE AS stale
    `,
    [conversation.id, resolvedUserId, generated.summary, messageCount, lastMessageId, conversation.public_id],
  );

  return mapPlanChatSummary(result.rows[0]);
}

function mapChatConversation(row) {
  return {
    id: row.public_id,
    title: row.title,
    pinned: Boolean(row.pinned),
    planId: row.plan_public_id ?? null,
    planTitle: row.plan_title ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapChatSearchResult(row) {
  return {
    chatId: row.public_id,
    title: row.title,
    matchedText: row.matched_text,
    matchedAt: row.matched_at,
    matchType: row.match_type,
  };
}

function mapChatMessage(row) {
  const draftStatus = row.plan_draft_status ?? null;

  return {
    id: row.id,
    chatId: row.chat_public_id ?? row.chat_id ?? null,
    role: row.role,
    content: row.content,
    provider: row.provider ?? null,
    model: row.model ?? null,
    inputTokens: row.input_tokens === null ? null : Number(row.input_tokens),
    outputTokens: row.output_tokens === null ? null : Number(row.output_tokens),
    totalTokens: row.total_tokens === null ? null : Number(row.total_tokens),
    requestCount: row.request_count === null ? null : Number(row.request_count),
    estimatedCostUsd: row.estimated_cost_usd === null ? null : Number.parseFloat(row.estimated_cost_usd),
    createdAt: row.created_at,
    planDraftAction: row.plan_draft_public_id
      ? {
          draftId: row.plan_draft_public_id,
          status: draftStatus === "confirmed" || draftStatus === "dismissed" ? draftStatus : "pending",
          label: "Revisar plano",
        }
      : null,
  };
}

function buildFallbackChatTitle(message) {
  const normalized = String(message ?? "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "Novo chat";
  }

  const withoutTrailingPunctuation = normalized.replace(/[?.!,;:]+$/g, "");
  if (!withoutTrailingPunctuation) {
    return "Novo chat";
  }

  return withoutTrailingPunctuation.length > 60
    ? `${withoutTrailingPunctuation.slice(0, 57).trim()}...`
    : withoutTrailingPunctuation;
}

async function getChatConversationByPublicId(userId, publicId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.public_id,
        c.title,
        c.pinned,
        p.public_id AS plan_public_id,
        p.title AS plan_title,
        c.created_at,
        c.updated_at
      FROM chat_conversations c
      LEFT JOIN plans p ON p.id = c.plan_id
      WHERE c.user_id = $1 AND c.public_id = $2
    `,
    [userId, publicId],
  );

  return result.rows[0] ?? null;
}

async function getLatestChatConversation(userId) {
  const result = await pool.query(
    `
      SELECT
        c.id,
        c.public_id,
        c.title,
        c.pinned,
        p.public_id AS plan_public_id,
        p.title AS plan_title,
        c.created_at,
        c.updated_at
      FROM chat_conversations c
      LEFT JOIN plans p ON p.id = c.plan_id
      WHERE c.user_id = $1
      ORDER BY c.pinned DESC, c.updated_at DESC, c.id DESC
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function listChatConversations(userId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      SELECT
        c.public_id,
        c.title,
        c.pinned,
        p.public_id AS plan_public_id,
        p.title AS plan_title,
        c.created_at,
        c.updated_at
      FROM chat_conversations c
      LEFT JOIN plans p ON p.id = c.plan_id
      WHERE c.user_id = $1
      ORDER BY c.pinned DESC, c.updated_at DESC, c.id DESC
    `,
    [resolvedUserId],
  );

  return result.rows.map(mapChatConversation);
}

export async function createChatConversation(userId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      INSERT INTO chat_conversations (user_id, public_id, title)
      VALUES ($1, $2, 'Novo chat')
      RETURNING public_id, title, pinned, NULL::text AS plan_public_id, NULL::text AS plan_title, created_at, updated_at
    `,
    [resolvedUserId, randomUUID()],
  );

  return mapChatConversation(result.rows[0]);
}

export async function updateChatConversation(userId, publicId, input = {}) {
  const resolvedUserId = await requireUserId(userId);
  const hasTitle = typeof input.title === "string";
  const hasPinned = typeof input.pinned === "boolean";

  if (!hasTitle && !hasPinned) {
    throw new Error("chat update is required");
  }

  const title = hasTitle ? buildFallbackChatTitle(input.title) : null;

  if (hasTitle && title === "Novo chat" && !input.title.trim()) {
    throw new Error("chat title is required");
  }

  const result = await pool.query(
    `
      UPDATE chat_conversations
      SET
        title = CASE WHEN $3 THEN $4 ELSE title END,
        pinned = CASE WHEN $5 THEN $6 ELSE pinned END
      WHERE user_id = $1 AND public_id = $2
      RETURNING
        public_id,
        title,
        pinned,
        (SELECT public_id FROM plans WHERE id = chat_conversations.plan_id) AS plan_public_id,
        (SELECT title FROM plans WHERE id = chat_conversations.plan_id) AS plan_title,
        created_at,
        updated_at
    `,
    [resolvedUserId, publicId, hasTitle, title, hasPinned, input.pinned ?? false],
  );

  if (!result.rowCount) {
    throw new Error("chat not found");
  }

  return mapChatConversation(result.rows[0]);
}

export async function searchChatConversations(userId, query, limit = 12) {
  const resolvedUserId = await requireUserId(userId);
  const normalizedQuery = String(query ?? "").replace(/\s+/g, " ").trim();

  if (!normalizedQuery) {
    return [];
  }

  const safeLimit = Math.min(Math.max(Number.parseInt(String(limit ?? 12), 10) || 12, 1), 30);
  const pattern = `%${normalizedQuery}%`;
  const result = await pool.query(
    `
      WITH title_matches AS (
        SELECT
          c.public_id,
          c.title,
          c.title AS matched_text,
          c.updated_at AS matched_at,
          'title' AS match_type,
          1 AS priority
        FROM chat_conversations c
        WHERE c.user_id = $1 AND c.title ILIKE $2
      ),
      message_matches AS (
        SELECT DISTINCT ON (c.id)
          c.public_id,
          c.title,
          cm.content AS matched_text,
          cm.created_at AS matched_at,
          'message' AS match_type,
          2 AS priority
        FROM chat_conversations c
        INNER JOIN chat_messages cm ON cm.chat_id = c.id
        WHERE c.user_id = $1 AND cm.content ILIKE $2
        ORDER BY c.id, cm.created_at DESC, cm.id DESC
      )
      SELECT public_id, title, matched_text, matched_at, match_type
      FROM (
        SELECT DISTINCT ON (public_id)
          public_id,
          title,
          matched_text,
          matched_at,
          match_type,
          priority
        FROM (
          SELECT * FROM title_matches
          UNION ALL
          SELECT * FROM message_matches
        ) matches
        ORDER BY public_id, priority ASC, matched_at DESC
      ) ranked
      ORDER BY priority ASC, matched_at DESC
      LIMIT $3
    `,
    [resolvedUserId, pattern, safeLimit],
  );

  return result.rows.map(mapChatSearchResult);
}

export async function deleteChatConversation(userId, publicId) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      DELETE FROM chat_conversations
      WHERE user_id = $1 AND public_id = $2
    `,
    [resolvedUserId, publicId],
  );

  if (!result.rowCount) {
    throw new Error("chat not found");
  }
}

export async function listChatMessages(userId, publicId, limit = 20) {
  const resolvedUserId = await requireUserId(userId);
  const conversation = await getChatConversationByPublicId(resolvedUserId, publicId);

  if (!conversation) {
    throw new Error("chat not found");
  }

  const result = await pool.query(
    `
      SELECT
        recent.id,
        recent.chat_id,
        $2 AS chat_public_id,
        recent.role,
        recent.content,
        recent.provider,
        recent.model,
        recent.input_tokens,
        recent.output_tokens,
        recent.total_tokens,
        recent.request_count,
        recent.estimated_cost_usd,
        recent.created_at,
        pad.public_id AS plan_draft_public_id,
        pad.status AS plan_draft_status
      FROM (
        SELECT
          id,
          chat_id,
          role,
          content,
          provider,
          model,
          input_tokens,
          output_tokens,
          total_tokens,
          request_count,
          estimated_cost_usd,
          created_at
        FROM chat_messages
        WHERE user_id = $1 AND chat_id = $3
        ORDER BY created_at DESC, id DESC
        LIMIT $4
      ) recent
      LEFT JOIN plan_ai_drafts pad ON pad.assistant_message_id = recent.id
      ORDER BY recent.created_at ASC, recent.id ASC
    `,
    [resolvedUserId, conversation.public_id, conversation.id, limit],
  );

  return result.rows.map(mapChatMessage);
}

export async function listLatestChatMessages(userId, limit = 20) {
  const resolvedUserId = await requireUserId(userId);
  const conversation = await getLatestChatConversation(resolvedUserId);

  if (!conversation) {
    return [];
  }

  return listChatMessages(resolvedUserId, conversation.public_id, limit);
}

async function listChatContextTransactions(userId, limit = 40) {
  const resolvedUserId = await requireUserId(userId);
  const result = await pool.query(
    `
      SELECT
        t.id,
        t.description,
        t.amount,
        t.occurred_on,
        t.is_recurring,
        t.housing_id,
        t.installment_purchase_id,
        t.installment_number,
        ip.installment_count,
        c.label AS category_label,
        c.group_label,
        b.name AS account_name,
        b.account_type
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
      LIMIT $2
    `,
    [resolvedUserId, limit],
  );

  return result.rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: parseNumeric(row.amount),
    formattedAmount: formatCurrency(row.amount),
    occurredOn: normalizeDateValue(row.occurred_on),
    type: getTransactionTypeFromAmount(row.amount),
    categoryLabel: row.category_label,
    groupLabel: row.group_label,
    accountName: row.account_name,
    accountType: row.account_type,
    isRecurring: Boolean(row.is_recurring),
    isHousing: Boolean(row.housing_id),
    isInstallment: Boolean(row.installment_purchase_id),
    installmentNumber: row.installment_number ?? null,
    installmentCount: row.installment_count ?? null,
  }));
}

async function buildChatAdvisorContext(userId, recentChatMessages = []) {
  const resolvedUserId = await requireUserId(userId);
  const user = await getUserById(resolvedUserId);

  if (!user) {
    throw new Error("user not found");
  }

  const [summaryCards, banks, spendingByCategory, recentTransactions, housing, installmentsOverview, snapshots] =
    await Promise.all([
      getSummaryCards(resolvedUserId),
      listBanks(resolvedUserId),
      listSpendingByCategory(resolvedUserId),
      listChatContextTransactions(resolvedUserId),
      listHousing(resolvedUserId),
      getInstallmentsOverview(resolvedUserId),
      getReferenceMonth(resolvedUserId),
    ]);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    referenceMonth: normalizeDateValue(snapshots[0]?.month_start),
    summaryCards,
    banks,
    spendingByCategory,
    recentTransactions,
    housing,
    installments: {
      activeInstallmentsCount: installmentsOverview.activeInstallmentsCount,
      monthlyCommitment: installmentsOverview.monthlyCommitment,
      remainingBalanceTotal: installmentsOverview.remainingBalanceTotal,
      payoffProjectionMonth: installmentsOverview.payoffProjectionMonth,
      topItems: installmentsOverview.items.slice(0, 8),
    },
    recentChatMessages,
  };
}

async function insertChatMessage(userId, chatId, role, content, metadata = {}) {
  const result = await pool.query(
    `
      INSERT INTO chat_messages (
        user_id,
        chat_id,
        role,
        content,
        provider,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        request_count,
        estimated_cost_usd
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING
        id,
        chat_id,
        role,
        content,
        provider,
        model,
        input_tokens,
        output_tokens,
        total_tokens,
        request_count,
        estimated_cost_usd,
        created_at
    `,
    [
      userId,
      chatId,
      role,
      content,
      metadata.provider ?? null,
      metadata.model ?? null,
      metadata.inputTokens ?? null,
      metadata.outputTokens ?? null,
      metadata.totalTokens ?? null,
      metadata.requestCount ?? null,
      metadata.estimatedCostUsd ?? null,
    ],
  );

  const row = result.rows[0];

  await pool.query("DELETE FROM plan_chat_summaries WHERE user_id = $1 AND chat_id = $2", [userId, chatId]);

  return mapChatMessage(row);
}

async function updateChatConversationTitle(userId, chatId, title) {
  const normalizedTitle = buildFallbackChatTitle(title);
  const result = await pool.query(
    `
      UPDATE chat_conversations
      SET title = $3, updated_at = NOW()
      WHERE user_id = $1 AND id = $2
      RETURNING
        public_id,
        title,
        pinned,
        (SELECT public_id FROM plans WHERE id = chat_conversations.plan_id) AS plan_public_id,
        (SELECT title FROM plans WHERE id = chat_conversations.plan_id) AS plan_title,
        created_at,
        updated_at
    `,
    [userId, chatId, normalizedTitle],
  );

  return mapChatConversation(result.rows[0]);
}

async function touchChatConversation(userId, chatId) {
  const result = await pool.query(
    `
      UPDATE chat_conversations
      SET updated_at = NOW()
      WHERE user_id = $1 AND id = $2
      RETURNING
        public_id,
        title,
        pinned,
        (SELECT public_id FROM plans WHERE id = chat_conversations.plan_id) AS plan_public_id,
        (SELECT title FROM plans WHERE id = chat_conversations.plan_id) AS plan_title,
        created_at,
        updated_at
    `,
    [userId, chatId],
  );

  return mapChatConversation(result.rows[0]);
}

export async function createChatReply(userId, publicId, inputMessages) {
  const resolvedUserId = await requireUserId(userId);
  const conversation = await getChatConversationByPublicId(resolvedUserId, publicId);

  if (!conversation) {
    throw new Error("chat not found");
  }

  const messages = (Array.isArray(inputMessages) ? inputMessages : [inputMessages])
    .map((message) => String(message ?? "").trim())
    .filter(Boolean);

  if (!messages.length) {
    throw new Error("message is required");
  }

  const combinedMessage = messages.join("\n\n");
  const previousMessages = await listChatMessages(resolvedUserId, conversation.public_id, 12);
  const isFirstMessage = previousMessages.length === 0;
  const userMessages = [];

  for (const message of messages) {
    userMessages.push({
      ...(await insertChatMessage(resolvedUserId, conversation.id, "user", message)),
      chatId: conversation.public_id,
    });
  }

  const historyMessages = [...previousMessages, ...userMessages];
  const context = await buildChatAdvisorContext(resolvedUserId, historyMessages);
  const recentHistory = context.recentChatMessages.slice(-12).map((item) => ({
    role: item.role,
    content: item.content,
    createdAt: item.createdAt,
  }));
  const assistantReply = await generateChatReply({
    message: combinedMessage,
    generatedAt: new Date().toISOString(),
    context,
    history: recentHistory,
  });

  const assistantMessage = {
    ...(await insertChatMessage(resolvedUserId, conversation.id, "assistant", assistantReply.content, {
      provider: assistantReply.provider,
      model: assistantReply.model,
      inputTokens: assistantReply.usage?.inputTokens ?? null,
      outputTokens: assistantReply.usage?.outputTokens ?? null,
      totalTokens: assistantReply.usage?.totalTokens ?? null,
      requestCount: assistantReply.usage?.requestCount ?? null,
      estimatedCostUsd: assistantReply.estimatedCostUsd ?? null,
    })),
    chatId: conversation.public_id,
  };

  let chat = mapChatConversation(conversation);

  if (isFirstMessage) {
    try {
      const title = await generateChatTitle({
        message: combinedMessage,
        generatedAt: new Date().toISOString(),
      });
      chat = await updateChatConversationTitle(resolvedUserId, conversation.id, title.content);
    } catch {
      chat = await updateChatConversationTitle(resolvedUserId, conversation.id, buildFallbackChatTitle(messages[0]));
    }
  } else {
    chat = await touchChatConversation(resolvedUserId, conversation.id);
  }

  return {
    chat,
    userMessage: userMessages[0],
    userMessages,
    assistantMessage,
  };
}

export async function getDashboardData(userId, filters = {}) {
  const resolvedUserId = await requireUserId(userId);
  const user = await getUserById(resolvedUserId);
  const normalizedFilters = normalizeDashboardFilters(filters);

  if (!user) {
    throw new Error("user not found");
  }

  const [summaryCards, recentTransactions, spendingByCategory, banks, chatMessages, snapshots] =
    await Promise.all([
      normalizedFilters.active ? getDashboardSummaryCardsWithFilters(resolvedUserId, normalizedFilters) : getSummaryCards(resolvedUserId),
      listRecentTransactions(resolvedUserId, 8, normalizedFilters),
      listSpendingByCategory(resolvedUserId, normalizedFilters),
      listBanks(resolvedUserId),
      listLatestChatMessages(resolvedUserId),
      getReferenceMonth(resolvedUserId),
    ]);

  return {
    user,
    referenceMonth: normalizedFilters.active ? normalizedFilters.referenceDate.slice(0, 7) : normalizeDateValue(snapshots[0]?.month_start),
    summaryCards,
    recentTransactions,
    spendingByCategory,
    insights: [],
    banks,
    chatMessages,
  };
}

export async function closeDatabase() {
  await pool.end();
}
