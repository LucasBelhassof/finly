interface InstitutionEntry {
  patterns: string[];
  friendlyName: string;
  color: string;
}

// Patterns are matched against a normalised (accent-stripped, lower-cased, collapsed) version of
// the raw connector name returned by Pluggy's /items API.
const INSTITUTION_MAP: InstitutionEntry[] = [
  { patterns: ["nubank", "nu pagamentos", "nu bank"], friendlyName: "Nubank", color: "#8a05be" },
  { patterns: ["itau unibanco", "banco itau", "unibanco", "itau", "itaú"], friendlyName: "Itaú", color: "#ff7a00" },
  { patterns: ["bradesco"], friendlyName: "Bradesco", color: "#cc092f" },
  { patterns: ["santander"], friendlyName: "Santander", color: "#ec0000" },
  { patterns: ["banco do brasil"], friendlyName: "Banco do Brasil", color: "#ffdd00" },
  { patterns: ["caixa economica", "caixa federal", "cef "], friendlyName: "Caixa", color: "#0066b3" },
  { patterns: ["banco inter", "inter s a", "inter sa", "inter "], friendlyName: "Inter", color: "#ff7a00" },
  { patterns: ["c6 bank", "banco c6", "c6 s a", "c6sa"], friendlyName: "C6 Bank", color: "#1d1d1b" },
  { patterns: ["neon pagamentos", "banco neon", "neon fintech"], friendlyName: "Neon", color: "#00d8ff" },
  { patterns: ["picpay"], friendlyName: "PicPay", color: "#21c25e" },
  { patterns: ["pagseguro", "pagbank", "pag bank", "pag seguro"], friendlyName: "PagBank", color: "#00a650" },
  { patterns: ["mercado pago", "mercadopago"], friendlyName: "Mercado Pago", color: "#00b1ea" },
  { patterns: ["sicredi"], friendlyName: "Sicredi", color: "#64b22b" },
  { patterns: ["sicoob"], friendlyName: "Sicoob", color: "#003641" },
  { patterns: ["btg pactual"], friendlyName: "BTG Pactual", color: "#1f4aa8" },
  { patterns: ["xp investimentos", "xp inc", "banco xp"], friendlyName: "XP Investimentos", color: "#1a1a1a" },
  { patterns: ["banco bmg", " bmg "], friendlyName: "Banco BMG", color: "#e30613" },
  { patterns: ["banco original"], friendlyName: "Original", color: "#00863c" },
  { patterns: ["banco safra", "safra"], friendlyName: "Safra", color: "#0a3d8f" },
  { patterns: ["banco votorantim", "bv financeira", "bv banco"], friendlyName: "BV", color: "#ff6600" },
  { patterns: ["stone pagamentos", "stone "], friendlyName: "Stone", color: "#00a868" },
  { patterns: ["creditas"], friendlyName: "Creditas", color: "#00c08b" },
  { patterns: ["banco pan", "pan financiadora"], friendlyName: "Banco Pan", color: "#0070c0" },
  { patterns: ["banco next", "next bank"], friendlyName: "Next", color: "#00c4b0" },
  { patterns: ["will bank", "will fintech"], friendlyName: "Will Bank", color: "#ffd400" },
  { patterns: ["agibank", "agi bank"], friendlyName: "Agibank", color: "#c800d2" },
  { patterns: ["bs2", "banco bs2"], friendlyName: "BS2", color: "#0069b4" },
  { patterns: ["daycoval"], friendlyName: "Daycoval", color: "#e0500a" },
  { patterns: ["modal mais", "banco modal"], friendlyName: "Modal", color: "#6600cc" },
  { patterns: ["superdigital"], friendlyName: "Superdigital", color: "#f90078" },
  { patterns: ["banco rendimento", "rendimento"], friendlyName: "Rendimento", color: "#003f8a" },
  { patterns: ["banco abc", "abc brasil"], friendlyName: "ABC Brasil", color: "#e31837" },
  { patterns: ["avenue"], friendlyName: "Avenue", color: "#0077ff" },
  { patterns: ["warren"], friendlyName: "Warren", color: "#6c47ff" },
  { patterns: ["rico investimentos", "rico "], friendlyName: "Rico", color: "#00b4d8" },
  { patterns: ["clear corretora", "clear "], friendlyName: "Clear", color: "#e74c3c" },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface NormalizedInstitution {
  friendlyName: string;
  color: string;
}

/**
 * Maps a raw Pluggy connector name to a friendly display name and brand color.
 * Returns null if the institution is not recognised.
 */
export function normalizeInstitution(rawName: string): NormalizedInstitution | null {
  const n = normalize(rawName);
  if (!n) return null;

  const match = INSTITUTION_MAP.find((entry) =>
    entry.patterns.some((pattern) => n.includes(normalize(pattern))),
  );

  if (!match) return null;
  return { friendlyName: match.friendlyName, color: match.color };
}
