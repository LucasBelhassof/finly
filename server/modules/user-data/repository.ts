import type { PoolClient } from "pg";

import { db } from "../../shared/db.js";
import type { FullAccountExport, ProfileExport, TransactionExportRow, UserForPasswordVerification } from "./types.js";

type Queryable = Pick<typeof db, "query"> | PoolClient;

export async function queryTransactionsForExport(
  userId: number,
  client: Queryable = db,
): Promise<TransactionExportRow[]> {
  const result = await client.query(
    `
      SELECT
        t.occurred_on::text AS date,
        t.description,
        t.amount::text AS amount,
        COALESCE(c.transaction_type, 'expense') AS type,
        COALESCE(c.label, '') AS category,
        b.name AS account,
        t.created_at AT TIME ZONE 'UTC' AS created_at
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
      WHERE t.user_id = $1
      ORDER BY t.occurred_on DESC, t.id DESC
    `,
    [userId],
  );

  return result.rows.map((row) => ({
    date: String(row.date),
    description: String(row.description),
    amount: String(row.amount),
    type: String(row.type),
    category: String(row.category),
    account: row.account === null || row.account === undefined ? null : String(row.account),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  }));
}

export async function queryProfileForExport(userId: number, client: Queryable = db): Promise<ProfileExport | null> {
  const result = await client.query(
    `
      SELECT
        id,
        name,
        email,
        phone,
        address_street,
        address_number,
        address_complement,
        address_neighborhood,
        address_city,
        address_state,
        address_postal_code,
        address_country,
        is_premium,
        premium_since,
        onboarding_completed_at,
        created_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    name: String(row.name),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    phone: row.phone === null || row.phone === undefined ? null : String(row.phone),
    addressStreet: row.address_street === null || row.address_street === undefined ? null : String(row.address_street),
    addressNumber: row.address_number === null || row.address_number === undefined ? null : String(row.address_number),
    addressComplement:
      row.address_complement === null || row.address_complement === undefined ? null : String(row.address_complement),
    addressNeighborhood:
      row.address_neighborhood === null || row.address_neighborhood === undefined
        ? null
        : String(row.address_neighborhood),
    addressCity: row.address_city === null || row.address_city === undefined ? null : String(row.address_city),
    addressState: row.address_state === null || row.address_state === undefined ? null : String(row.address_state),
    addressPostalCode:
      row.address_postal_code === null || row.address_postal_code === undefined
        ? null
        : String(row.address_postal_code),
    addressCountry:
      row.address_country === null || row.address_country === undefined ? null : String(row.address_country),
    isPremium: Boolean(row.is_premium),
    premiumSince:
      row.premium_since === null || row.premium_since === undefined
        ? null
        : new Date(String(row.premium_since)).toISOString(),
    onboardingCompletedAt:
      row.onboarding_completed_at === null || row.onboarding_completed_at === undefined
        ? null
        : new Date(String(row.onboarding_completed_at)).toISOString(),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
  };
}

async function querySimpleUserTable(
  tableName: string,
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  const result = await client.query(`SELECT * FROM ${tableName} WHERE user_id = $1 ORDER BY id ASC`, [userId]);
  return result.rows as Record<string, unknown>[];
}

export async function queryBankConnectionsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("bank_connections", userId, client);
}

export async function queryCategoriesForExport(client: Queryable = db): Promise<Record<string, unknown>[]> {
  const result = await client.query(`SELECT * FROM categories ORDER BY sort_order ASC, id ASC`);
  return result.rows as Record<string, unknown>[];
}

export async function queryHousingForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("housing", userId, client);
}

export async function queryInstallmentPurchasesForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("installment_purchases", userId, client);
}

export async function queryMonthlySummariesForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("monthly_summaries", userId, client);
}

export async function queryInsightsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("insights", userId, client);
}

export async function queryInvestmentsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  return querySimpleUserTable("investments", userId, client);
}

export async function queryPlansForExport(userId: number, client: Queryable = db): Promise<Record<string, unknown>[]> {
  const plansResult = await client.query(`SELECT * FROM plans WHERE user_id = $1 ORDER BY id ASC`, [userId]);

  const plans = plansResult.rows as Record<string, unknown>[];

  if (plans.length === 0) {
    return [];
  }

  const planIds = plans.map((p) => Number(p.id));
  const placeholders = planIds.map((_, i) => `$${i + 1}`).join(", ");

  const [itemsResult, assessmentsResult, recommendationsResult] = await Promise.all([
    client.query(
      `SELECT * FROM plan_items WHERE plan_id IN (${placeholders}) ORDER BY sort_order ASC, id ASC`,
      planIds,
    ),
    client
      .query(`SELECT * FROM plan_ai_assessments WHERE plan_id IN (${placeholders}) ORDER BY id ASC`, planIds)
      .catch(() => ({ rows: [] as Record<string, unknown>[] })),
    client
      .query(`SELECT * FROM plan_recommendations WHERE plan_id IN (${placeholders}) ORDER BY id ASC`, planIds)
      .catch(() => ({ rows: [] as Record<string, unknown>[] })),
  ]);

  const itemsByPlan = new Map<number, Record<string, unknown>[]>();
  const assessmentsByPlan = new Map<number, Record<string, unknown>[]>();
  const recommendationsByPlan = new Map<number, Record<string, unknown>[]>();

  for (const row of itemsResult.rows as Record<string, unknown>[]) {
    const pid = Number(row.plan_id);
    if (!itemsByPlan.has(pid)) itemsByPlan.set(pid, []);
    itemsByPlan.get(pid)!.push(row);
  }

  for (const row of assessmentsResult.rows as Record<string, unknown>[]) {
    const pid = Number(row.plan_id);
    if (!assessmentsByPlan.has(pid)) assessmentsByPlan.set(pid, []);
    assessmentsByPlan.get(pid)!.push(row);
  }

  for (const row of recommendationsResult.rows as Record<string, unknown>[]) {
    const pid = Number(row.plan_id);
    if (!recommendationsByPlan.has(pid)) recommendationsByPlan.set(pid, []);
    recommendationsByPlan.get(pid)!.push(row);
  }

  return plans.map((plan) => {
    const pid = Number(plan.id);
    return {
      ...plan,
      items: itemsByPlan.get(pid) ?? [],
      aiAssessments: assessmentsByPlan.get(pid) ?? [],
      recommendations: recommendationsByPlan.get(pid) ?? [],
    };
  });
}

export async function queryChatConversationsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  const convsResult = await client.query(`SELECT * FROM chat_conversations WHERE user_id = $1 ORDER BY id ASC`, [
    userId,
  ]);

  const conversations = convsResult.rows as Record<string, unknown>[];

  if (conversations.length === 0) {
    return [];
  }

  const messagesResult = await client.query(
    `SELECT id, chat_id, role, content, created_at FROM chat_messages WHERE user_id = $1 ORDER BY id ASC`,
    [userId],
  );

  const messagesByChat = new Map<number, Record<string, unknown>[]>();

  for (const row of messagesResult.rows as Record<string, unknown>[]) {
    const cid = Number(row.chat_id);
    if (!messagesByChat.has(cid)) messagesByChat.set(cid, []);
    messagesByChat.get(cid)!.push(row);
  }

  return conversations.map((conv) => ({
    ...conv,
    messages: messagesByChat.get(Number(conv.id)) ?? [],
  }));
}

export async function queryNotificationsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  const result = await client.query(
    `
      SELECT n.*, nr.is_read, nr.read_at, nr.dismissed_at
      FROM notification_recipients nr
      INNER JOIN notifications n ON n.id = nr.notification_id
      WHERE nr.user_id = $1
      ORDER BY n.id DESC
    `,
    [userId],
  );

  return result.rows as Record<string, unknown>[];
}

export async function queryAiUsageEventsForExport(
  userId: number,
  client: Queryable = db,
): Promise<Record<string, unknown>[]> {
  const result = await client
    .query(`SELECT * FROM ai_usage_events WHERE user_id = $1 ORDER BY id ASC`, [userId])
    .catch(() => ({ rows: [] as Record<string, unknown>[] }));

  return result.rows as Record<string, unknown>[];
}

export async function queryFullAccountExport(userId: number): Promise<FullAccountExport | null> {
  const profile = await queryProfileForExport(userId);

  if (!profile) {
    return null;
  }

  const [
    bankConnections,
    categories,
    transactions,
    housing,
    installmentPurchases,
    monthlySummaries,
    insights,
    investments,
    plans,
    chatConversations,
    notifications,
    aiUsageEvents,
  ] = await Promise.all([
    queryBankConnectionsForExport(userId),
    queryCategoriesForExport(),
    queryTransactionsForExport(userId),
    queryHousingForExport(userId),
    queryInstallmentPurchasesForExport(userId),
    queryMonthlySummariesForExport(userId),
    queryInsightsForExport(userId),
    queryInvestmentsForExport(userId),
    queryPlansForExport(userId),
    queryChatConversationsForExport(userId),
    queryNotificationsForExport(userId),
    queryAiUsageEventsForExport(userId),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: "1",
    profile,
    bankConnections,
    categories,
    transactions: transactions as unknown as Record<string, unknown>[],
    housing,
    installmentPurchases,
    monthlySummaries,
    insights,
    investments,
    plans,
    chatConversations,
    notifications,
    aiUsageEvents,
  };
}

export async function queryUserForPasswordVerification(
  userId: number,
  client: Queryable = db,
): Promise<UserForPasswordVerification | null> {
  const result = await client.query(`SELECT id, email, password_hash FROM users WHERE id = $1 LIMIT 1`, [userId]);

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    id: Number(row.id),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    passwordHash: row.password_hash === null || row.password_hash === undefined ? null : String(row.password_hash),
  };
}

export async function executeAccountDeletion(userId: number): Promise<void> {
  const client = await db.connect();

  try {
    await client.query("BEGIN");

    // Delete in FK-safe order (leaf → root)
    await client.query(`DELETE FROM plan_chat_summaries WHERE plan_id IN (SELECT id FROM plans WHERE user_id = $1)`, [
      userId,
    ]);
    await client.query(`DELETE FROM plan_ai_assessments WHERE plan_id IN (SELECT id FROM plans WHERE user_id = $1)`, [
      userId,
    ]);
    await client.query(`DELETE FROM plan_recommendations WHERE plan_id IN (SELECT id FROM plans WHERE user_id = $1)`, [
      userId,
    ]);
    await client.query(`DELETE FROM plan_items WHERE plan_id IN (SELECT id FROM plans WHERE user_id = $1)`, [userId]);
    await client.query(`DELETE FROM plans WHERE user_id = $1`, [userId]);

    await client.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM chat_conversations WHERE user_id = $1`, [userId]);

    await client.query(`DELETE FROM ai_usage_events WHERE user_id = $1`, [userId]).catch(() => undefined);
    await client.query(`DELETE FROM import_preview_sessions WHERE user_id = $1`, [userId]).catch(() => undefined);

    await client.query(`DELETE FROM notification_recipients WHERE user_id = $1`, [userId]).catch(() => undefined);

    await client.query(`DELETE FROM insights WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM monthly_summaries WHERE user_id = $1`, [userId]);

    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM installment_purchases WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM housing WHERE user_id = $1`, [userId]);
    await client.query(`DELETE FROM investments WHERE user_id = $1`, [userId]).catch(() => undefined);
    await client.query(`DELETE FROM bank_connections WHERE user_id = $1`, [userId]);

    await client.query(`DELETE FROM password_reset_tokens WHERE user_id = $1`, [userId]);

    // Revoke all active sessions
    await client.query(
      `UPDATE auth_sessions SET revoked_at = COALESCE(revoked_at, NOW()), updated_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
    await client.query(`DELETE FROM auth_sessions WHERE user_id = $1`, [userId]);

    // Anonymize audit events (preserve audit trail, remove PII link)
    await client.query(`UPDATE auth_audit_events SET user_id = NULL WHERE user_id = $1`, [userId]);

    // Finally delete the user
    await client.query(`DELETE FROM users WHERE id = $1`, [userId]);

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
