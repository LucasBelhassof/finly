import { db } from "../../shared/db.js";
import { env } from "../../shared/env.js";
import { BadRequestError } from "../../shared/errors.js";
import {
  createImportedTransaction,
  getOrCreateInstallmentPurchase,
  listCategories,
  listHistoricalCategorizationRows,
  listRecurringCategorizationRules,
  upsertTransactionCategorizationRule,
} from "../../database.js";
import {
  addMonthsToOccurredOn,
  buildInstallmentPurchaseSeedKey,
  buildHistoricalCategorizationMatches,
  buildRecurringRuleMatches,
  extractInstallmentMetadata,
  normalizeDescription,
  resolveImportedTransactionCategory,
  stripInstallmentMarker,
} from "../../transaction-import.js";
import {
  deleteConnection,
  findConnectionsByUserId,
  setConnectionSynced,
  updateConnectionInstitution,
  upsertBankConnectionForPluggy,
  upsertConnection,
} from "./repository.js";
import { normalizeInstitution } from "./institution-mapping.js";
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

interface PluggyInstallmentContext {
  installmentPurchaseId: number | null;
  installmentNumber: number | null;
}

interface ExistingPluggyImportedTransaction {
  id: number;
  category_id: number;
  installment_purchase_id: number | null;
  installment_number: number | null;
}

async function findExistingPluggyInstallmentPurchase({
  userId,
  bankConnectionId,
  normalizedDescriptionBase,
  installmentCount,
  installmentNumber,
}: {
  userId: number;
  bankConnectionId: number;
  normalizedDescriptionBase: string;
  installmentCount: number;
  installmentNumber: number;
}): Promise<{ id: number; purchase_occurred_on: string | Date | null } | null> {
  const exactMatch = await db.query<{ id: number; purchase_occurred_on: string | Date | null }>(
    `
      SELECT ip.id, ip.purchase_occurred_on
      FROM installment_purchases ip
      WHERE ip.user_id = $1
        AND ip.bank_connection_id = $2
        AND ip.normalized_description_base = $3
        AND ip.installment_count = $4
        AND NOT EXISTS (
          SELECT 1
          FROM transactions t
          WHERE t.user_id = ip.user_id
            AND t.installment_purchase_id = ip.id
            AND t.installment_number = $5
        )
      ORDER BY ip.created_at DESC, ip.id DESC
      LIMIT 1
    `,
    [userId, bankConnectionId, normalizedDescriptionBase, installmentCount, installmentNumber],
  );

  return exactMatch.rows[0] ?? null;
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

async function resolvePluggyInstallmentContext(
  userId: number,
  bankConnectionId: number,
  categoryId: number,
  description: string,
  occurredOn: string,
  amount: number,
): Promise<PluggyInstallmentContext> {
  const installmentMetadata = extractInstallmentMetadata(description);

  if (
    !installmentMetadata.isInstallment ||
    !Number.isInteger(installmentMetadata.installmentIndex) ||
    !Number.isInteger(installmentMetadata.installmentCount)
  ) {
    return {
      installmentPurchaseId: null,
      installmentNumber: null,
    };
  }

  const descriptionBase = stripInstallmentMarker(description);
  const normalizedDescriptionBase = normalizeDescription(descriptionBase);

  if (!normalizedDescriptionBase) {
    return {
      installmentPurchaseId: null,
      installmentNumber: null,
    };
  }

  const purchaseOccurredOn = addMonthsToOccurredOn(occurredOn, 1 - installmentMetadata.installmentIndex);
  const existingInstallmentPurchase = await findExistingPluggyInstallmentPurchase({
    userId,
    bankConnectionId,
    normalizedDescriptionBase,
    installmentCount: installmentMetadata.installmentCount,
    installmentNumber: installmentMetadata.installmentIndex,
  });

  if (existingInstallmentPurchase) {
    const existingPurchaseOccurredOn = existingInstallmentPurchase.purchase_occurred_on
      ? String(existingInstallmentPurchase.purchase_occurred_on).slice(0, 10)
      : null;

    if (existingPurchaseOccurredOn && purchaseOccurredOn < existingPurchaseOccurredOn) {
      await db.query(
        `
          UPDATE installment_purchases
          SET purchase_occurred_on = $3,
              updated_at = NOW()
          WHERE user_id = $1
            AND id = $2
        `,
        [userId, existingInstallmentPurchase.id, purchaseOccurredOn],
      );
    }

    return {
      installmentPurchaseId: existingInstallmentPurchase.id,
      installmentNumber: installmentMetadata.installmentIndex,
    };
  }

  const seedKey = buildInstallmentPurchaseSeedKey(
    userId,
    bankConnectionId,
    purchaseOccurredOn,
    normalizedDescriptionBase,
    Math.abs(amount),
    installmentMetadata.installmentCount,
  );
  const installmentPurchase = await getOrCreateInstallmentPurchase({
    userId,
    bankConnectionId,
    categoryId,
    seedKey,
    descriptionBase,
    normalizedDescriptionBase,
    purchaseOccurredOn,
    installmentCount: installmentMetadata.installmentCount,
    amountPerInstallment: Math.abs(amount),
  });

  return {
    installmentPurchaseId: installmentPurchase?.id ?? null,
    installmentNumber: installmentMetadata.installmentIndex,
  };
}

async function findExistingPluggyImportedTransaction(
  userId: number,
  seedKey: string,
): Promise<ExistingPluggyImportedTransaction | null> {
  const existing = await db.query<ExistingPluggyImportedTransaction>(
    `
      SELECT id, category_id, installment_purchase_id, installment_number
      FROM transactions
      WHERE user_id = $1
        AND seed_key = $2
      LIMIT 1
    `,
    [userId, seedKey],
  );

  return existing.rows[0] ?? null;
}

async function upsertPluggyImportedTransaction({
  userId,
  bankConnectionId,
  categoryId,
  description,
  amount,
  occurredOn,
  seedKey,
  installmentPurchaseId,
  installmentNumber,
  existingTransaction,
}: {
  userId: number;
  bankConnectionId: number;
  categoryId: number;
  description: string;
  amount: number;
  occurredOn: string;
  seedKey: string;
  installmentPurchaseId: number | null;
  installmentNumber: number | null;
  existingTransaction: ExistingPluggyImportedTransaction | null;
}): Promise<boolean> {
  if (!existingTransaction) {
    const transaction = await createImportedTransaction({
      userId,
      bankConnectionId,
      categoryId,
      description,
      amount,
      occurredOn,
      seedKey,
      installmentPurchaseId,
      installmentNumber,
    });

    return Boolean(transaction);
  }

  const shouldUpdateInstallmentPurchaseId =
    Number.isInteger(installmentPurchaseId) &&
    Number(existingTransaction.installment_purchase_id ?? null) !== Number(installmentPurchaseId);
  const shouldUpdateInstallmentNumber =
    Number.isInteger(installmentNumber) &&
    Number(existingTransaction.installment_number ?? null) !== Number(installmentNumber);

  if (shouldUpdateInstallmentPurchaseId || shouldUpdateInstallmentNumber) {
    await db.query(
      `
        UPDATE transactions
        SET installment_purchase_id = $3,
            installment_number = $4
        WHERE user_id = $1
          AND id = $2
      `,
      [
        userId,
        existingTransaction.id,
        shouldUpdateInstallmentPurchaseId ? installmentPurchaseId : existingTransaction.installment_purchase_id,
        shouldUpdateInstallmentNumber ? installmentNumber : existingTransaction.installment_number,
      ],
    );
  }

  return false;
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
    const rawName = item.connector.name ?? null;
    const mapped = rawName ? normalizeInstitution(rawName) : null;
    // Only store a friendly name if we could map it; otherwise store null so
    // syncSingleItem can try per-account detection on the first sync.
    institutionName = mapped?.friendlyName ?? null;
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

    // Normalize institution name on every sync:
    // - If stored name maps to a friendly name → update and use it
    // - If stored name is unrecognized (no mapping) → clear it so account-level fallback can run
    // - If no name is stored → fetch from Pluggy API and attempt to map
    if (connection.institutionName) {
      const mapped = normalizeInstitution(connection.institutionName);
      if (mapped) {
        if (mapped.friendlyName !== connection.institutionName) {
          await updateConnectionInstitution(userId, connection.pluggyItemId, mapped.friendlyName, connection.institutionImageUrl);
          connection = { ...connection, institutionName: mapped.friendlyName };
        }
        // else: already normalized, nothing to do
      } else {
        // Stored name is unrecognized (e.g. "MeuPluggy" OFP aggregator).
        // Clear it so the per-account fallback below can detect the real institution.
        connection = { ...connection, institutionName: null };
      }
    } else {
      try {
        const item = await pluggyGet<{ id: string; connector: { name: string; imageUrl: string | null } }>(
          apiKey,
          `/items/${connection.pluggyItemId}`,
        );
        if (item.connector.name) {
          const rawName = item.connector.name;
          const mapped = normalizeInstitution(rawName);
          if (mapped) {
            await updateConnectionInstitution(userId, connection.pluggyItemId, mapped.friendlyName, item.connector.imageUrl ?? null);
            connection = { ...connection, institutionName: mapped.friendlyName, institutionImageUrl: item.connector.imageUrl ?? null };
          }
          // If unmappable connector name, leave institutionName null for per-account detection
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

    const institutionImageUrl = connection.institutionImageUrl;

    // Primary: map connector-level institution name
    let institutionMapping = connection.institutionName ? normalizeInstitution(connection.institutionName) : null;

    // Fallback: if connector name is an OFP aggregator (e.g. "MeuPluggy") and not a bank-level
    // connector, try to detect the institution from the first account's marketing/display name.
    if (!institutionMapping && accounts.results.length > 0) {
      for (const acct of accounts.results) {
        const candidate = acct.marketingName ?? acct.name;
        if (candidate) {
          const acctMapping = normalizeInstitution(candidate);
          if (acctMapping) {
            institutionMapping = acctMapping;
            await updateConnectionInstitution(userId, connection.pluggyItemId, acctMapping.friendlyName, institutionImageUrl);
            connection = { ...connection, institutionName: acctMapping.friendlyName };
            break;
          }
        }
      }
    }

    // Only propagate a verified (mapped) institution name to bank_connections.
    // Passing null means COALESCE keeps whatever good name was stored previously.
    const verifiedInstitutionName = institutionMapping?.friendlyName ?? null;
    const bankColor = institutionMapping?.color ?? "#3b82f6";
    const cardColor = institutionMapping?.color ?? "#a855f7";

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
        bankColor,
        null,
        null,
        verifiedInstitutionName,
        institutionImageUrl,
      );
      if (parentBankConnectionId === null) parentBankConnectionId = id;
    }

    // If the item has only CREDIT accounts (e.g. Nubank), auto-create a virtual
    // bank account so cards are always linked to a parent in the UI.
    const creditAccounts = accounts.results.filter((a) => a.type === "CREDIT");
    if (parentBankConnectionId === null && creditAccounts.length > 0) {
      const virtualName = verifiedInstitutionName ?? connection.institutionName ?? "Conta bancária";
      parentBankConnectionId = await upsertBankConnectionForPluggy(
        userId,
        connection.id,
        `__virtual__${connection.pluggyItemId}`,
        virtualName,
        "bank_account",
        0,
        bankColor,
        null,
        null,
        verifiedInstitutionName,
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
        cardColor,
        account.creditData?.creditLimit ?? null,
        parentBankConnectionId,
        verifiedInstitutionName,
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
        accountType === "credit_card" ? cardColor : bankColor,
        accountType === "credit_card" ? (account.creditData?.creditLimit ?? null) : null,
        accountType === "credit_card" ? parentBankConnectionId : null,
        verifiedInstitutionName,
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

  const inferredCategoryId = Number(categorization.category?.id ?? null);
  if (!Number.isInteger(inferredCategoryId)) {
    throw new Error(`Pluggy transaction category could not be resolved for ${tx.id}`);
  }

  const amount = categorization.type === "income" ? Math.abs(tx.amount) : -Math.abs(tx.amount);
  const seedKey = `pluggy:${tx.id}`;
  const occurredOn = tx.date.slice(0, 10);
  const existingTransaction = await findExistingPluggyImportedTransaction(userId, seedKey);
  const existingCategoryId = Number(existingTransaction?.category_id ?? null);
  const categoryId = Number.isInteger(existingCategoryId) ? existingCategoryId : inferredCategoryId;
  const installmentContext =
    accountType === "credit_card" && categorization.type === "expense"
      ? await resolvePluggyInstallmentContext(userId, bankConnectionId, categoryId, tx.description, occurredOn, amount)
      : { installmentPurchaseId: null, installmentNumber: null };
  const inserted = await upsertPluggyImportedTransaction({
    userId,
    bankConnectionId,
    categoryId,
    description: tx.description,
    amount,
    occurredOn,
    seedKey,
    installmentPurchaseId: installmentContext.installmentPurchaseId,
    installmentNumber: installmentContext.installmentNumber,
    existingTransaction,
  });

  if (!inserted) {
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
