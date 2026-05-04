import { db } from "../../shared/db.js";
import { BadRequestError, HttpError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import { createSystemNotificationForUser } from "../notifications/service.js";
import {
  addDays,
  normalizeDateOnly,
  resolveInvoicePeriodForTransaction,
  resolveInvoiceStatus,
  roundCurrency,
  type InvoiceStatus,
} from "./dates.js";

export type InvoiceNotificationEventType = "invoice_closed" | "invoice_due_soon";

export interface InvoiceFilters {
  cardId?: unknown;
  referenceStart?: unknown;
  referenceEnd?: unknown;
  status?: unknown;
  categoryId?: unknown;
  search?: unknown;
}

export interface InvoiceSettingsInput {
  statementCloseDay?: unknown;
  statementDueDay?: unknown;
  notifyInvoiceClosed?: unknown;
  notifyInvoiceDueSoon?: unknown;
  invoiceDueReminderDays?: unknown;
}

type Queryable = {
  query: (
    text: string,
    params?: unknown[],
  ) => Promise<{
    rows: Array<Record<string, unknown>>;
    rowCount?: number | null;
  }>;
};

type TransactionRow = {
  transactionId: number;
  description: string;
  amount: number;
  occurredOn: string;
  isRecurring: boolean;
  housingId: number | null;
  installmentPurchaseId: number | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  purchaseOccurredOn: string | null;
  cardId: number;
  cardSlug: string;
  cardName: string;
  cardColor: string;
  statementCloseDay: number;
  statementDueDay: number;
  notifyInvoiceClosed: boolean;
  notifyInvoiceDueSoon: boolean;
  invoiceDueReminderDays: number;
  categoryId: number;
  categorySlug: string;
  categoryLabel: string;
  categoryIcon: string;
  categoryColor: string;
  groupSlug: string;
  groupLabel: string;
  groupColor: string;
};

type CreditCardRow = {
  id: number;
  slug: string;
  name: string;
  color: string;
  statementCloseDay: number;
  statementDueDay: number;
  notifyInvoiceClosed: boolean;
  notifyInvoiceDueSoon: boolean;
  invoiceDueReminderDays: number;
};

type NormalizedInvoiceFilters = {
  cardId: string;
  referenceStart: string | null;
  referenceEnd: string | null;
  status: InvoiceStatus | "all";
  categoryId: string;
  search: string;
};

const INVOICES_ROUTE = "/gestao-de-gastos/faturas";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(value: number) {
  return currencyFormatter.format(roundCurrency(value));
}

function normalizeText(value: unknown) {
  return String(value ?? "").toLocaleLowerCase("pt-BR");
}

function parseDateFilter(value: unknown, fieldName: "referenceStart" | "referenceEnd") {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestError("invalid_invoice_filter", `${fieldName} is invalid.`);
  }

  const normalized = normalizeDateOnly(value.trim());

  if (!normalized || normalized !== value.trim()) {
    throw new BadRequestError("invalid_invoice_filter", `${fieldName} is invalid.`);
  }

  const parsed = new Date(`${normalized}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new BadRequestError("invalid_invoice_filter", `${fieldName} is invalid.`);
  }

  return normalized;
}

function normalizeFilters(filters: InvoiceFilters = {}): NormalizedInvoiceFilters {
  const referenceStart = parseDateFilter(filters.referenceStart, "referenceStart");
  const referenceEnd = parseDateFilter(filters.referenceEnd, "referenceEnd");

  if (referenceStart && referenceEnd && referenceStart > referenceEnd) {
    throw new BadRequestError("invalid_invoice_filter", "The invoice reference date range is invalid.");
  }

  const status =
    filters.status === "open" ||
    filters.status === "closed" ||
    filters.status === "due_soon" ||
    filters.status === "overdue"
      ? filters.status
      : "all";

  return {
    cardId: filters.cardId && String(filters.cardId) !== "all" ? String(filters.cardId) : "all",
    referenceStart,
    referenceEnd,
    status,
    categoryId: filters.categoryId && String(filters.categoryId) !== "all" ? String(filters.categoryId) : "all",
    search: typeof filters.search === "string" ? filters.search.trim() : "",
  };
}

function mapCreditCardRow(row: Record<string, unknown>): CreditCardRow {
  return {
    id: Number(row.id),
    slug: String(row.slug),
    name: String(row.name),
    color: String(row.color ?? "bg-secondary"),
    statementCloseDay: Number(row.statement_close_day),
    statementDueDay: Number(row.statement_due_day),
    notifyInvoiceClosed: Boolean(row.notify_invoice_closed),
    notifyInvoiceDueSoon: Boolean(row.notify_invoice_due_soon),
    invoiceDueReminderDays: Number(row.invoice_due_reminder_days ?? 3),
  };
}

function mapTransactionRow(row: Record<string, unknown>): TransactionRow {
  return {
    transactionId: Number(row.transaction_id),
    description: String(row.description),
    amount: Number(row.amount),
    occurredOn: normalizeDateOnly(row.occurred_on) ?? "",
    isRecurring: Boolean(row.is_recurring),
    housingId: row.housing_id === null || row.housing_id === undefined ? null : Number(row.housing_id),
    installmentPurchaseId:
      row.installment_purchase_id === null || row.installment_purchase_id === undefined
        ? null
        : Number(row.installment_purchase_id),
    installmentNumber:
      row.installment_number === null || row.installment_number === undefined ? null : Number(row.installment_number),
    installmentCount:
      row.installment_count === null || row.installment_count === undefined ? null : Number(row.installment_count),
    purchaseOccurredOn: normalizeDateOnly(row.purchase_occurred_on),
    cardId: Number(row.card_id),
    cardSlug: String(row.card_slug),
    cardName: String(row.card_name),
    cardColor: String(row.card_color ?? "bg-secondary"),
    statementCloseDay: Number(row.statement_close_day),
    statementDueDay: Number(row.statement_due_day),
    notifyInvoiceClosed: Boolean(row.notify_invoice_closed),
    notifyInvoiceDueSoon: Boolean(row.notify_invoice_due_soon),
    invoiceDueReminderDays: Number(row.invoice_due_reminder_days ?? 3),
    categoryId: Number(row.category_id),
    categorySlug: String(row.category_slug),
    categoryLabel: String(row.category_label),
    categoryIcon: String(row.category_icon ?? ""),
    categoryColor: String(row.category_color ?? "text-muted-foreground"),
    groupSlug: String(row.group_slug ?? "outros"),
    groupLabel: String(row.group_label ?? "Outros"),
    groupColor: String(row.group_color ?? "bg-muted-foreground"),
  };
}

async function listUserCreditCards(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT
        id,
        slug,
        name,
        color,
        statement_close_day,
        statement_due_day,
        notify_invoice_closed,
        notify_invoice_due_soon,
        invoice_due_reminder_days
      FROM bank_connections
      WHERE user_id = $1
        AND account_type = 'credit_card'
        AND statement_close_day IS NOT NULL
        AND statement_due_day IS NOT NULL
      ORDER BY name ASC, id ASC
    `,
    [userId],
  );

  return result.rows.map(mapCreditCardRow);
}

async function listAllUserCreditCards(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT
        id,
        slug,
        name,
        color,
        statement_close_day,
        statement_due_day,
        notify_invoice_closed,
        notify_invoice_due_soon,
        invoice_due_reminder_days
      FROM bank_connections
      WHERE user_id = $1
        AND account_type = 'credit_card'
      ORDER BY name ASC, id ASC
    `,
    [userId],
  );

  return result.rows.map(mapCreditCardRow);
}

async function listPaidInvoiceKeys(userId: number, client: Queryable = db): Promise<Set<string>> {
  const result = await client.query(
    `
      SELECT bank_connection_id, invoice_period_end::text AS invoice_period_end
      FROM invoice_payments
      WHERE user_id = $1
    `,
    [userId],
  );

  const keys = result.rows.map((row) => `${row.bank_connection_id}:${String(row.invoice_period_end).slice(0, 10)}`);

  return new Set(keys);
}

async function listInvoiceTransactionRows(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT
        t.id AS transaction_id,
        t.description,
        t.amount,
        t.occurred_on,
        t.housing_id,
        t.installment_purchase_id,
        t.installment_number,
        t.is_recurring,
        ip.installment_count,
        ip.purchase_occurred_on,
        b.id AS card_id,
        b.slug AS card_slug,
        b.name AS card_name,
        b.color AS card_color,
        b.statement_close_day,
        b.statement_due_day,
        b.notify_invoice_closed,
        b.notify_invoice_due_soon,
        b.invoice_due_reminder_days,
        c.id AS category_id,
        c.slug AS category_slug,
        c.label AS category_label,
        c.icon AS category_icon,
        c.color AS category_color,
        c.group_slug,
        c.group_label,
        c.group_color
      FROM transactions t
      INNER JOIN bank_connections b ON b.id = t.bank_connection_id AND b.user_id = t.user_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      WHERE t.user_id = $1
        AND b.account_type = 'credit_card'
        AND t.amount < 0
        AND t.occurred_on IS NOT NULL
        AND t.housing_id IS NULL
      ORDER BY b.name ASC, t.occurred_on ASC, t.id ASC
    `,
    [userId],
  );

  return result.rows.map(mapTransactionRow).filter((row) => row.occurredOn);
}

function buildTransactionItem(row: TransactionRow) {
  const amount = roundCurrency(row.amount);

  return {
    id: row.transactionId,
    description: row.description,
    amount,
    formattedAmount: `${amount < 0 ? "- " : "+ "}${formatCurrency(Math.abs(amount))}`,
    occurredOn: row.occurredOn,
    relativeDate: row.occurredOn,
    isRecurring: row.isRecurring,
    isRecurringProjection: false,
    sourceTransactionId: row.transactionId,
    housingId: row.housingId,
    isInstallment: row.installmentPurchaseId !== null,
    installmentPurchaseId: row.installmentPurchaseId,
    installmentNumber: row.installmentNumber,
    installmentCount: row.installmentCount,
    purchaseOccurredOn: row.purchaseOccurredOn,
    category: {
      id: row.categoryId,
      slug: row.categorySlug,
      label: row.categoryLabel,
      icon: row.categoryIcon,
      color: row.categoryColor,
      groupSlug: row.groupSlug,
      groupLabel: row.groupLabel,
      groupColor: row.groupColor,
    },
    account: {
      id: row.cardId,
      slug: row.cardSlug,
      name: row.cardName,
      accountType: "credit_card",
      color: row.cardColor,
    },
  };
}

function matchesTransactionFilters(row: TransactionRow, filters: NormalizedInvoiceFilters) {
  if (filters.categoryId !== "all" && String(row.categoryId) !== filters.categoryId) {
    return false;
  }

  if (filters.search) {
    const searchTerm = normalizeText(filters.search);
    const searchableFields = [row.description, row.cardName, row.categoryLabel].map(normalizeText);

    if (!searchableFields.some((field) => field.includes(searchTerm))) {
      return false;
    }
  }

  return true;
}

function buildFilterOptions(rows: TransactionRow[], cards: CreditCardRow[], allCards: CreditCardRow[]) {
  const categories = Array.from(
    new Map(
      rows.map((row) => [
        String(row.categoryId),
        {
          id: row.categoryId,
          label: row.categoryLabel,
        },
      ]),
    ).values(),
  ).sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));

  // Use allCards for the filter dropdown so every registered credit card appears,
  // even ones without transactions in the current period.
  const filterCards = allCards.length > 0 ? allCards : cards;

  return {
    cards: filterCards.map((card) => ({ id: card.id, name: card.name })),
    categories,
    statuses: ["open", "closed", "due_soon", "overdue"] as InvoiceStatus[],
  };
}

export function buildInvoicesResponse(
  rows: TransactionRow[],
  cards: CreditCardRow[],
  rawFilters: InvoiceFilters = {},
  today: unknown = new Date(),
  paidKeys: Set<string> = new Set(),
  allCards: CreditCardRow[] = [],
) {
  const filters = normalizeFilters(rawFilters);
  const grouped = new Map<
    string,
    {
      card: CreditCardRow;
      periodStart: string;
      periodEnd: string;
      closingDate: string;
      dueDate: string;
      referenceMonth: string;
      referenceMonthLabel: string;
      status: InvoiceStatus;
      rows: TransactionRow[];
    }
  >();

  rows.forEach((row) => {
    const period = resolveInvoicePeriodForTransaction(row.occurredOn, row.statementCloseDay, row.statementDueDay);

    if (!period) {
      return;
    }

    const key = `${row.cardId}:${period.periodEnd}`;
    const card = {
      id: row.cardId,
      slug: row.cardSlug,
      name: row.cardName,
      color: row.cardColor,
      statementCloseDay: row.statementCloseDay,
      statementDueDay: row.statementDueDay,
      notifyInvoiceClosed: row.notifyInvoiceClosed,
      notifyInvoiceDueSoon: row.notifyInvoiceDueSoon,
      invoiceDueReminderDays: row.invoiceDueReminderDays,
    };

    if (!grouped.has(key)) {
      grouped.set(key, {
        card,
        ...period,
        status: resolveInvoiceStatus({
          closingDate: period.closingDate,
          dueDate: period.dueDate,
          reminderDays: row.invoiceDueReminderDays,
          today,
        }),
        rows: [],
      });
    }

    grouped.get(key)?.rows.push(row);
  });

  const invoices = Array.from(grouped.values())
    .filter((invoice) => {
      if (filters.cardId !== "all" && String(invoice.card.id) !== filters.cardId) {
        return false;
      }

      if (filters.status !== "all" && invoice.status !== filters.status) {
        return false;
      }

      if (filters.referenceStart && invoice.periodEnd < filters.referenceStart) {
        return false;
      }

      if (filters.referenceEnd && invoice.periodEnd > filters.referenceEnd) {
        return false;
      }

      return true;
    })
    .map((invoice) => {
      const filteredRows = invoice.rows.filter((row) => matchesTransactionFilters(row, filters));
      const totalAmount = roundCurrency(filteredRows.reduce((sum, row) => sum + Math.abs(row.amount), 0));
      const paidKey = `${invoice.card.id}:${invoice.periodEnd}`;

      return {
        id: `${invoice.card.id}-${invoice.periodEnd}`,
        card: {
          id: invoice.card.id,
          slug: invoice.card.slug,
          name: invoice.card.name,
          color: invoice.card.color,
          statementCloseDay: invoice.card.statementCloseDay,
          statementDueDay: invoice.card.statementDueDay,
          notifyInvoiceClosed: invoice.card.notifyInvoiceClosed,
          notifyInvoiceDueSoon: invoice.card.notifyInvoiceDueSoon,
          invoiceDueReminderDays: invoice.card.invoiceDueReminderDays,
        },
        referenceMonth: invoice.referenceMonth,
        referenceMonthLabel: invoice.referenceMonthLabel,
        periodStart: invoice.periodStart,
        periodEnd: invoice.periodEnd,
        closingDate: invoice.closingDate,
        dueDate: invoice.dueDate,
        status: invoice.status,
        isPaid: paidKeys.has(paidKey),
        totalAmount,
        formattedTotalAmount: formatCurrency(totalAmount),
        transactionCount: filteredRows.length,
        transactions: filteredRows
          .sort((left, right) => {
            const dateComparison = left.occurredOn.localeCompare(right.occurredOn);
            return dateComparison !== 0 ? dateComparison : left.transactionId - right.transactionId;
          })
          .map(buildTransactionItem),
      };
    })
    .filter((invoice) => invoice.transactionCount > 0)
    .sort((left, right) => {
      const statusRank = { overdue: 0, due_soon: 1, closed: 2, open: 3 } satisfies Record<InvoiceStatus, number>;
      const statusComparison = statusRank[left.status] - statusRank[right.status];

      if (statusComparison !== 0) {
        return statusComparison;
      }

      const dueComparison = left.dueDate.localeCompare(right.dueDate);
      return dueComparison !== 0 ? dueComparison : left.card.name.localeCompare(right.card.name, "pt-BR");
    });

  const totalFilteredAmount = roundCurrency(invoices.reduce((sum, invoice) => sum + invoice.totalAmount, 0));
  const activeCards = new Set(invoices.map((invoice) => String(invoice.card.id)));

  return {
    appliedFilters: filters,
    summary: {
      totalAmount: totalFilteredAmount,
      formattedTotalAmount: formatCurrency(totalFilteredAmount),
      dueSoonCount: invoices.filter((invoice) => invoice.status === "due_soon").length,
      overdueCount: invoices.filter((invoice) => invoice.status === "overdue").length,
      activeCardsCount: activeCards.size,
      invoiceCount: invoices.length,
    },
    filterOptions: buildFilterOptions(rows, cards, allCards),
    invoices,
  };
}

export async function listInvoicesForUser(userId: number, filters: InvoiceFilters = {}, today: unknown = new Date()) {
  const [cards, allCards, rows, paidKeys] = await Promise.all([
    listUserCreditCards(userId),
    listAllUserCreditCards(userId),
    listInvoiceTransactionRows(userId),
    listPaidInvoiceKeys(userId),
  ]);

  try {
    await generateInvoiceNotificationsForUser(userId, today, { cards, rows });
  } catch (error) {
    logger.error("failed to generate invoice notifications", { userId, error });
  }

  return buildInvoicesResponse(rows, cards, filters, today, paidKeys, allCards);
}

export async function markInvoicePaid(userId: number, cardId: number, periodEnd: string) {
  const normalized = normalizeDateOnly(periodEnd);

  if (!normalized) {
    throw new BadRequestError("invalid_period_end", "periodEnd must be a valid date (YYYY-MM-DD).");
  }

  const cardCheck = await db.query(
    `SELECT id FROM bank_connections WHERE id = $1 AND user_id = $2 AND account_type = 'credit_card' LIMIT 1`,
    [cardId, userId],
  );

  if (!cardCheck.rows[0]) {
    throw new HttpError(404, "card_not_found", "The credit card was not found.");
  }

  await db.query(
    `
      INSERT INTO invoice_payments (user_id, bank_connection_id, invoice_period_end)
      VALUES ($1, $2, $3::date)
      ON CONFLICT (user_id, bank_connection_id, invoice_period_end) DO NOTHING
    `,
    [userId, cardId, normalized],
  );
}

export async function unmarkInvoicePaid(userId: number, cardId: number, periodEnd: string) {
  const normalized = normalizeDateOnly(periodEnd);

  if (!normalized) {
    throw new BadRequestError("invalid_period_end", "periodEnd must be a valid date (YYYY-MM-DD).");
  }

  await db.query(
    `DELETE FROM invoice_payments WHERE user_id = $1 AND bank_connection_id = $2 AND invoice_period_end = $3::date`,
    [userId, cardId, normalized],
  );
}

function parseRequiredStatementDay(value: unknown, fieldName: "statementCloseDay" | "statementDueDay") {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    throw new BadRequestError("invalid_invoice_settings", `${fieldName} must be between 1 and 31.`);
  }

  return parsed;
}

function parseReminderDays(value: unknown) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 15) {
    throw new BadRequestError("invalid_invoice_settings", "invoiceDueReminderDays must be between 1 and 15.");
  }

  return parsed;
}

function parseBoolean(value: unknown, fallback: boolean) {
  if (typeof value === "boolean") {
    return value;
  }

  return fallback;
}

export async function updateInvoiceSettingsForCard(userId: number, cardId: number, input: InvoiceSettingsInput) {
  const existingResult = await db.query(
    `
      SELECT
        id,
        slug,
        name,
        color,
        account_type,
        statement_close_day,
        statement_due_day,
        notify_invoice_closed,
        notify_invoice_due_soon,
        invoice_due_reminder_days
      FROM bank_connections
      WHERE user_id = $1
        AND id = $2
      LIMIT 1
    `,
    [userId, cardId],
  );
  const existing = existingResult.rows[0];

  if (!existing) {
    throw new HttpError(404, "card_not_found", "The credit card was not found.");
  }

  if (existing.account_type !== "credit_card") {
    throw new BadRequestError("invalid_invoice_settings", "Invoice settings are available only for credit cards.");
  }

  const statementCloseDay =
    input.statementCloseDay === undefined
      ? Number(existing.statement_close_day)
      : parseRequiredStatementDay(input.statementCloseDay, "statementCloseDay");
  const statementDueDay =
    input.statementDueDay === undefined
      ? Number(existing.statement_due_day)
      : parseRequiredStatementDay(input.statementDueDay, "statementDueDay");
  const notifyInvoiceClosed = parseBoolean(input.notifyInvoiceClosed, Boolean(existing.notify_invoice_closed));
  const notifyInvoiceDueSoon = parseBoolean(input.notifyInvoiceDueSoon, Boolean(existing.notify_invoice_due_soon));
  const invoiceDueReminderDays =
    input.invoiceDueReminderDays === undefined
      ? Number(existing.invoice_due_reminder_days ?? 3)
      : parseReminderDays(input.invoiceDueReminderDays);

  const result = await db.query(
    `
      UPDATE bank_connections
      SET statement_close_day = $3,
          statement_due_day = $4,
          notify_invoice_closed = $5,
          notify_invoice_due_soon = $6,
          invoice_due_reminder_days = $7,
          updated_at = NOW()
      WHERE user_id = $1
        AND id = $2
      RETURNING
        id,
        slug,
        name,
        color,
        statement_close_day,
        statement_due_day,
        notify_invoice_closed,
        notify_invoice_due_soon,
        invoice_due_reminder_days
    `,
    [
      userId,
      cardId,
      statementCloseDay,
      statementDueDay,
      notifyInvoiceClosed,
      notifyInvoiceDueSoon,
      invoiceDueReminderDays,
    ],
  );

  return mapCreditCardRow(result.rows[0]);
}

function buildInvoiceNotificationCopy(
  invoice: ReturnType<typeof buildInvoicesResponse>["invoices"][number],
  eventType: InvoiceNotificationEventType,
) {
  if (eventType === "invoice_due_soon") {
    return {
      title: `Fatura vence em breve: ${invoice.card.name}`,
      message: `A fatura de ${invoice.referenceMonthLabel} vence em ${invoice.dueDate}. Total atual: ${invoice.formattedTotalAmount}.`,
    };
  }

  return {
    title: `Fatura fechada: ${invoice.card.name}`,
    message: `A fatura de ${invoice.referenceMonthLabel} fechou em ${invoice.closingDate}. Total atual: ${invoice.formattedTotalAmount}.`,
  };
}

async function createInvoiceNotificationEvent(
  userId: number,
  invoice: ReturnType<typeof buildInvoicesResponse>["invoices"][number],
  eventType: InvoiceNotificationEventType,
) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    const eventResult = await client.query(
      `
        INSERT INTO invoice_notification_events (
          user_id,
          bank_connection_id,
          invoice_period_end,
          event_type
        )
        VALUES ($1, $2, $3::date, $4)
        ON CONFLICT (user_id, bank_connection_id, invoice_period_end, event_type)
        DO NOTHING
        RETURNING id
      `,
      [userId, invoice.card.id, invoice.periodEnd, eventType],
    );
    const eventId = eventResult.rows[0]?.id;

    if (!eventId) {
      await client.query("ROLLBACK");
      return false;
    }

    const copy = buildInvoiceNotificationCopy(invoice, eventType);
    const notificationId = await createSystemNotificationForUser(
      userId,
      {
        title: copy.title,
        message: copy.message,
        category: "invoice_due",
        actionHref: INVOICES_ROUTE,
      },
      client,
    );

    await client.query(
      `
        UPDATE invoice_notification_events
        SET notification_id = $2
        WHERE id = $1
      `,
      [eventId, notificationId],
    );

    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function generateInvoiceNotificationsForUser(
  userId: number,
  now: unknown = new Date(),
  preload?: {
    cards: CreditCardRow[];
    rows: TransactionRow[];
  },
) {
  const today = normalizeDateOnly(now) ?? new Date().toISOString().slice(0, 10);
  const cards = preload?.cards ?? (await listUserCreditCards(userId));
  const rows = preload?.rows ?? (await listInvoiceTransactionRows(userId));
  const response = buildInvoicesResponse(rows, cards, {}, today);
  let createdCount = 0;

  for (const invoice of response.invoices) {
    const dueSoonStart = addDays(invoice.dueDate, -invoice.card.invoiceDueReminderDays) ?? invoice.dueDate;

    if (invoice.card.notifyInvoiceClosed && today >= invoice.closingDate) {
      const created = await createInvoiceNotificationEvent(userId, invoice, "invoice_closed");
      createdCount += created ? 1 : 0;
    }

    if (invoice.card.notifyInvoiceDueSoon && today >= dueSoonStart && today <= invoice.dueDate) {
      const created = await createInvoiceNotificationEvent(userId, invoice, "invoice_due_soon");
      createdCount += created ? 1 : 0;
    }
  }

  return { createdCount };
}
