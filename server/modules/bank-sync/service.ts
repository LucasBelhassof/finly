import { db } from "../../shared/db.js";
import { env } from "../../shared/env.js";
import { BadRequestError } from "../../shared/errors.js";
import {
  listCategories,
  listHistoricalCategorizationRows,
  listRecurringCategorizationRules,
  upsertTransactionCategorizationRule,
} from "../../database.js";
import {
  buildHistoricalCategorizationMatches,
  buildRecurringRuleMatches,
  resolveImportedTransactionCategory,
} from "../../transaction-import.js";
import {
  deleteConnection,
  findConnectionsByUserId,
  setConnectionSynced,
  updateConnectionInstitution,
  upsertBankConnectionForPluggy,
  upsertConnection,
} from "./repository.js";
import type {
  PluggyAccount,
  PluggyApiKey,
  PluggyConnection,
  PluggyConnectionStatus,
  PluggyConnectToken,
  PluggySyncResult,
  PluggyTransaction,
  PluggyTransactionsPage,
} from "./types.js";

const PLUGGY_API = "https://api.pluggy.ai";

// ── Pluggy API helpers ─────────────────────────────────────────────────────

async function getApiKey(): Promise<string> {
  const response = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: env.pluggy.clientId,
      clientSecret: env.pluggy.clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy auth failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as PluggyApiKey;
  return data.apiKey;
}

async function pluggyGet<T>(apiKey: string, path: string): Promise<T> {
  const response = await fetch(`${PLUGGY_API}${path}`, {
    headers: { "X-API-KEY": apiKey },
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy GET ${path} failed: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

type TransactionCategory = Awaited<ReturnType<typeof listCategories>>[number];

interface PluggyCategorizationContext {
  categories: TransactionCategory[];
  defaultExpenseCategoryId: number;
  defaultIncomeCategoryId: number;
  historicalMatches: ReturnType<typeof buildHistoricalCategorizationMatches>;
  recurringRuleMatches: ReturnType<typeof buildRecurringRuleMatches>;
}

async function loadPluggyCategorizationContext(userId: number): Promise<PluggyCategorizationContext> {
  const [categories, historicalRows, recurringRules] = await Promise.all([
    listCategories(),
    listHistoricalCategorizationRows(userId),
    listRecurringCategorizationRules(userId),
  ]);

  const defaultExpenseCategory = categories.find(
    (category) => category.transactionType === "expense" && category.slug === "outros-despesas",
  );
  const defaultIncomeCategory = categories.find(
    (category) => category.transactionType === "income" && category.slug === "salario",
  );

  if (!defaultExpenseCategory) {
    throw new Error("Default expense category not found");
  }

  if (!defaultIncomeCategory) {
    throw new Error("Default income category not found");
  }

  return {
    categories,
    defaultExpenseCategoryId: Number(defaultExpenseCategory.id),
    defaultIncomeCategoryId: Number(defaultIncomeCategory.id),
    historicalMatches: buildHistoricalCategorizationMatches(historicalRows),
    recurringRuleMatches: buildRecurringRuleMatches(recurringRules),
  };
}

// ── Public service functions ───────────────────────────────────────────────

/** Returns a short-lived Connect Token for the Pluggy Connect Widget. */
export async function createConnectToken(userId: number): Promise<string> {
  if (!env.pluggy.clientId || !env.pluggy.clientSecret) {
    throw new BadRequestError("pluggy_not_configured", "Pluggy integration is not configured.");
  }

  const apiKey = await getApiKey();

  const response = await fetch(`${PLUGGY_API}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ clientUserId: String(userId) }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Pluggy connect_token failed: ${response.status} ${text}`);
  }

  const data = (await response.json()) as PluggyConnectToken;
  return data.accessToken;
}

/** Saves a Pluggy item connection for a user and triggers an initial sync for that item only. */
export async function connectItem(
  userId: number,
  pluggyItemId: string,
): Promise<PluggySyncResult> {
  if (!env.pluggy.clientId || !env.pluggy.clientSecret) {
    throw new BadRequestError("pluggy_not_configured", "Pluggy integration is not configured.");
  }

  // Fetch item metadata so we can store institution name + logo
  let institutionName: string | null = null;
  let institutionImageUrl: string | null = null;
  try {
    const apiKey = await getApiKey();
    const item = await pluggyGet<{ id: string; connector: { name: string; imageUrl: string | null } }>(
      apiKey,
      `/items/${pluggyItemId}`,
    );
    institutionName = item.connector.name ?? null;
    institutionImageUrl = item.connector.imageUrl ?? null;
  } catch {
    // Non-critical: proceed with null metadata, will be backfilled on next sync
  }

  const connection = await upsertConnection(userId, pluggyItemId, institutionName, institutionImageUrl);

  return syncSingleItem(userId, connection);
}

/** Returns the current Pluggy connection status for a user. */
export async function getConnectionStatus(userId: number): Promise<PluggyConnectionStatus> {
  const connections = await findConnectionsByUserId(userId);

  if (!connections.length) {
    return { connected: false, connectionCount: 0, lastSyncAt: null, lastError: null, connections: [] };
  }

  // Aggregate: most recent sync, any error
  let latestSyncAt: string | null = null;
  let anyError: string | null = null;

  for (const c of connections) {
    if (c.lastSyncAt) {
      const iso = c.lastSyncAt.toISOString();
      if (!latestSyncAt || iso > latestSyncAt) latestSyncAt = iso;
    }
    if (c.lastError && !anyError) anyError = c.lastError;
  }

  return {
    connected: true,
    connectionCount: connections.length,
    lastSyncAt: latestSyncAt,
    lastError: anyError,
    connections: connections.map((c) => ({
      pluggyItemId: c.pluggyItemId,
      institutionName: c.institutionName,
      institutionImageUrl: c.institutionImageUrl,
      lastSyncAt: c.lastSyncAt ? c.lastSyncAt.toISOString() : null,
      lastError: c.lastError,
    })),
  };
}

/** Syncs all accounts and transactions from Pluggy for a user (all connected items). */
export async function syncTransactions(userId: number): Promise<PluggySyncResult> {
  const connections = await findConnectionsByUserId(userId);

  if (!connections.length) {
    throw new BadRequestError("no_pluggy_connection", "No Pluggy connection found.");
  }

  let imported = 0;
  let skipped = 0;
  let totalAccounts = 0;

  // Sync each connection independently; one failure doesn't abort the rest.
  for (const connection of connections) {
    try {
      const result = await syncSingleItem(userId, connection);
      imported += result.imported;
      skipped += result.skipped;
      totalAccounts += result.accounts;
    } catch {
      // Error already recorded in setConnectionSynced inside syncSingleItem
    }
  }

  return { imported, skipped, accounts: totalAccounts };
}

/** Syncs a single Pluggy item (bank connection). */
async function syncSingleItem(userId: number, connection: PluggyConnection): Promise<PluggySyncResult> {
  let imported = 0;
  let skipped = 0;

  try {
    const apiKey = await getApiKey();

    // Backfill institution metadata if missing (e.g. existing connections before this migration)
    if (!connection.institutionName) {
      try {
        const item = await pluggyGet<{ id: string; connector: { name: string; imageUrl: string | null } }>(
          apiKey,
          `/items/${connection.pluggyItemId}`,
        );
        if (item.connector.name) {
          await updateConnectionInstitution(userId, connection.pluggyItemId, item.connector.name, item.connector.imageUrl ?? null);
          connection = { ...connection, institutionName: item.connector.name, institutionImageUrl: item.connector.imageUrl ?? null };
        }
      } catch {
        // Non-critical backfill failure
      }
    }

    const accounts = await pluggyGet<{ total: number; results: PluggyAccount[] }>(
      apiKey,
      `/accounts?itemId=${connection.pluggyItemId}`,
    );

    const categorizationContext = await loadPluggyCategorizationContext(userId);

    const institutionName = connection.institutionName;
    const institutionImageUrl = connection.institutionImageUrl;

    // Pass 1: upsert BANK accounts first so credit cards can reference them as parent
    let parentBankConnectionId: number | null = null;
    const bankAccounts = accounts.results.filter((a) => a.type !== "CREDIT");
    for (const account of bankAccounts) {
      const id = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        "bank_account",
        account.balance,
        "bg-blue-500",
        null,
        null,
        institutionName,
        institutionImageUrl,
      );
      if (parentBankConnectionId === null) parentBankConnectionId = id;
    }

    // If the item has only CREDIT accounts (e.g. Nubank), auto-create a virtual
    // bank account so cards are always linked to a parent in the UI.
    const creditAccounts = accounts.results.filter((a) => a.type === "CREDIT");
    if (parentBankConnectionId === null && creditAccounts.length > 0) {
      const virtualName = institutionName ?? "Banco";
      parentBankConnectionId = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        `__virtual__${connection.pluggyItemId}`,
        virtualName,
        "bank_account",
        0,
        "bg-blue-500",
        null,
        null,
        institutionName,
        institutionImageUrl,
      );
    }

    // Pass 2: upsert CREDIT accounts linked to the parent bank account
    for (const account of creditAccounts) {
      await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        "credit_card",
        account.balance,
        "bg-purple-500",
        account.creditData?.creditLimit ?? null,
        parentBankConnectionId,
        institutionName,
        institutionImageUrl,
      );
    }

    // Pass 3: import transactions for all accounts
    for (const account of accounts.results) {
      const accountType = account.type === "CREDIT" ? "credit_card" : "bank_account";

      const bankConnectionId = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        account.id,
        account.marketingName ?? account.name,
        accountType,
        account.balance,
        accountType === "credit_card" ? "bg-purple-500" : "bg-blue-500",
        accountType === "credit_card" ? (account.creditData?.creditLimit ?? null) : null,
        accountType === "credit_card" ? parentBankConnectionId : null,
        institutionName,
        institutionImageUrl,
      );

      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const txPage = await pluggyGet<PluggyTransactionsPage>(
          apiKey,
          `/transactions?accountId=${account.id}&pageSize=100&page=${page}`,
        );

        totalPages = txPage.totalPages;

        for (const tx of txPage.results) {
          const result = await importTransaction(
            userId,
            bankConnectionId,
            tx,
            accountType,
            categorizationContext,
          );
          if (result) imported++;
          else skipped++;
        }

        page++;
        if (page > 5) break;
      }
    }

    await setConnectionSynced(userId, connection.pluggyItemId, null);

    return { imported, skipped, accounts: accounts.results.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await setConnectionSynced(userId, connection.pluggyItemId, message);
    throw error;
  }
}

/** Removes the Pluggy connection for a user. Does not affect existing transactions. */
export async function disconnectPluggy(userId: number): Promise<void> {
  await deleteConnection(userId);
}

// ── Internal helpers ───────────────────────────────────────────────────────

/**
 * Inserts a single Pluggy transaction using seed_key for deduplication.
 * Returns true if inserted, false if skipped (duplicate).
 */
async function importTransaction(
  userId: number,
  bankConnectionId: number,
  tx: PluggyTransaction,
  accountType: string,
  categorizationContext: PluggyCategorizationContext,
): Promise<boolean> {
  const isCredit = tx.type === "CREDIT";
  const inferredType = accountType === "credit_card"
    ? (isCredit ? "income" : "expense")
    : (isCredit ? "income" : "expense");
  const importSource = accountType === "credit_card" ? "credit_card_statement" : "bank_statement";
  const categorization = resolveImportedTransactionCategory({
    categories: categorizationContext.categories,
    defaultExpenseCategoryId: categorizationContext.defaultExpenseCategoryId,
    defaultIncomeCategoryId: categorizationContext.defaultIncomeCategoryId,
    description: tx.description,
    historicalMatches: categorizationContext.historicalMatches,
    importSource,
    recurringRuleMatches: categorizationContext.recurringRuleMatches,
    type: inferredType,
  });

  if (categorization.exclude) {
    return false;
  }

  const categoryId = Number(categorization.category?.id ?? null);
  if (!Number.isInteger(categoryId)) {
    throw new Error(`Pluggy transaction category could not be resolved for ${tx.id}`);
  }

  const amount = categorization.type === "income" ? Math.abs(tx.amount) : -Math.abs(tx.amount);
  const seedKey = `pluggy:${tx.id}`;
  const occurredOn = tx.date.slice(0, 10);

  const result = await db.query<{ id: number }>(
    `INSERT INTO transactions
       (user_id, bank_connection_id, category_id, description, amount, occurred_on, seed_key)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, seed_key) DO NOTHING
     RETURNING id`,
    [userId, bankConnectionId, categoryId, tx.description, amount, occurredOn, seedKey],
  );

  if ((result.rowCount ?? 0) === 0) {
    return false;
  }

  if (categorization.matchKey) {
    await upsertTransactionCategorizationRule({
      userId,
      matchKey: categorization.matchKey,
      type: categorization.type,
      categoryId,
    });
  }

  return true;
}
