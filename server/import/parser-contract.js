function sanitizeParserWarning(warning) {
  const normalized = String(warning ?? "").trim();
  return normalized ? normalized.slice(0, 240) : null;
}

function sanitizeParserMetadata(metadata) {
  return metadata && typeof metadata === "object" ? metadata : {};
}

function normalizeCanonicalRow(row, index) {
  const normalizedRow = row && typeof row === "object" ? { ...row } : {};
  const amount = Number(normalizedRow.amount);
  const balanceAfter = normalizedRow.balanceAfter === null ? null : Number(normalizedRow.balanceAfter);
  const confidence =
    typeof normalizedRow.confidence === "number" && Number.isFinite(normalizedRow.confidence)
      ? normalizedRow.confidence
      : null;

  return {
    ...normalizedRow,
    rowId: String(normalizedRow.rowId ?? index + 1),
    occurredOn: normalizedRow.occurredOn ?? null,
    description: String(normalizedRow.description ?? "").trim(),
    amount: Number.isFinite(amount) ? amount : 0,
    currency: normalizedRow.currency ? String(normalizedRow.currency).trim() : null,
    balanceAfter: Number.isFinite(balanceAfter) ? balanceAfter : null,
    externalId: normalizedRow.externalId ? String(normalizedRow.externalId).trim() : null,
    sourceKindHint: normalizedRow.sourceKindHint ?? normalizedRow.sourceKind ?? null,
    confidence,
    issues: Array.isArray(normalizedRow.issues) ? normalizedRow.issues.filter(Boolean) : [],
    sourceRow: normalizedRow.sourceRow && typeof normalizedRow.sourceRow === "object" ? normalizedRow.sourceRow : {},
    rawMetadata:
      normalizedRow.rawMetadata && typeof normalizedRow.rawMetadata === "object" ? normalizedRow.rawMetadata : null,
    institutionName: normalizedRow.institutionName ? String(normalizedRow.institutionName).trim() : null,
    accountHint: normalizedRow.accountHint ?? normalizedRow.bankAccountHint ?? null,
    raw: normalizedRow.raw && typeof normalizedRow.raw === "object" ? normalizedRow.raw : {},
  };
}

export function normalizeCanonicalParserResult(parsedResult, parserEntry, detectedFileType) {
  const parsedObject =
    Array.isArray(parsedResult) || !parsedResult || typeof parsedResult !== "object"
      ? { rows: parsedResult }
      : parsedResult;
  const rows = (Array.isArray(parsedObject.rows) ? parsedObject.rows : []).map((row, index) =>
    normalizeCanonicalRow(row, index),
  );

  return {
    parserId: parsedObject.parserId ? String(parsedObject.parserId).trim() : parserEntry.parserId,
    parserLabel: parsedObject.parserLabel ? String(parsedObject.parserLabel).trim() : parserEntry.parserLabel,
    detectedFileType,
    rows,
    warnings: Array.isArray(parsedObject.warnings)
      ? parsedObject.warnings.map(sanitizeParserWarning).filter(Boolean)
      : [],
    metadata: sanitizeParserMetadata(parsedObject.metadata),
    sourceKind: parsedObject.sourceKind ?? null,
    sourceKindConfidence:
      typeof parsedObject.sourceKindConfidence === "number" && Number.isFinite(parsedObject.sourceKindConfidence)
        ? parsedObject.sourceKindConfidence
        : null,
    accountHint: parsedObject.accountHint ?? null,
  };
}
