export const merchantCategoryMap = {
  transporte: [
    "UBER TRIP",
    "UBER BV",
    "UBER",
    "99 TECNOLOGIA",
    "99 APP",
    "99APP",
    "99",
    "CABIFY BRASIL",
    "CABIFY",
    "LATAM AIRLINES",
    "LATAM",
    "GOL LINHAS AEREAS",
    "GOL",
    "AZUL LINHAS AEREAS",
    "AZUL",
    "SEM PARAR",
    "CONECTCAR",
    "VELOE",
    "ESTAPAR",
    "INDIGO PARK",
    "MULTIPARK",
    "POSTO SHELL",
    "SHELL",
    "POSTO IPIRANGA",
    "IPIRANGA",
    "POSTO PETROBRAS",
    "PETROBRAS",
  ],
  restaurantes: [
    "UBER EATS",
    "IFOOD NUPAY",
    "IFD IFOOD",
    "IFOOD CLUB",
    "IFOOD PEDIDO",
    "IFOOD DELIVERY",
    "IFOOD",
    "AEF CONVENIENCIA",
    "RAPPI",
    "MC DONALDS",
    "MCDONALDS",
    "ARCOS DOURADOS",
    "BURGER KING",
    "BK BRASIL",
    "KFC",
    "SUBWAY",
    "DOMINOS",
    "PIZZA HUT",
    "STARBUCKS COFFEE",
    "STARBUCKS",
    "CACAU SHOW",
    "KOPENHAGEN",
    "HAVANNA",
    "RESTAURANTE",
    "PIZZARIA",
    "LANCHONETE",
    "CHURRASCARIA",
    "PADARIA",
    "BAR",
  ],
  supermercado: [
    "CARREFOUR EXPRESS",
    "CARREFOUR",
    "ASSAI ATACADISTA",
    "ASSAI",
    "ATACADAO SA",
    "ATACADAO",
    "PAO DE ACUCAR",
    "PAODEACUCAR",
    "EXTRA",
    "SONDAS",
    "DIA",
    "BIG",
    "SAM S CLUB",
    "MAKRO",
    "TENDA ATACADO",
  ],
  compras: [
    "AMAZON COM BR",
    "AMZN MKTPLACE",
    "AMZN MKTP",
    "AMZN",
    "AMAZON",
    "MERCADO LIVRE",
    "MERCADOLIVRE",
    "MERCADO PAGO",
    "SHOPEE SHOPPING",
    "SHOPEE",
    "SHEIN",
    "ALIEXPRESS",
    "MAGAZINE LUIZA",
    "MAGALU",
    "CASAS BAHIA",
    "PONTO",
    "KABUM COM",
    "KABUM",
    "FAST SHOP",
    "ZARA",
    "NIKE",
    "ADIDAS",
    "RENNER",
    "RIACHUELO",
    "C A",
    "PETZ",
    "COBASI",
    "KALUNGA",
    "SARAIVA",
    "VANS",
    "KIWIFY",
  ],
  assinaturas: [
    "GOOGLE YOUTUB",
    "GOOGLE STORYT",
    "DL GOOGLE",
    "SPOTIFY PREMIUM",
    "NETFLIX COM",
    "AMAZON PRIME",
    "PRIME VIDEO",
    "DISNEY PLUS",
    "HBO MAX",
    "PARAMOUNT PLUS",
    "GLOBOPLAY",
    "YOUTUBE PREMIUM",
    "GOOGLE STORAGE",
    "GOOGLE PLAY",
    "APPLE COM BILL",
    "APPLE SERVICES",
    "NETFLIX",
    "SPOTIFY",
    "MICROSOFT",
    "CRUNCHYROLL",
    "NUBANK MAIS",
    "ADOBE",
    "DROPBOX",
    "NOTION",
    "CANVA",
    "FIGMA",
  ],
  saude: [
    "NU SEGURO VIDA",
    "DROGA RAIA",
    "PAGUE MENOS",
    "HERMES PARDINI",
    "BRADESCO SAUDE",
    "SULAMERICA SAUDE",
    "DROGASIL",
    "ULTRAFARMA",
    "PANVEL",
    "NISSEI",
    "FLEURY",
    "DELBONI",
    "DASA",
    "UNIMED PLANO",
    "UNIMED",
    "AMIL",
    "SKY FIT",
  ],
  lazer: [
    "STEAM PURCHASE",
    "PLAYSTATION NETWORK",
    "EPIC GAMES",
    "PLAYSTATION",
    "XBOX LIVE",
    "XBOX",
    "NINTENDO",
    "BLIZZARD",
    "RIOT GAMES",
    "CINEMARK",
    "KINOPLEX",
    "INGRESSO COM",
    "EVENTIM",
    "SYMPLA",
    "BETO CARRERO",
    "HOPI HARI",
    "BEACH PARK",
    "STEAM",
    "UCI",
  ],
};

function normalizeMerchantText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toRuleId(pattern) {
  return `merchant:${String(pattern)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`;
}

export const knownMerchantRules = Object.entries(merchantCategoryMap)
  .flatMap(([categorySlug, patterns]) =>
    patterns.map((pattern) => ({
      id: toRuleId(pattern),
      categorySlug,
      pattern,
      normalizedPattern: normalizeMerchantText(pattern),
    })),
  )
  .sort((left, right) => {
    const wordDiff = right.normalizedPattern.split(" ").length - left.normalizedPattern.split(" ").length;

    if (wordDiff !== 0) {
      return wordDiff;
    }

    return right.normalizedPattern.length - left.normalizedPattern.length;
  });

export function suggestKnownMerchantCategory(normalizedDescriptionValue, categories) {
  const normalizedDescription = normalizeMerchantText(normalizedDescriptionValue);

  if (!normalizedDescription) {
    return {
      matchedRuleId: null,
      category: null,
      typeOverride: null,
    };
  }

  const haystack = ` ${normalizedDescription} `;

  for (const rule of knownMerchantRules) {
    if (!haystack.includes(` ${rule.normalizedPattern} `)) {
      continue;
    }

    const category = categories.find((item) => item.slug === rule.categorySlug);

    if (!category) {
      continue;
    }

    return {
      matchedRuleId: rule.id,
      category,
      typeOverride: "expense",
    };
  }

  return {
    matchedRuleId: null,
    category: null,
    typeOverride: null,
  };
}
