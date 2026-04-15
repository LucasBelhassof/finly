const KNOWN_INSTITUTION_COLORS: Array<{ matches: string[]; color: string }> = [
  { matches: ["nubank", "nu bank", "roxinho"], color: "#8a05be" },
  { matches: ["itau", "itaú"], color: "#ff7a00" },
  { matches: ["bradesco"], color: "#cc092f" },
  { matches: ["santander"], color: "#ec0000" },
  { matches: ["banco do brasil", "bb"], color: "#ffdd00" },
  { matches: ["caixa", "caixa economica", "caixa econômica"], color: "#0066b3" },
  { matches: ["inter", "banco inter"], color: "#ff7a00" },
  { matches: ["c6", "c6 bank"], color: "#111111" },
  { matches: ["neon"], color: "#00d8ff" },
  { matches: ["picpay"], color: "#21c25e" },
  { matches: ["pagbank", "pagseguro"], color: "#00a650" },
  { matches: ["mercado pago", "mercadopago"], color: "#00b1ea" },
  { matches: ["sicredi"], color: "#64b22b" },
  { matches: ["sicoob"], color: "#003641" },
  { matches: ["btg", "btg pactual"], color: "#1f4aa8" },
  { matches: ["xp"], color: "#111111" },
  { matches: ["bmg"], color: "#ff7a00" },
];

export const ACCOUNT_COLOR_PRESETS = [
  "#3b82f6",
  "#22c55e",
  "#ef4444",
  "#06b6d4",
  "#f59e0b",
  "#f97316",
  "#a855f7",
  "#8a05be",
  "#ff7a00",
  "#cc092f",
  "#0066b3",
  "#111111",
] as const;

function normalizeInstitutionName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getDefaultAccountColor(accountType: "bank_account" | "credit_card" | "cash") {
  if (accountType === "cash") {
    return "#f59e0b";
  }

  if (accountType === "credit_card") {
    return "#a855f7";
  }

  return "#3b82f6";
}

export function getKnownInstitutionColor(name: string, accountType: "bank_account" | "credit_card" | "cash") {
  if (accountType === "cash") {
    return null;
  }

  const normalizedName = normalizeInstitutionName(name);

  if (!normalizedName) {
    return null;
  }

  const match = KNOWN_INSTITUTION_COLORS.find((institution) =>
    institution.matches.some((keyword) => normalizedName.includes(normalizeInstitutionName(keyword))),
  );

  return match?.color ?? null;
}

export function getSuggestedAccountColor(name: string, accountType: "bank_account" | "credit_card" | "cash") {
  return getKnownInstitutionColor(name, accountType) ?? getDefaultAccountColor(accountType);
}
