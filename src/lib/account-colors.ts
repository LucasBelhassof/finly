const KNOWN_INSTITUTION_COLORS: Array<{ matches: string[]; color: string }> = [
  { matches: ["nubank", "nu bank", "nu pagamentos"], color: "#8a05be" },
  { matches: ["itau", "itaú", "itau unibanco", "unibanco"], color: "#ff7a00" },
  { matches: ["bradesco"], color: "#cc092f" },
  { matches: ["santander"], color: "#ec0000" },
  { matches: ["banco do brasil"], color: "#ffdd00" },
  { matches: ["caixa", "caixa economica", "caixa econômica", "cef"], color: "#0066b3" },
  { matches: ["banco inter", "inter s a", "inter sa"], color: "#ff7a00" },
  { matches: ["c6 bank", "banco c6", "c6 s a"], color: "#1d1d1b" },
  { matches: ["neon pagamentos", "banco neon", "neon"], color: "#00d8ff" },
  { matches: ["picpay"], color: "#21c25e" },
  { matches: ["pagbank", "pagseguro", "pag bank", "pag seguro"], color: "#00a650" },
  { matches: ["mercado pago", "mercadopago"], color: "#00b1ea" },
  { matches: ["sicredi"], color: "#64b22b" },
  { matches: ["sicoob"], color: "#003641" },
  { matches: ["btg pactual", "btg"], color: "#1f4aa8" },
  { matches: ["xp investimentos", "xp inc", "banco xp", "xp"], color: "#1a1a1a" },
  { matches: ["banco bmg", "bmg"], color: "#e30613" },
  { matches: ["banco original", "original"], color: "#00863c" },
  { matches: ["banco safra", "safra"], color: "#0a3d8f" },
  { matches: ["banco votorantim", "bv financeira", "bv banco", "bv"], color: "#ff6600" },
  { matches: ["stone"], color: "#00a868" },
  { matches: ["creditas"], color: "#00c08b" },
  { matches: ["banco pan", "pan financiadora"], color: "#0070c0" },
  { matches: ["banco next", "next bank", "next"], color: "#00c4b0" },
  { matches: ["will bank", "will fintech"], color: "#ffd400" },
  { matches: ["agibank", "agi bank"], color: "#c800d2" },
  { matches: ["bs2", "banco bs2"], color: "#0069b4" },
  { matches: ["daycoval"], color: "#e0500a" },
  { matches: ["banco modal", "modal mais"], color: "#6600cc" },
  { matches: ["superdigital"], color: "#f90078" },
  { matches: ["rendimento", "banco rendimento"], color: "#003f8a" },
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
  "#1d1d1b",
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

/**
 * Returns 1-2 uppercase characters to use as an initials badge for a bank/institution.
 * Single-word names: first 2 chars. Multi-word: first letter of each meaningful word.
 */
export function getInstitutionInitials(name: string): string {
  const stopWords = new Set(["do", "da", "de", "dos", "das"]);
  const words = name.trim().split(/\s+/).filter((w) => !stopWords.has(w.toLowerCase()) && w.length > 0);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
