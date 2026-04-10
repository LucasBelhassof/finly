import dotenv from "dotenv";
import pg from "pg";

import { runMigrations } from "./migrations.js";
import { runSeedData } from "./seed-data.js";
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
  await runSeedData(pool);
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
      SELECT
        b.id,
        b.slug,
        b.name,
        b.account_type,
        b.connected,
        b.color,
        b.current_balance,
        b.sort_order,
        b.parent_bank_connection_id,
        parent.name AS parent_account_name,
        b.statement_close_day,
        b.statement_due_day
      FROM bank_connections b
      LEFT JOIN bank_connections parent ON parent.id = b.parent_bank_connection_id
      WHERE b.user_id = $1
      ORDER BY
        COALESCE(b.parent_bank_connection_id, b.id) ASC,
        CASE WHEN b.account_type = 'credit_card' THEN 1 ELSE 0 END ASC,
        b.sort_order ASC,
        b.id ASC
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
    parentBankConnectionId: row.parent_bank_connection_id,
    parentAccountName: row.parent_account_name,
    statementCloseDay: row.statement_close_day,
    statementDueDay: row.statement_due_day,
  }));
}

export async function createBankConnection(input) {
  const user = await getPrimaryUser();
  const normalized = await validateBankConnectionInput(user.id, input);
  const [slug, sortOrder] = await Promise.all([
    buildUniqueBankSlug(user.id, normalized.name),
    getNextBankSortOrder(user.id),
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
        sort_order,
        parent_bank_connection_id,
        statement_close_day,
        statement_due_day
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `,
    [
      user.id,
      slug,
      normalized.name,
      normalized.accountType,
      normalized.connected,
      normalized.color,
      normalized.currentBalance,
      sortOrder,
      normalized.parentBankConnectionId,
      normalized.statementCloseDay,
      normalized.statementDueDay,
    ],
  );

  const created = await listBanks();
  const bank = created.find((item) => String(item.id) === String(result.rows[0].id));

  if (!bank) {
    throw new Error("bank connection not found after creation");
  }

  return bank;
}

export async function updateBankConnection(bankConnectionId, input) {
  const user = await getPrimaryUser();
  const existing = await getBankConnectionById(user.id, bankConnectionId);

  if (!existing) {
    throw new Error("bank connection not found");
  }

  const normalized = await validateBankConnectionInput(user.id, input, bankConnectionId);
  const hasChildren = await hasChildBankConnections(user.id, bankConnectionId);

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
          parent_bank_connection_id = $8,
          statement_close_day = $9,
          statement_due_day = $10,
          updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
    `,
    [
      user.id,
      bankConnectionId,
      normalized.name,
      normalized.accountType,
      normalized.connected,
      normalized.color,
      normalized.currentBalance,
      normalized.parentBankConnectionId,
      normalized.statementCloseDay,
      normalized.statementDueDay,
    ],
  );

  const updated = await listBanks();
  const bank = updated.find((item) => String(item.id) === String(bankConnectionId));

  if (!bank) {
    throw new Error("bank connection not found after update");
  }

  return bank;
}

export async function deleteBankConnection(bankConnectionId) {
  const user = await getPrimaryUser();
  const existing = await getBankConnectionById(user.id, bankConnectionId);

  if (!existing) {
    throw new Error("bank connection not found");
  }

  if (await hasChildBankConnections(user.id, bankConnectionId)) {
    throw new Error("delete linked cards before deleting the parent bank account");
  }

  if (await hasTransactionsForBankConnection(user.id, bankConnectionId)) {
    throw new Error("cannot delete a bank connection already used by transactions");
  }

  if (existing.account_type === "cash" && (await countCashBankConnections(user.id)) <= 1) {
    throw new Error("at least one cash account must remain");
  }

  const result = await pool.query(
    `
      DELETE FROM bank_connections
      WHERE user_id = $1
        AND id = $2
    `,
    [user.id, bankConnectionId],
  );

  if (!result.rowCount) {
    throw new Error("bank connection not found");
  }
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
        ip.installment_count,
        ip.purchase_occurred_on
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
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
    [user.id, hasLimit ? limit : null],
  );

  const referenceDate = normalizeDateValue(result.rows[0]?.occurred_on);
  return result.rows.map((row) => mapTransactionRow(row, referenceDate));
}

export async function getInstallmentsOverview(filters = {}) {
  const user = await getPrimaryUser();
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
    [user.id],
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

export async function listHousing() {
  const user = await getPrimaryUser();
  return getHousingRows(user.id);
}

export async function createHousing(input) {
  const user = await getPrimaryUser();
  const normalized = validateHousingInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [bankConnection, category] = await Promise.all([
      getBankConnectionById(user.id, normalized.bankConnectionId, client),
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
        user.id,
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

    await generateHousingTransactions(client, user.id, {
      id: result.rows[0].id,
      ...normalized,
      categoryId: category.id,
    });

    const [housing] = await getHousingRows(user.id, result.rows[0].id, client);
    await client.query("COMMIT");
    return housing;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateHousing(housingId, input) {
  const user = await getPrimaryUser();
  const normalized = validateHousingInput(input);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const [bankConnection, category] = await Promise.all([
      getBankConnectionById(user.id, normalized.bankConnectionId, client),
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
        user.id,
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

    await generateHousingTransactions(client, user.id, {
      id: housingId,
      ...normalized,
      categoryId: category.id,
    });

    const [housing] = await getHousingRows(user.id, housingId, client);
    await client.query("COMMIT");
    return housing;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteHousing(housingId) {
  const user = await getPrimaryUser();
  const result = await pool.query(
    `
      DELETE FROM housing
      WHERE user_id = $1
        AND id = $2
    `,
    [user.id, housingId],
  );

  if (!result.rowCount) {
    throw new Error("housing expense not found");
  }
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
      RETURNING id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color
    `,
    [categoryId, label, icon, color, groupSlug, groupLabel, groupColor],
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

async function getDefaultExpenseCategory(client = pool) {
  const result = await client.query(
    `
      SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color
      FROM categories
      WHERE transaction_type = 'expense'
        AND slug = 'outros-despesas'
      LIMIT 1
    `,
  );

  return result.rows[0] ?? null;
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
  const parentBankConnectionId = parseOptionalInteger(input.parentBankConnectionId);
  const statementCloseDay = validateStatementDay(parseOptionalInteger(input.statementCloseDay), "statementCloseDay");
  const statementDueDay = validateStatementDay(parseOptionalInteger(input.statementDueDay), "statementDueDay");

  if (!name || !accountType || !Number.isFinite(currentBalance)) {
    throw new Error("name, accountType and currentBalance are required");
  }

  if (accountType === "credit_card") {
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

export async function createTransaction(input) {
  const user = await getPrimaryUser();
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const bankConnectionId = Number(input.bankConnectionId);

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn and bankConnectionId are required");
  }

  const category = await resolveCategoryForTransactionInput(input.categoryId, amount);

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
    [user.id, bankConnectionId, category.id, description, amount, occurredOn],
  );

  const row = await getTransactionById(user.id, result.rows[0].id);
  return mapTransactionRow(row, occurredOn);
}

export async function updateTransaction(transactionId, input) {
  const user = await getPrimaryUser();
  const description = String(input.description ?? "").trim();
  const amount = Number(input.amount);
  const occurredOn = normalizeDateValue(input.occurredOn);
  const bankConnectionId = Number(input.bankConnectionId);

  if (!description || !Number.isFinite(amount) || !occurredOn || !Number.isInteger(bankConnectionId)) {
    throw new Error("description, amount, occurredOn and bankConnectionId are required");
  }

  const category = await resolveCategoryForTransactionInput(input.categoryId, amount);

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
    [user.id, transactionId, bankConnectionId, category.id, description, amount, occurredOn],
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

export async function previewTransactionImport(fileBuffer, importSource = "bank_statement", bankConnectionId, filename, contentType) {
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
      String(
        row.seed_key ??
          buildImportSeedKey(user.id, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
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
    filename,
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
  const sessionItemsByRowIndex = new Map(session.items.map((item) => [item.rowIndex, item.original]));

  const [categories, fingerprintRows] = await Promise.all([listCategories(), listTransactionFingerprintRows(user.id)]);
  const existingFingerprints = new Set(
    fingerprintRows.map((row) =>
      String(
        row.seed_key ??
          buildImportSeedKey(user.id, normalizeDateValue(row.occurred_on), parseNumeric(row.amount), normalizeDescription(row.description)),
      ),
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
            user.id,
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
              userId: user.id,
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
              ? buildInstallmentTransactionSeedKey(user.id, installmentPurchaseSeedKey, entry.installmentNumber)
              : buildImportSeedKey(
                  user.id,
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
              userId: user.id,
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
            userId: user.id,
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
