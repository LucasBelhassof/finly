import { beforeEach, describe, expect, it, vi } from "vitest";

const previewStoreState = new Map();

vi.mock("./import/preview-session-store.js", () => ({
  cleanupExpiredImportPreviews: vi.fn(async () => {}),
  setLegacyPreviewSession: vi.fn(async (previewToken, session) => {
    previewStoreState.set(String(previewToken), structuredClone(session));
  }),
  getLegacyPreviewSession: vi.fn(async (previewToken, userId) => {
    const session = previewStoreState.get(String(previewToken));

    if (!session || session.userId !== String(userId)) {
      const error = new Error("Preview inválido ou expirado.");
      error.name = "HttpError";
      error.status = 404;
      error.code = "import_preview_not_found";
      throw error;
    }

    if (session.expiresAtMs <= Date.now()) {
      const error = new Error("A prévia expirou. Gere a prévia novamente para continuar.");
      error.name = "HttpError";
      error.status = 400;
      error.code = "import_preview_expired";
      throw error;
    }

    return session;
  }),
}));

beforeEach(() => {
  previewStoreState.clear();
});

import {
  addMonthsToOccurredOn,
  applyCommitOverridesToPreviewItem,
  buildInstallmentPurchaseSeedKey,
  buildInstallmentTransactionSeedKey,
  buildImportSeedKey,
  buildImportedTransactionEntries,
  createPdfParseOptions,
  createPdfPasswordError,
  createImportPreview,
  detectPdfIssuer,
  extractCategorizationMatchKey,
  extractInstallmentMetadata,
  formatInstallmentDescription,
  enrichPreviewSessionWithAi,
  getPreviewSession,
  isPreviewItemEligibleForAi,
  normalizeAiCategorizationResult,
  normalizeOccurredOnToStatementMonth,
  parseCreditCardPdfStatement,
  parseMultipartCsvUpload,
  resolveAllowedCategoryMap,
  parseAmountInput,
  parseOccurredOnInput,
  stripInstallmentMarker,
  validateCommitLine,
} from "./transaction-import.js";
import { suggestKnownMerchantCategory } from "./merchant-category-rules.js";

const categories = [
  { id: 1, slug: "restaurantes", label: "Restaurantes", transactionType: "expense" },
  { id: 2, slug: "transporte", label: "Transporte", transactionType: "expense" },
  { id: 3, slug: "salario", label: "Salario", transactionType: "income" },
  { id: 10, slug: "freelance", label: "Freelance", transactionType: "income" },
  { id: 4, slug: "outros-despesas", label: "Outros", transactionType: "expense" },
  { id: 5, slug: "supermercado", label: "Supermercado", transactionType: "expense" },
  { id: 6, slug: "compras", label: "Compras", transactionType: "expense" },
  { id: 7, slug: "assinaturas", label: "Assinaturas", transactionType: "expense" },
  { id: 8, slug: "saude", label: "Saude", transactionType: "expense" },
  { id: 9, slug: "lazer", label: "Lazer", transactionType: "expense" },
];

describe("transaction import helpers", () => {
  it("normalizes supported monetary formats", () => {
    expect(parseAmountInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1,234.56")).toBe(1234.56);
    expect(parseAmountInput("(123,45)")).toBe(-123.45);
  });

  it("normalizes supported date formats", () => {
    expect(parseOccurredOnInput("06/04/2026")).toBe("2026-04-06");
    expect(parseOccurredOnInput("2026-04-06")).toBe("2026-04-06");
    expect(parseOccurredOnInput("06-04-2026")).toBe("2026-04-06");
  });

  it("builds a preview, ignores blank rows and flags duplicates", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;iFood;-67,90",
      "",
      "06/04/2026;iFood;-67,90",
      "05/04/2026;Salario;6500,00",
    ].join("\n");
    const existingFingerprints = new Set([buildImportSeedKey(1, "2026-04-06", -67.9, "ifood")]);

    const preview = await createImportPreview({
      categories,
      existingFingerprints,
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.fileSummary.totalRows).toBe(3);
    expect(preview.fileSummary.duplicateRows).toBe(2);
    expect(preview.items[0].matchedRuleId).toBe("merchant:ifood");
    expect(preview.items[0].possibleDuplicate).toBe(true);
    expect(preview.items[2].type).toBe("income");
    expect(preview.items[2].suggestedCategoryId).toBe(3);
  });

  it("reads Nubank credit card CSVs with date,title,amount and interprets purchases as expenses", async () => {
    const csv = [
      "date,title,amount",
      "2026-03-19,iFood - NuPay,30.99",
      "2026-03-18,Pagamento recebido,-377.84",
      "2026-03-15,Uber - NuPay,13.95",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      importSource: "credit_card_statement",
      userId: 1,
    });

    expect(preview.fileSummary.totalRows).toBe(3);
    expect(preview.items[0].description).toBe("iFood - NuPay");
    expect(preview.items[0].type).toBe("expense");
    expect(preview.items[0].suggestedCategoryId).toBe(1);
    expect(preview.items[1].description).toBe("Pagamento recebido");
    expect(preview.items[1].type).toBe("expense");
    expect(preview.items[1].defaultExclude).toBe(true);
    expect(preview.items[2].type).toBe("expense");
    expect(preview.items[2].suggestedCategoryId).toBe(2);
  });

  it("matches known merchants with normalized partial search", () => {
    expect(suggestKnownMerchantCategory("IFOOD NUPAY", categories)).toMatchObject({
      matchedRuleId: "merchant:ifood-nupay",
      category: { slug: "restaurantes" },
    });
    expect(suggestKnownMerchantCategory("IFD IFOOD", categories)).toMatchObject({
      matchedRuleId: "merchant:ifd-ifood",
      category: { slug: "restaurantes" },
    });
    expect(suggestKnownMerchantCategory("UBER *TRIP SAO PAULO", categories)).toMatchObject({
      matchedRuleId: "merchant:uber-trip",
      category: { slug: "transporte" },
      typeOverride: "expense",
    });
    expect(suggestKnownMerchantCategory("IFOOD*PEDIDO 7788", categories)).toMatchObject({
      matchedRuleId: "merchant:ifood-pedido",
      category: { slug: "restaurantes" },
    });
    expect(suggestKnownMerchantCategory("AMZN MKTP BR", categories)).toMatchObject({
      matchedRuleId: "merchant:amzn-mktp",
      category: { slug: "compras" },
    });
    expect(suggestKnownMerchantCategory("KIWIFY*CURSO", categories)).toMatchObject({
      matchedRuleId: "merchant:kiwify",
      category: { slug: "compras" },
    });
    expect(suggestKnownMerchantCategory("NETFLIX.COM", categories)).toMatchObject({
      matchedRuleId: "merchant:netflix-com",
      category: { slug: "assinaturas" },
    });
    expect(suggestKnownMerchantCategory("GOOGLE YOUTUB PREM", categories)).toMatchObject({
      matchedRuleId: "merchant:google-youtub",
      category: { slug: "assinaturas" },
    });
    expect(suggestKnownMerchantCategory("MICROSOFT 365", categories)).toMatchObject({
      matchedRuleId: "merchant:microsoft",
      category: { slug: "assinaturas" },
    });
    expect(suggestKnownMerchantCategory("BRADESCO SAUDE SAO PAULO", categories)).toMatchObject({
      matchedRuleId: "merchant:bradesco-saude",
      category: { slug: "saude" },
    });
    expect(suggestKnownMerchantCategory("NU SEGURO VIDA", categories)).toMatchObject({
      matchedRuleId: "merchant:nu-seguro-vida",
      category: { slug: "saude" },
    });
    expect(suggestKnownMerchantCategory("SKY FIT MOOCA", categories)).toMatchObject({
      matchedRuleId: "merchant:sky-fit",
      category: { slug: "saude" },
    });
    expect(suggestKnownMerchantCategory("PLAYSTATION-NETWORK", categories)).toMatchObject({
      matchedRuleId: "merchant:playstation-network",
      category: { slug: "lazer" },
    });
  });

  it("prioritizes specific merchants over generic ones", () => {
    expect(suggestKnownMerchantCategory("UBER EATS SAO PAULO", categories)).toMatchObject({
      matchedRuleId: "merchant:uber-eats",
      category: { slug: "restaurantes" },
    });
    expect(suggestKnownMerchantCategory("AMAZON PRIME BR", categories)).toMatchObject({
      matchedRuleId: "merchant:amazon-prime",
      category: { slug: "assinaturas" },
    });
    expect(suggestKnownMerchantCategory("IFOOD DELIVERY 123", categories)).toMatchObject({
      matchedRuleId: "merchant:ifood-delivery",
      category: { slug: "restaurantes" },
    });
  });

  it("falls back when a matched merchant category does not exist locally", () => {
    const limitedCategories = categories.filter((item) => item.slug !== "compras");

    expect(suggestKnownMerchantCategory("AMZN MKTP BR", limitedCategories)).toMatchObject({
      matchedRuleId: null,
      category: null,
      typeOverride: null,
    });
  });

  it("forces credit card CSV transaction dates into the statement month from filename metadata", async () => {
    const csv = [
      "date,title,amount",
      "2026-02-20,Droper - Parcela 3/3,257.81",
      "2026-02-25,Mlp *Kabum-Kabum - Parcela 1/10,154.25",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      filename: "Nubank_2026-03-27.csv",
      importSource: "credit_card_statement",
      userId: 1,
    });

    expect(preview.fileMetadata.statementReferenceMonth).toBe("2026-03");
    expect(preview.items[0].occurredOn).toBe("2026-03-20");
    expect(preview.items[1].occurredOn).toBe("2026-03-25");
    expect(preview.items[0].purchaseOccurredOn).toBe("2026-02-20");
    expect(preview.items[1].purchaseOccurredOn).toBe("2026-02-25");
    expect(preview.items[0].description).toContain("Parcela 3/3");
    expect(preview.items[0].isInstallment).toBe(true);
    expect(preview.items[0].installmentIndex).toBe(3);
    expect(preview.items[0].installmentCount).toBe(3);
    expect(preview.items[0].generatedInstallmentCount).toBe(3);
    expect(preview.items[1].generatedInstallmentCount).toBe(10);
    expect(preview.items[1].purchaseDescriptionBase).toBe("Mlp *Kabum-Kabum");
  });

  it("extracts installment metadata from supported description patterns", () => {
    expect(extractInstallmentMetadata("Mlp *Kabum-Kabum - Parcela 1/10")).toEqual({
      isInstallment: true,
      installmentIndex: 1,
      installmentCount: 10,
      generatedInstallmentCount: 10,
    });
    expect(extractInstallmentMetadata("DL *Alipay Ali 10/12")).toEqual({
      isInstallment: true,
      installmentIndex: 10,
      installmentCount: 12,
      generatedInstallmentCount: 12,
    });
    expect(extractInstallmentMetadata("COMMCENTER (Parcela 07 de 15)")).toEqual({
      isInstallment: true,
      installmentIndex: 7,
      installmentCount: 15,
      generatedInstallmentCount: 15,
    });
    expect(extractInstallmentMetadata("Compra a vista")).toEqual({
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
    });
  });

  it("strips and rewrites installment descriptions", () => {
    expect(stripInstallmentMarker("Mlp *Kabum-Kabum - Parcela 1/10")).toBe("Mlp *Kabum-Kabum");
    expect(stripInstallmentMarker("COMMCENTER (Parcela 07 de 15)")).toBe("COMMCENTER");
    expect(formatInstallmentDescription("Kabum", 2, 10)).toBe("Kabum 2/10");
  });

  it("builds monthly installment entries for the full purchase timeline", () => {
    const normalizedLine = validateCommitLine(
      {
        description: "Kabum - Parcela 3/10",
        amount: "154.25",
        occurredOn: "2026-03-25",
        type: "expense",
        categoryId: 4,
      },
      categories,
    );

    const entries = buildImportedTransactionEntries({
      normalizedLine,
      previewItem: {
        importSource: "credit_card_statement",
        purchaseDescriptionBase: "Kabum",
        normalizedPurchaseDescriptionBase: "kabum",
        purchaseOccurredOn: "2026-02-25",
        isInstallment: true,
        installmentIndex: 3,
        installmentCount: 10,
        generatedInstallmentCount: 10,
      },
    });

    expect(entries).toHaveLength(10);
    expect(entries[0].occurredOn).toBe("2026-01-25");
    expect(entries[1].occurredOn).toBe("2026-02-25");
    expect(entries[2].occurredOn).toBe("2026-03-25");
    expect(entries[9].occurredOn).toBe("2026-10-25");
    expect(entries[0].amount).toBe(-154.25);
    expect(entries[0].description).toBe("Kabum 1/10");
    expect(entries[1].description).toBe("Kabum 2/10");
    expect(entries[2].description).toBe("Kabum 3/10");
    expect(entries[0].installmentNumber).toBe(1);
    expect(entries[2].installmentNumber).toBe(3);
    expect(entries[0].purchaseOccurredOn).toBe("2026-02-25");
  });

  it("builds installment entries from metadata even when the source kind is generic", () => {
    const normalizedLine = validateCommitLine(
      {
        description: "Compra Loja 2/3",
        amount: "120.00",
        occurredOn: "2026-04-15",
        type: "expense",
        categoryId: 4,
      },
      categories,
    );

    const entries = buildImportedTransactionEntries({
      normalizedLine,
      previewItem: {
        importSource: "generic_transactions",
        purchaseDescriptionBase: "Compra Loja",
        normalizedPurchaseDescriptionBase: "compra loja",
        purchaseOccurredOn: "2026-03-15",
        isInstallment: true,
        installmentIndex: 2,
        installmentCount: 3,
        generatedInstallmentCount: 3,
      },
    });

    expect(entries).toHaveLength(3);
    expect(entries.map((entry) => entry.description)).toEqual([
      "Compra Loja 1/3",
      "Compra Loja 2/3",
      "Compra Loja 3/3",
    ]);
    expect(entries.map((entry) => entry.occurredOn)).toEqual(["2026-03-15", "2026-04-15", "2026-05-15"]);
    expect(entries.every((entry) => entry.amount === -120)).toBe(true);
  });

  it("applies commit edits to every generated installment entry", () => {
    const normalizedLine = validateCommitLine(
      {
        description: "Notebook editado 2/3",
        amount: "250.50",
        occurredOn: "2026-05-20",
        type: "expense",
        categoryId: 4,
      },
      categories,
    );
    const previewItem = applyCommitOverridesToPreviewItem({
      normalizedLine,
      previewItem: {
        importSource: "generic_transactions",
        purchaseDescriptionBase: "Compra Loja",
        normalizedPurchaseDescriptionBase: "compra loja",
        purchaseOccurredOn: "2026-03-15",
        isInstallment: true,
        installmentIndex: 2,
        installmentCount: 3,
        generatedInstallmentCount: 3,
      },
    });

    const entries = buildImportedTransactionEntries({ normalizedLine, previewItem });

    expect(previewItem.purchaseDescriptionBase).toBe("Notebook editado");
    expect(previewItem.normalizedPurchaseDescriptionBase).toBe("notebook editado");
    expect(previewItem.purchaseOccurredOn).toBe("2026-04-20");
    expect(entries.map((entry) => entry.description)).toEqual([
      "Notebook editado 1/3",
      "Notebook editado 2/3",
      "Notebook editado 3/3",
    ]);
    expect(entries.map((entry) => entry.occurredOn)).toEqual(["2026-04-20", "2026-05-20", "2026-06-20"]);
    expect(entries.every((entry) => entry.amount === -250.5)).toBe(true);
    expect(entries.every((entry) => entry.categoryId === 4)).toBe(true);
  });

  it("increments installment dates month by month with day clamping", () => {
    expect(addMonthsToOccurredOn("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsToOccurredOn("2026-01-31", 2)).toBe("2026-03-31");
  });

  it("generates distinct seed keys for expanded installments", () => {
    const marchKey = buildImportSeedKey(1, "2026-03-25", -154.25, "kabum parcela 3 10");
    const aprilKey = buildImportSeedKey(1, "2026-04-25", -154.25, "kabum parcela 3 10");

    expect(marchKey).not.toBe(aprilKey);
  });

  it("builds stable purchase and transaction keys for installment reconciliation", () => {
    const purchaseSeedKey = buildInstallmentPurchaseSeedKey(1, 9, "2026-02-25", "kabum", 154.25, 10);

    expect(buildInstallmentTransactionSeedKey(1, purchaseSeedKey, 2)).toBe(
      buildInstallmentTransactionSeedKey(1, purchaseSeedKey, 2),
    );
    expect(buildInstallmentTransactionSeedKey(1, purchaseSeedKey, 2)).not.toBe(
      buildInstallmentTransactionSeedKey(1, purchaseSeedKey, 3),
    );
  });

  it("reuses the user's historical categorization before AI", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS;396,00",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS",
          amount: 400,
          category_id: 3,
          occurred_on: "2026-03-06",
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0].type).toBe("income");
    expect(preview.items[0].suggestedCategoryId).toBe(3);
    expect(preview.items[0].suggestionSource).toBe("history");
  });

  it("classifies clear received transactions as income and defaults them to Salario", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Pix recebido de cliente;396,00",
      "06/04/2026;deposito em conta;150,00",
      "06/04/2026;transferencia recebida via TED;250,00",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0]).toMatchObject({
      type: "income",
      amount: "396.00",
      suggestedCategoryId: 3,
      suggestedCategoryLabel: "Salario",
      canImport: true,
      requiresCategorySelection: false,
    });
    expect(preview.items[1]).toMatchObject({
      type: "income",
      suggestedCategoryId: 3,
    });
    expect(preview.items[2]).toMatchObject({
      type: "income",
      suggestedCategoryId: 3,
    });
  });

  it("normalizes accidentally negative received transactions to positive income rows", async () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;Pix recebido de cliente;-396,00"].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0]).toMatchObject({
      type: "income",
      amount: "396.00",
      suggestedCategoryId: 3,
    });
  });

  it("reuses prior income categories for the same received source", async () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;Pix recebido de cliente ACME;396,00"].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Pix recebido de cliente ACME",
          amount: 400,
          category_id: 10,
          occurred_on: "2026-03-06",
          transaction_type: "income",
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0]).toMatchObject({
      type: "income",
      suggestedCategoryId: 10,
      suggestionSource: "history",
    });
  });

  it("ignores prior expense categories for clear received transactions and falls back to Salario", async () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;Transferencia recebida ACME;396,00"].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Transferencia recebida ACME",
          amount: -396,
          category_id: 2,
          occurred_on: "2026-03-06",
          transaction_type: "expense",
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0]).toMatchObject({
      type: "income",
      suggestedCategoryId: 3,
    });
    expect(preview.items[0].suggestionSource).not.toBe("history");
  });

  it("keeps expense behavior for sent payments and purchases", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Pix enviado para fornecedor;-67,90",
      "06/04/2026;Compra no debito padaria;-25,00",
      "06/04/2026;pagamento de boleto energia;-120,00",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items.map((item) => item.type)).toEqual(["expense", "expense", "expense"]);
  });

  it("prioritizes recurring rules over transaction history", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS;396,00",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      historicalRows: [
        {
          description: "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS",
          amount: 400,
          category_id: 2,
          occurred_on: "2026-03-06",
        },
      ],
      recurringRules: [
        {
          match_key: "levi augusto pereira dos santos",
          type: "income",
          category_id: 3,
          times_confirmed: 3,
        },
      ],
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.items[0].type).toBe("income");
    expect(preview.items[0].suggestedCategoryId).toBe(3);
    expect(preview.items[0].suggestionSource).toBe("recurring_rule");
  });

  it("revalidates commit lines with signed amount derived from type", () => {
    const line = validateCommitLine(
      {
        description: "iFood",
        amount: "67.90",
        occurredOn: "2026-04-06",
        type: "expense",
        categoryId: 1,
      },
      categories,
    );

    expect(line.signedAmount).toBe(-67.9);
    expect(line.normalizedFinalDescription).toBe("ifood");
    expect(line.normalizedOccurredOn).toBe("2026-04-06");
  });

  it("uses the default Compras category for expenses without category", () => {
    const line = validateCommitLine(
      {
        description: "Despesa sem categoria",
        amount: "10.00",
        occurredOn: "2026-04-06",
        type: "expense",
        categoryId: "",
      },
      categories,
    );

    expect(line.categoryId).toBe(6);
    expect(line.signedAmount).toBe(-10);
  });

  it("keeps income category mandatory during commit validation", () => {
    expect(() =>
      validateCommitLine(
        {
          description: "Receita sem categoria",
          amount: "1000.00",
          occurredOn: "2026-04-06",
          type: "income",
          categoryId: "",
        },
        categories,
      ),
    ).toThrow("Categoria obrigatoria para receitas.");
  });

  it("preserves manual income category overrides during commit validation", () => {
    const line = validateCommitLine(
      {
        description: "Pix recebido de cliente ACME",
        amount: "396.00",
        occurredOn: "2026-04-06",
        type: "income",
        categoryId: 10,
      },
      categories,
    );

    expect(line.categoryId).toBe(10);
    expect(line.signedAmount).toBe(396);
  });

  it("rejects a category that does not match the transaction type", () => {
    expect(() =>
      validateCommitLine(
        {
          description: "Salario pago",
          amount: "1000.00",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 3,
        },
        categories,
      ),
    ).toThrow("não corresponde ao tipo");
  });

  it("keeps rows with local rule matches out of AI enrichment", async () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;iFood;-67,90", "06/04/2026;Transferencia recebida;396,00"].join(
      "\n",
    );

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = await getPreviewSession(preview.previewToken, 1);
    const suggestCategories = async ({ items }) =>
      items.map((item) => ({
        rowIndex: item.rowIndex,
        suggestedType: "income",
        categoryKey: "salary",
        confidence: 0.92,
        reason: "Transferencia associada a recebimento.",
        status: "suggested",
      }));

    const result = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1, 2],
      maxRows: 100,
      suggestCategories,
    });

    expect(result.items[0].rowIndex).toBe(1);
    expect(result.items[0].aiStatus).toBe("no_match");
    expect(result.items[1].rowIndex).toBe(2);
    expect(result.items[1].aiStatus).toBe("no_match");
    expect(result.items[1].aiSuggestedType).toBeNull();
    expect(result.summary.suggestedRows).toBe(0);
  });

  it("rejects invalid AI categories outside the whitelist", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "expense",
        categoryKey: "unknown",
        confidence: 0.9,
        reason: "Resposta invalida",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiSuggestedCategoryId).toBeNull();
  });

  it("treats out-of-range confidence as invalid metadata", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "expense",
        categoryKey: "salary",
        confidence: 1.2,
        reason: "Confianca invalida",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiConfidence).toBeNull();
  });

  it("skips AI when the normalized description is too weak", () => {
    expect(
      isPreviewItemEligibleForAi({
        errors: [],
        suggestedCategoryId: null,
        normalizedDescription: "pix",
      }),
    ).toBe(false);
  });

  it("caches AI suggestions inside the preview session for rows without local categorization", async () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;Receita projeto XPTO;396,00"].join("\n");
    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = await getPreviewSession(preview.previewToken, 1);
    let callCount = 0;
    const suggestCategories = async ({ items }) => {
      callCount += 1;

      return items.map((item) => ({
        rowIndex: item.rowIndex,
        suggestedType: "income",
        categoryKey: "salary",
        confidence: 0.94,
        reason: "Receita reconhecida por semelhanca.",
        status: "suggested",
      }));
    };

    const first = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1],
      maxRows: 100,
      suggestCategories,
    });
    const second = await enrichPreviewSessionWithAi({
      session,
      categories,
      rowIndexes: [1],
      maxRows: 100,
      suggestCategories,
    });

    expect(callCount).toBe(1);
    expect(first.items[0].aiSuggestedCategoryId).toBe(3);
    expect(first.items[0].aiSuggestedType).toBe("income");
    expect(second.items[0].aiSuggestedCategoryId).toBe(3);
  });

  it("marks AI results without suggestedType as invalid", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: null,
        categoryKey: "salary",
        confidence: 0.9,
        reason: "Recebimento identificado",
        status: "suggested",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("invalid");
    expect(normalized.aiSuggestedType).toBeNull();
  });

  it("keeps semantic type when AI returns no_match without category", () => {
    const normalized = normalizeAiCategorizationResult(
      {
        rowIndex: 2,
        suggestedType: "income",
        categoryKey: null,
        confidence: 0.87,
        reason: "Transferencia recebida sem categoria especifica",
        status: "no_match",
      },
      resolveAllowedCategoryMap(categories),
    );

    expect(normalized.aiStatus).toBe("no_match");
    expect(normalized.aiSuggestedType).toBe("income");
    expect(normalized.aiSuggestedCategoryId).toBeNull();
    expect(normalized.aiConfidence).toBe(0.87);
  });

  it("rejects AI enrichment requests above the row limit", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida;396,00",
      "06/04/2026;Pagamento recebido;100,00",
    ].join("\n");
    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = await getPreviewSession(preview.previewToken, 1);

    await expect(
      enrichPreviewSessionWithAi({
        session,
        categories,
        rowIndexes: [1, 2],
        maxRows: 1,
        suggestCategories: async () => [],
      }),
    ).rejects.toThrow("no máximo 1 linhas");
  });

  it("extracts a useful match key from noisy banking descriptions", () => {
    expect(
      extractCategorizationMatchKey(
        "Transferencia recebida pelo Pix - LEVI AUGUSTO PEREIRA DOS SANTOS - 308838 - BCO C6 S.A. Agencia 1 Conta 3793065-6",
      ),
    ).toBe("levi augusto pereira dos santos");
  });

  it("detects supported PDF issuers", () => {
    expect(detectPdfIssuer("Resumo da fatura Banco Inter", "fatura-inter-2026-03.pdf")).toBe("inter");
    expect(
      detectPdfIssuer(
        "Pague sua fatura pelo app Mercado Pago\nDetalhes de consumo\nMovimentações na fatura",
        "fatura-mercado-pago-2026-05.pdf",
      ),
    ).toBe("mercado_pago");
    expect(detectPdfIssuer("Fatura Itau Cartoes", "Fatura_Itau_20260407-144227.pdf")).toBe("itau");
  });

  it("passes PDF passwords only to the parser options", () => {
    const buffer = Buffer.from("%PDF protected");

    expect(createPdfParseOptions(buffer, "123456")).toMatchObject({
      data: buffer,
      password: "123456",
    });
    expect(createPdfParseOptions(buffer, "")).not.toHaveProperty("password");
  });

  it("maps PDF password errors to stable bad request codes", () => {
    expect(createPdfPasswordError(undefined)).toMatchObject({
      status: 400,
      code: "import_pdf_password_required",
      details: { requiresPassword: true },
    });
    expect(createPdfPasswordError("wrong")).toMatchObject({
      status: 400,
      code: "import_pdf_password_invalid",
      details: { requiresPassword: true },
    });
  });

  it("reads filePassword from multipart uploads without mixing it into the file buffer", () => {
    const boundary = "----import-boundary";
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="fatura.pdf"',
      "Content-Type: application/pdf",
      "",
      "%PDF content",
      `--${boundary}`,
      'Content-Disposition: form-data; name="filePassword"',
      "",
      "123456",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const upload = parseMultipartCsvUpload(`multipart/form-data; boundary=${boundary}`, Buffer.from(body, "latin1"));

    expect(upload.filePassword).toBe("123456");
    expect(upload.buffer.toString("latin1")).toBe("%PDF content");
  });

  it("parses Inter credit card PDF text and ignores credits", () => {
    const result = parseCreditCardPdfStatement({
      filename: "fatura-inter-2026-03.pdf",
      text: [
        "Resumo da fatura",
        "Data de Vencimento",
        "07/04/2026",
        "-- 2 of 7 --",
        "Despesas da fatura",
        "CARTÃO 5364****9277",
        "Data  Movimentação  Beneficiário  Valor",
        "06 de mar. 2026 PAGAMENTO ON LINE  -  + R$ 1.246,17",
        "11 de mar. 2026 UBER* TRIP  -  R$ 20,94",
        "24 de mar. 2026 SEGURO CARTAO CTP  -  R$ 1,90",
        "CARTÃO 2306****0417",
        "20 de set. 2025 COMMCENTER (Parcela 07 de 15)  -  R$ 326,66",
        "Próxima fatura",
      ].join("\n"),
    });

    expect(result.issuer).toBe("inter");
    expect(result.metadata.statementDueDate).toBe("2026-04-07");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].description).toContain("Cartao 9277");
    expect(result.rows[0].amount).toBe("20.94");
    expect(result.rows[2].occurredOn).toBe("2025-09-20");
  });

  it("maps installment dates into the statement month when the bill month is known", () => {
    expect(
      normalizeOccurredOnToStatementMonth("2025-09-20", {
        statementReferenceMonth: "2026-03",
      }),
    ).toBe("2026-03-20");
    expect(
      normalizeOccurredOnToStatementMonth("2026-02-28", {
        statementReferenceMonth: "2026-04",
      }),
    ).toBe("2026-04-28");
  });

  it("parses Itau credit card PDF text and infers years from the statement reference month", () => {
    const result = parseCreditCardPdfStatement({
      filename: "Fatura_Itau_20260407-144227.pdf",
      text: [
        "Vencimento: 16/03/2026",
        "Emissão: 08/03/2026",
        "La nça me nt os : co m pr as e sa qu es",
        "14/ 05 DL *Alipay Ali 10/12 48,28 Credito Rotativo / Atraso se rvi ço s Sao Paulo",
        "Limit e má ximo de ju ro s 0,00 21/09 CO MMCEN TE RRIO 06/15 22,86",
        "17/02 AM AZO N BRSA O PAUL OBR 49,38 % so bre o limi te máx imo de ju ros 0,00%",
        "Lançamen tos no cartão 120,52",
      ].join("\n"),
    });

    expect(result.issuer).toBe("itau");
    expect(result.metadata.statementDueDate).toBe("2026-03-16");
    expect(result.metadata.statementReferenceMonth).toBe("2026-03");
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0].occurredOn).toBe("2025-05-14");
    expect(result.rows[1].occurredOn).toBe("2025-09-21");
    expect(result.rows[2].occurredOn).toBe("2026-02-17");
  });

  it("parses Mercado Pago credit card PDF text and ignores invoice metadata", () => {
    const result = parseCreditCardPdfStatement({
      filename: "fatura-mercado-pago-2026-05.pdf",
      text: [
        "Cristiane Sobrinho Belhassof Leao",
        "Emitido em: 10/05/2026",
        "Olá, Cristiane Sobrinho",
        "Essa é sua fatura de maio",
        "Total a pagar",
        "R$ 1.117,50",
        "Vence em",
        "14/05/2026",
        "Resumo da fatura",
        "Pagamentos e créditos devolvidos R$ 1.093,89",
        "Cristiane Sobrinho Belhassof Leao",
        "Vencimento: 14/05/2026",
        "Detalhes de consumo",
        "Movimentações na fatura",
        "Data Movimentações Valor em R$",
        "14/04 Pagamento da fatura de abril/2026 R$ 1.093,89",
        "Cartão Visa [************9553]",
        "Data Movimentações Valor em R$",
        "06/10 MERCADOLIVRE*LEVEROS Parcela 8 de 21 R$ 174,79",
        "05/02 MP*2PRODUTOS Parcela 4 de 12 R$ 441,33",
        "21/02 MERCADOLIVRE*DINAMICA Parcela 3 de 18 R$ 477,77",
        "02/05 MERCADOLIVRE*MERCADOLIVRE Parcela 1 de 6 R$ 23,61",
        "Total R$ 1.117,50",
        "Juros do rotativo 17,90% a.m. (621,39% a.a.)",
        "IOF internacional 3,50% do valor da compra",
      ].join("\n"),
    });

    expect(result.issuer).toBe("mercado_pago");
    expect(result.metadata.statementDueDate).toBe("2026-05-14");
    expect(result.metadata.statementReferenceMonth).toBe("2026-05");
    expect(result.rows).toHaveLength(4);
    expect(result.rows.map((row) => row.description)).toEqual([
      "MERCADOLIVRE*LEVEROS Parcela 8 de 21",
      "MP*2PRODUTOS Parcela 4 de 12",
      "MERCADOLIVRE*DINAMICA Parcela 3 de 18",
      "MERCADOLIVRE*MERCADOLIVRE Parcela 1 de 6",
    ]);
    expect(result.rows.map((row) => row.occurredOn)).toEqual(["2025-10-06", "2026-02-05", "2026-02-21", "2026-05-02"]);
    expect(result.rows.every((row) => row.description.includes("Parcela"))).toBe(true);
    expect(result.rows.some((row) => /pagamento|juros|iof/i.test(row.description))).toBe(false);
  });
});
