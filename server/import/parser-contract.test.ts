import { describe, expect, it } from "vitest";

import { normalizeCanonicalParserResult } from "./parser-contract.js";

describe("normalizeCanonicalParserResult", () => {
  it("normalizes array parser output into the shared parser contract", () => {
    const result = normalizeCanonicalParserResult(
      [
        {
          occurredOn: "2026-04-06",
          description: "Mercado",
          amount: "-12.90",
          sourceRow: { col1: "2026-04-06" },
        },
      ],
      {
        parserId: "csv-delimited",
        parserLabel: "CSV/TSV parser",
      },
      "csv",
    );

    expect(result).toMatchObject({
      parserId: "csv-delimited",
      parserLabel: "CSV/TSV parser",
      detectedFileType: "csv",
      warnings: [],
      metadata: {},
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      rowId: "1",
      occurredOn: "2026-04-06",
      description: "Mercado",
      amount: -12.9,
      issues: [],
      sourceRow: { col1: "2026-04-06" },
    });
  });

  it("preserves explicit parser metadata and sanitizes warnings", () => {
    const result = normalizeCanonicalParserResult(
      {
        parserId: "pdf-text",
        parserLabel: "PDF text parser",
        warnings: ["  Review invoice header  ", "", null],
        metadata: { issuerName: "Inter" },
        rows: [
          {
            rowId: "row-a",
            occurredOn: "2026-04-01",
            description: "Invoice purchase",
            amount: 45,
            confidence: 0.94,
            issues: [{ code: "ok" }],
          },
        ],
      },
      {
        parserId: "fallback-parser",
        parserLabel: "Fallback parser",
      },
      "pdf",
    );

    expect(result.parserId).toBe("pdf-text");
    expect(result.parserLabel).toBe("PDF text parser");
    expect(result.warnings).toEqual(["Review invoice header"]);
    expect(result.metadata).toEqual({ issuerName: "Inter" });
    expect(result.rows[0]).toMatchObject({
      rowId: "row-a",
      confidence: 0.94,
      issues: [{ code: "ok" }],
    });
  });
});
