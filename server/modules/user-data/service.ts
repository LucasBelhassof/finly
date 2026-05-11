import argon2 from "argon2";

import { ForbiddenError, UnauthorizedError } from "../../shared/errors.js";
import { insertAuditEvent } from "../auth/repository.js";
import {
  executeAccountDeletion,
  queryFullAccountExport,
  queryTransactionsForExport,
  queryUserForPasswordVerification,
} from "./repository.js";
import type { AuthRequestMetadata } from "../auth/service.js";
import type { FullAccountExport, TransactionExportRow } from "./types.js";

export async function getUserTransactionsForExport(userId: number): Promise<TransactionExportRow[]> {
  return queryTransactionsForExport(userId);
}

export async function getUserFullExport(userId: number): Promise<FullAccountExport> {
  const data = await queryFullAccountExport(userId);

  if (!data) {
    throw new UnauthorizedError("user_not_found", "User not found.");
  }

  return data;
}

export async function deleteUserAccount(
  userId: number,
  currentPassword: string,
  context: AuthRequestMetadata,
): Promise<void> {
  const user = await queryUserForPasswordVerification(userId);

  if (!user) {
    throw new UnauthorizedError("user_not_found", "User not found.");
  }

  if (!user.passwordHash) {
    throw new ForbiddenError("no_password", "This account has no password set.");
  }

  const isValid = await argon2.verify(user.passwordHash, currentPassword);

  if (!isValid) {
    throw new ForbiddenError("invalid_password", "Invalid password.");
  }

  await insertAuditEvent({
    userId,
    email: user.email,
    eventType: "account_deleted",
    success: true,
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  await executeAccountDeletion(userId);
}

const CSV_DANGEROUS_CHARS = ["=", "+", "-", "@", "\t", "\r"];

export function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const str = String(value);
  const escaped = CSV_DANGEROUS_CHARS.some((c) => str.startsWith(c)) ? `'${str}` : str;

  if (escaped.includes(",") || escaped.includes('"') || escaped.includes("\n")) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }

  return escaped;
}

export function buildTransactionsCsv(rows: TransactionExportRow[]): string {
  const header = "date,description,amount,type,category,account,createdAt";

  const dataRows = rows.map((row) =>
    [
      escapeCsvField(row.date),
      escapeCsvField(row.description),
      escapeCsvField(row.amount),
      escapeCsvField(row.type),
      escapeCsvField(row.category),
      escapeCsvField(row.account),
      escapeCsvField(row.createdAt),
    ].join(","),
  );

  return [header, ...dataRows].join("\n");
}
