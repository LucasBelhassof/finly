import type { Pool, PoolClient } from "pg";

import { db } from "../../shared/db.js";

type Queryable = Pick<Pool, "query"> | PoolClient;

export interface UserRecord {
  id: number;
  name: string;
  email: string | null;
  passwordHash: string | null;
  emailVerifiedAt: Date | null;
}

export interface SessionRecord {
  id: number;
  userId: number;
  sessionFamilyId: string;
  tokenHash: string;
  rememberMe: boolean;
  expiresAt: Date;
  lastUsedAt: Date | null;
  rotatedAt: Date | null;
  revokedAt: Date | null;
  replacedBySessionId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
  user: UserRecord | null;
}

export interface PasswordResetTokenRecord {
  id: number;
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  requestedIp: string | null;
  createdAt: Date;
  user: UserRecord | null;
}

function mapUser(row: Record<string, unknown>): UserRecord {
  return {
    id: Number(row.id),
    name: String(row.name),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    passwordHash: row.password_hash === null || row.password_hash === undefined ? null : String(row.password_hash),
    emailVerifiedAt: row.email_verified_at ? new Date(String(row.email_verified_at)) : null,
  };
}

function mapSession(row: Record<string, unknown>): SessionRecord {
  const hasUser = row.user_name !== undefined;

  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    sessionFamilyId: String(row.session_family_id),
    tokenHash: String(row.token_hash),
    rememberMe: Boolean(row.remember_me),
    expiresAt: new Date(String(row.expires_at)),
    lastUsedAt: row.last_used_at ? new Date(String(row.last_used_at)) : null,
    rotatedAt: row.rotated_at ? new Date(String(row.rotated_at)) : null,
    revokedAt: row.revoked_at ? new Date(String(row.revoked_at)) : null,
    replacedBySessionId:
      row.replaced_by_session_id === null || row.replaced_by_session_id === undefined
        ? null
        : Number(row.replaced_by_session_id),
    ipAddress: row.ip_address === null || row.ip_address === undefined ? null : String(row.ip_address),
    userAgent: row.user_agent === null || row.user_agent === undefined ? null : String(row.user_agent),
    createdAt: new Date(String(row.created_at)),
    updatedAt: new Date(String(row.updated_at)),
    user: hasUser
      ? {
          id: Number(row.user_id),
          name: String(row.user_name),
          email: row.user_email === null || row.user_email === undefined ? null : String(row.user_email),
          passwordHash:
            row.user_password_hash === null || row.user_password_hash === undefined ? null : String(row.user_password_hash),
          emailVerifiedAt: row.user_email_verified_at ? new Date(String(row.user_email_verified_at)) : null,
        }
      : null,
  };
}

function mapPasswordResetToken(row: Record<string, unknown>): PasswordResetTokenRecord {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    tokenHash: String(row.token_hash),
    expiresAt: new Date(String(row.expires_at)),
    usedAt: row.used_at ? new Date(String(row.used_at)) : null,
    requestedIp: row.requested_ip === null || row.requested_ip === undefined ? null : String(row.requested_ip),
    createdAt: new Date(String(row.created_at)),
    user:
      row.user_name !== undefined
        ? {
            id: Number(row.user_id),
            name: String(row.user_name),
            email: row.user_email === null || row.user_email === undefined ? null : String(row.user_email),
            passwordHash:
              row.user_password_hash === null || row.user_password_hash === undefined ? null : String(row.user_password_hash),
            emailVerifiedAt: row.user_email_verified_at ? new Date(String(row.user_email_verified_at)) : null,
          }
        : null,
  };
}

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>) {
  const client = await db.connect();

  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function findUserByEmail(email: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT id, name, email, password_hash, email_verified_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1
    `,
    [email],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function findUserById(userId: number, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT id, name, email, password_hash, email_verified_at
      FROM users
      WHERE id = $1
      LIMIT 1
    `,
    [userId],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function listUsersWithoutCredentials(client: Queryable = db) {
  const result = await client.query(
    `
      SELECT id, name, email, password_hash, email_verified_at
      FROM users
      WHERE email IS NULL OR password_hash IS NULL
      ORDER BY id ASC
    `,
  );

  return result.rows.map((row) => mapUser(row));
}

export async function createUser(
  input: {
    name: string;
    email: string;
    passwordHash: string;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO users (name, email, password_hash, updated_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, name, email, password_hash, email_verified_at
    `,
    [input.name, input.email, input.passwordHash],
  );

  return mapUser(result.rows[0]);
}

export async function attachCredentialsToUser(
  userId: number,
  input: {
    name: string;
    email: string;
    passwordHash: string;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      UPDATE users
      SET name = $2,
          email = $3,
          password_hash = $4,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, password_hash, email_verified_at
    `,
    [userId, input.name, input.email, input.passwordHash],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function updateUserPassword(userId: number, passwordHash: string, client: Queryable = db) {
  const result = await client.query(
    `
      UPDATE users
      SET password_hash = $2,
          updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, password_hash, email_verified_at
    `,
    [userId, passwordHash],
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
}

export async function createSession(
  input: {
    userId: number;
    sessionFamilyId: string;
    tokenHash: string;
    rememberMe: boolean;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO auth_sessions (
        user_id,
        session_family_id,
        token_hash,
        remember_me,
        expires_at,
        last_used_at,
        ip_address,
        user_agent,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, NOW())
      RETURNING *
    `,
    [
      input.userId,
      input.sessionFamilyId,
      input.tokenHash,
      input.rememberMe,
      input.expiresAt.toISOString(),
      input.ipAddress,
      input.userAgent,
    ],
  );

  return mapSession(result.rows[0]);
}

export async function findSessionByTokenHash(tokenHash: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT
        s.*,
        u.name AS user_name,
        u.email AS user_email,
        u.password_hash AS user_password_hash,
        u.email_verified_at AS user_email_verified_at
      FROM auth_sessions s
      INNER JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0] ? mapSession(result.rows[0]) : null;
}

export async function markSessionRotated(sessionId: number, replacedBySessionId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE auth_sessions
      SET rotated_at = NOW(),
          revoked_at = COALESCE(revoked_at, NOW()),
          replaced_by_session_id = $2,
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId, replacedBySessionId],
  );
}

export async function touchSession(sessionId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE auth_sessions
      SET last_used_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId],
  );
}

export async function revokeSession(sessionId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW()),
          updated_at = NOW()
      WHERE id = $1
    `,
    [sessionId],
  );
}

export async function revokeSessionFamily(sessionFamilyId: string, client: Queryable = db) {
  await client.query(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW()),
          updated_at = NOW()
      WHERE session_family_id = $1
        AND revoked_at IS NULL
    `,
    [sessionFamilyId],
  );
}

export async function revokeUserSessions(userId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE auth_sessions
      SET revoked_at = COALESCE(revoked_at, NOW()),
          updated_at = NOW()
      WHERE user_id = $1
        AND revoked_at IS NULL
    `,
    [userId],
  );
}

export async function createPasswordResetToken(
  input: {
    userId: number;
    tokenHash: string;
    expiresAt: Date;
    requestedIp: string | null;
  },
  client: Queryable = db,
) {
  const result = await client.query(
    `
      INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, requested_ip)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.userId, input.tokenHash, input.expiresAt.toISOString(), input.requestedIp],
  );

  return mapPasswordResetToken(result.rows[0]);
}

export async function findPasswordResetTokenByHash(tokenHash: string, client: Queryable = db) {
  const result = await client.query(
    `
      SELECT
        t.*,
        u.name AS user_name,
        u.email AS user_email,
        u.password_hash AS user_password_hash,
        u.email_verified_at AS user_email_verified_at
      FROM password_reset_tokens t
      INNER JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = $1
      LIMIT 1
    `,
    [tokenHash],
  );

  return result.rows[0] ? mapPasswordResetToken(result.rows[0]) : null;
}

export async function invalidateActivePasswordResetTokens(userId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE password_reset_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE user_id = $1
        AND used_at IS NULL
    `,
    [userId],
  );
}

export async function markPasswordResetTokenUsed(tokenId: number, client: Queryable = db) {
  await client.query(
    `
      UPDATE password_reset_tokens
      SET used_at = COALESCE(used_at, NOW())
      WHERE id = $1
    `,
    [tokenId],
  );
}

export async function insertAuditEvent(
  input: {
    userId?: number | null;
    email?: string | null;
    eventType: string;
    success?: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
  },
  client: Queryable = db,
) {
  await client.query(
    `
      INSERT INTO auth_audit_events (
        user_id,
        email,
        event_type,
        success,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
    `,
    [
      input.userId ?? null,
      input.email ?? null,
      input.eventType,
      input.success ?? true,
      input.ipAddress ?? null,
      input.userAgent ?? null,
      JSON.stringify(input.metadata ?? {}),
    ],
  );
}
