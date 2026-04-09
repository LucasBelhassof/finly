import { describe, expect, it } from "vitest";

import {
  addMonthsToOccurredOn,
  buildImportSeedKey,
  buildImportedTransactionEntries,
  createImportPreview,
  detectPdfIssuer,
  extractCategorizationMatchKey,
  extractInstallmentMetadata,
  enrichPreviewSessionWithAi,
  getPreviewSession,
  isPreviewItemEligibleForAi,
  normalizeAiCategorizationResult,
  normalizeOccurredOnToStatementMonth,
  parseCreditCardPdfStatement,
  resolveAllowedCategoryMap,
  parseAmountInput,
  parseOccurredOnInput,
  validateCommitLine,
} from "./transaction-import.js";

const categories = [
  { id: 1, slug: "restaurantes", label: "Restaurantes", transactionType: "expense" },
  { id: 2, slug: "transporte", label: "Transporte", transactionType: "expense" },
  { id: 3, slug: "salario", label: "Salario", transactionType: "income" },
  { id: 4, slug: "outros-despesas", label: "Outros", transactionType: "expense" },
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
    const existingFingerprints = new Set([
      buildImportSeedKey(1, "2026-04-06", -67.9, "ifood"),
    ]);

    const preview = await createImportPreview({
      categories,
      existingFingerprints,
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });

    expect(preview.fileSummary.totalRows).toBe(3);
    expect(preview.fileSummary.duplicateRows).toBe(2);
    expect(preview.items[0].matchedRuleId).toBe("ifood");
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
    expect(preview.items[1].type).toBe("income");
    expect(preview.items[1].defaultExclude).toBe(true);
    expect(preview.items[2].type).toBe("expense");
    expect(preview.items[2].suggestedCategoryId).toBe(2);
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
    expect(preview.items[0].description).toContain("Parcela 3/3");
    expect(preview.items[0].isInstallment).toBe(true);
    expect(preview.items[0].installmentIndex).toBe(3);
    expect(preview.items[0].installmentCount).toBe(3);
    expect(preview.items[0].generatedInstallmentCount).toBe(1);
    expect(preview.items[1].generatedInstallmentCount).toBe(10);
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
      generatedInstallmentCount: 3,
    });
    expect(extractInstallmentMetadata("COMMCENTER (Parcela 07 de 15)")).toEqual({
      isInstallment: true,
      installmentIndex: 7,
      installmentCount: 15,
      generatedInstallmentCount: 9,
    });
    expect(extractInstallmentMetadata("Compra a vista")).toEqual({
      isInstallment: false,
      installmentIndex: null,
      installmentCount: null,
      generatedInstallmentCount: null,
    });
  });

  it("builds monthly installment entries from the statement month onwards", () => {
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
        isInstallment: true,
        installmentIndex: 3,
        installmentCount: 10,
        generatedInstallmentCount: 8,
      },
    });

    expect(entries).toHaveLength(8);
    expect(entries[0].occurredOn).toBe("2026-03-25");
    expect(entries[1].occurredOn).toBe("2026-04-25");
    expect(entries[7].occurredOn).toBe("2026-10-25");
    expect(entries[0].amount).toBe(-154.25);
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

  it("uses the default Outros category for expenses without category", () => {
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

    expect(line.categoryId).toBe(4);
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
    ).toThrow("nao corresponde ao tipo");
  });

  it("keeps rows with local rule matches out of AI enrichment", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;iFood;-67,90",
      "06/04/2026;Transferencia recebida;396,00",
    ].join("\n");

    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = getPreviewSession(preview.previewToken, 1);
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
    expect(result.items[1].aiStatus).toBe("suggested");
    expect(result.items[1].aiSuggestedType).toBe("income");
    expect(result.summary.suggestedRows).toBe(1);
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

  it("caches AI suggestions inside the preview session", async () => {
    const csv = [
      "Data;Descricao;Valor",
      "06/04/2026;Transferencia recebida;396,00",
    ].join("\n");
    const preview = await createImportPreview({
      categories,
      existingFingerprints: new Set(),
      fileBuffer: Buffer.from(csv, "utf8"),
      userId: 1,
    });
    const session = getPreviewSession(preview.previewToken, 1);
    let callCount = 0;
    const suggestCategories = async ({ items }) => {
      callCount += 1;

      return items.map((item) => ({
        rowIndex: item.rowIndex,
        suggestedType: "income",
        categoryKey: "salary",
        confidence: 0.94,
        reason: "Recebimento com alta semelhanca.",
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
    const session = getPreviewSession(preview.previewToken, 1);

    await expect(
      enrichPreviewSessionWithAi({
        session,
        categories,
        rowIndexes: [1, 2],
        maxRows: 1,
        suggestCategories: async () => [],
      }),
    ).rejects.toThrow("no maximo 1 linhas");
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
    expect(detectPdfIssuer("Fatura Itau Cartoes", "Fatura_Itau_20260407-144227.pdf")).toBe("itau");
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
});
