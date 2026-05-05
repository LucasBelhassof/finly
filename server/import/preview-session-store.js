import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 500;
const PREVIEW_KIND = "transaction_import";
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
let cleanupStartedAtMs = 0;
let cleanupPromise = null;

class PreviewStoreHttpError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function toPreviewStoreNotFoundError() {
  return new PreviewStoreHttpError(404, "import_preview_not_found", "Preview inválido ou expirado.");
}

function toCommittedPreviewError() {
  return new PreviewStoreHttpError(
    409,
    "import_preview_already_committed",
    "Esta prévia já foi utilizada. Gere uma nova prévia para continuar.",
  );
}

function toExpiredPreviewError() {
  return new PreviewStoreHttpError(
    400,
    "import_preview_expired",
    "A prévia expirou. Gere a prévia novamente para continuar.",
  );
}

function normalizePreviewToken(previewToken) {
  return String(previewToken ?? "").trim();
}

function normalizeUserId(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) ? normalized : null;
}

function resolveExpiresAtMs(sourceValue, ttlMs = DEFAULT_TTL_MS) {
  const normalized = Number(sourceValue);
  if (Number.isInteger(normalized) && normalized > Date.now()) {
    return normalized;
  }

  return Date.now() + ttlMs;
}

function sanitizeStoredMetadata(metadata) {
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const sanitized = { ...metadata };
  delete sanitized.userId;
  return sanitized;
}

function normalizeEntry(row) {
  if (!row) {
    return null;
  }

  const payload = row.payload && typeof row.payload === "object" ? row.payload : {};

  return {
    id: String(row.id),
    userId: Number(row.user_id),
    kind: row.kind ?? PREVIEW_KIND,
    payload: {
      metadata: payload.metadata ?? null,
      session: payload.session ?? null,
    },
    expiresAtMs: Date.parse(row.expires_at),
    committedAt: row.committed_at ? new Date(row.committed_at).toISOString() : null,
  };
}

function isEntryUsable(entry) {
  return Boolean(entry && !entry.committedAt && Number.isFinite(entry.expiresAtMs) && entry.expiresAtMs > Date.now());
}

async function getPreviewEntry(previewToken) {
  const key = normalizePreviewToken(previewToken);

  if (!key) {
    return null;
  }

  const result = await pool.query(
    `
      SELECT id, user_id, kind, payload, expires_at, committed_at
      FROM import_preview_sessions
      WHERE id = $1
      LIMIT 1
    `,
    [key],
  );

  return normalizeEntry(result.rows[0] ?? null);
}

async function savePreviewEntry({ previewToken, userId, metadata, session, expiresAtMs }) {
  const key = normalizePreviewToken(previewToken);
  const normalizedUserId = normalizeUserId(userId);

  if (!key || normalizedUserId === null) {
    throw new Error("Preview session requires a previewToken and userId.");
  }

  const sanitizedMetadata = sanitizeStoredMetadata(metadata);

  await pool.query(
    `
      INSERT INTO import_preview_sessions (
        id,
        user_id,
        kind,
        payload,
        expires_at,
        committed_at,
        created_at,
        updated_at
      )
      VALUES (
        $1,
        $2,
        $3,
        jsonb_build_object('metadata', $4::jsonb, 'session', $5::jsonb),
        to_timestamp($6::double precision / 1000.0),
        NULL,
        NOW(),
        NOW()
      )
      ON CONFLICT (id) DO UPDATE
      SET
        user_id = EXCLUDED.user_id,
        kind = EXCLUDED.kind,
        payload = EXCLUDED.payload,
        expires_at = EXCLUDED.expires_at,
        updated_at = NOW()
    `,
    [
      key,
      normalizedUserId,
      PREVIEW_KIND,
      JSON.stringify(sanitizedMetadata),
      JSON.stringify(session ?? null),
      expiresAtMs,
    ],
  );
}

function resolveEntryUserId(currentEntry, metadata, session) {
  return normalizeUserId(session?.userId) ?? normalizeUserId(metadata?.userId) ?? normalizeUserId(currentEntry?.userId);
}

function assertPreviewSessionAccess(entry, userId) {
  if (!entry) {
    throw toPreviewStoreNotFoundError();
  }

  if (entry.userId !== Number(userId)) {
    throw toPreviewStoreNotFoundError();
  }

  if (entry.committedAt) {
    throw toCommittedPreviewError();
  }

  if (!Number.isFinite(entry.expiresAtMs) || entry.expiresAtMs <= Date.now()) {
    throw toExpiredPreviewError();
  }
}

async function getStoredSession(previewToken, userId, expectedKind = null) {
  const entry = await getPreviewEntry(previewToken);
  const session = entry?.payload?.session ?? null;

  if (!session || (expectedKind && session.kind !== expectedKind)) {
    throw toPreviewStoreNotFoundError();
  }

  assertPreviewSessionAccess(entry, userId);
  return session;
}

async function deleteExpiredPreviewBatch() {
  const result = await pool.query(
    `
      WITH expired_candidates AS (
        SELECT id
        FROM import_preview_sessions
        WHERE expires_at < NOW() - INTERVAL '24 hours'
        ORDER BY expires_at ASC
        LIMIT $1
      )
      DELETE FROM import_preview_sessions AS previews
      USING expired_candidates
      WHERE previews.id = expired_candidates.id
    `,
    [CLEANUP_BATCH_SIZE],
  );

  return result.rowCount ?? 0;
}

async function deleteCommittedPreviewBatch() {
  const result = await pool.query(
    `
      WITH committed_candidates AS (
        SELECT id
        FROM import_preview_sessions
        WHERE committed_at IS NOT NULL
          AND committed_at < NOW() - INTERVAL '7 days'
        ORDER BY committed_at ASC
        LIMIT $1
      )
      DELETE FROM import_preview_sessions AS previews
      USING committed_candidates
      WHERE previews.id = committed_candidates.id
    `,
    [CLEANUP_BATCH_SIZE],
  );

  return result.rowCount ?? 0;
}

export async function cleanupExpiredImportPreviews({ force = false } = {}) {
  const now = Date.now();

  if (!force && cleanupStartedAtMs > 0 && now - cleanupStartedAtMs < CLEANUP_INTERVAL_MS) {
    return { skipped: true, deletedExpiredCount: 0, deletedCommittedCount: 0 };
  }

  if (cleanupPromise) {
    return cleanupPromise;
  }

  cleanupStartedAtMs = now;
  cleanupPromise = (async () => {
    const deletedExpiredCount = await deleteExpiredPreviewBatch();
    const deletedCommittedCount = await deleteCommittedPreviewBatch();

    return {
      skipped: false,
      deletedExpiredCount,
      deletedCommittedCount,
    };
  })();

  try {
    return await cleanupPromise;
  } finally {
    cleanupPromise = null;
  }
}

export async function closeImportPreviewStore() {
  await pool.end();
}

export async function setLegacyPreviewSession(previewToken, session, ttlMs = DEFAULT_TTL_MS) {
  const currentEntry = await getPreviewEntry(previewToken);
  const metadata = currentEntry?.payload?.metadata ?? null;
  const userId = resolveEntryUserId(currentEntry, metadata, session);

  await savePreviewEntry({
    previewToken,
    userId,
    metadata,
    session,
    expiresAtMs: resolveExpiresAtMs(session?.expiresAtMs, ttlMs),
  });
}

export async function getLegacyPreviewSession(previewToken, userId) {
  return getStoredSession(previewToken, userId);
}

export async function setUniversalPreviewMetadata(previewToken, metadata, ttlMs = DEFAULT_TTL_MS) {
  const currentEntry = await getPreviewEntry(previewToken);
  const session = currentEntry?.payload?.session ?? null;
  const userId = resolveEntryUserId(currentEntry, metadata, session);

  await savePreviewEntry({
    previewToken,
    userId,
    metadata,
    session,
    expiresAtMs: resolveExpiresAtMs(currentEntry?.expiresAtMs, ttlMs),
  });
}

export async function setUniversalPreviewSession(previewToken, session, ttlMs = DEFAULT_TTL_MS) {
  const currentEntry = await getPreviewEntry(previewToken);
  const metadata = currentEntry?.payload?.metadata ?? null;
  const userId = resolveEntryUserId(currentEntry, metadata, session);

  await savePreviewEntry({
    previewToken,
    userId,
    metadata,
    session,
    expiresAtMs: resolveExpiresAtMs(session?.expiresAtMs, ttlMs),
  });
}

export async function getUniversalPreviewMetadata(previewToken) {
  const entry = await getPreviewEntry(previewToken);

  if (!isEntryUsable(entry)) {
    return null;
  }

  return entry.payload.metadata ?? null;
}

export async function hasUniversalPreviewSession(previewToken) {
  const entry = await getPreviewEntry(previewToken);
  return isEntryUsable(entry) && entry?.payload?.session?.kind === "universal";
}

export async function getUniversalPreviewSession(previewToken, userId) {
  return getStoredSession(previewToken, userId, "universal");
}

export async function markImportPreviewSessionCommitted(previewToken) {
  const key = normalizePreviewToken(previewToken);

  if (!key) {
    return;
  }

  await pool.query(
    `
      UPDATE import_preview_sessions
      SET committed_at = NOW(), updated_at = NOW()
      WHERE id = $1
        AND committed_at IS NULL
    `,
    [key],
  );
}

export async function deleteUniversalPreviewSession(previewToken) {
  await markImportPreviewSessionCommitted(previewToken);
}
