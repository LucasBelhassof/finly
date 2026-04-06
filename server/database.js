import dotenv from "dotenv";
import pg from "pg";

import { runMigrations } from "./migrations.js";

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
      SELECT id, slug, name, connected, color, current_balance, sort_order
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
        c.slug AS category_slug,
        c.label AS category_label,
        c.icon AS category_icon,
        c.color AS category_color
      FROM transactions t
      INNER JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
      LIMIT $2
    `,
    [user.id, limit],
  );

  const referenceDate = normalizeDateValue(result.rows[0]?.occurred_on);

  return result.rows.map((row) => ({
    id: row.id,
    description: row.description,
    amount: parseNumeric(row.amount),
    formattedAmount: `${parseNumeric(row.amount) < 0 ? "- " : "+ "}${formatCurrency(Math.abs(parseNumeric(row.amount)))}`,
    occurredOn: normalizeDateValue(row.occurred_on),
    relativeDate: referenceDate ? formatRelativeDate(row.occurred_on, referenceDate) : normalizeDateValue(row.occurred_on),
    category: {
      slug: row.category_slug,
      label: row.category_label,
      icon: row.category_icon,
      color: row.category_color,
    },
  }));
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
