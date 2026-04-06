import { describe, expect, it } from "vitest";

import {
  buildImportSeedKey,
  createImportPreview,
  parseAmountInput,
  parseOccurredOnInput,
  validateCommitLine,
} from "./transaction-import.js";

const categories = [
  { id: 1, slug: "restaurantes", label: "Restaurantes" },
  { id: 2, slug: "transporte", label: "Transporte" },
  { id: 3, slug: "salario", label: "Salario" },
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

  it("builds a preview, ignores blank rows and flags duplicates", () => {
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

    const preview = createImportPreview({
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
});
