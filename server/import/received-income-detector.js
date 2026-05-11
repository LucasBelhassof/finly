/**
 * Shared helper for detecting clearly-received-income transaction descriptions.
 * Used by both the fallback statement parser (sign inference) and the import
 * preview classifier (category/type resolution) so the canonical keyword list
 * lives in a single place.
 */

/**
 * Canonical list of keywords that indicate clearly received income.
 * Longer/more-specific entries must be listed before their shorter prefixes so
 * that callers iterating in order will match the most precise keyword first
 * (e.g. "ted recebido" wins over "ted").
 */
export const CLEARLY_RECEIVED_INCOME_KEYWORDS = [
  "pix recebido",
  "ted recebido",
  "doc recebido",
  "credito recebido",
  "credito em conta",
  "deposito recebido",
  "pagamento recebido",
  "transferencia recebida",
  "deposito",
  "reembolso",
  "estorno",
  "recebimento",
  "entrada",
];

/**
 * Returns true when `normalizedDescription` clearly indicates received income.
 *
 * Rules:
 *  - The description is matched against `CLEARLY_RECEIVED_INCOME_KEYWORDS`
 *    sorted longest-first, so "ted recebido" wins over the generic "ted".
 *  - "pagamento recebido" is excluded for `credit_card_statement` because it
 *    represents a bill payment made by the user, not inbound cash.
 *
 * @param {string} normalizedDescription  Already-normalized description (NFD-stripped, lowercase).
 * @param {{ importLayout?: string }} [options]
 * @returns {boolean}
 */
export function isClearlyReceivedIncomeDescription(normalizedDescription, { importLayout } = {}) {
  const normalized = String(normalizedDescription ?? "").trim();

  if (!normalized) {
    return false;
  }

  const sorted = [...CLEARLY_RECEIVED_INCOME_KEYWORDS].sort((a, b) => b.length - a.length);

  return sorted.some((pattern) => {
    if (pattern === "pagamento recebido" && importLayout === "credit_card_statement") {
      return false;
    }

    return normalized.includes(pattern);
  });
}
