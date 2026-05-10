import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { parseCsvLikeBuffer } from "./csv-parser.js";
import { parseJsonBuffer } from "./json-parser.js";
import { parseOfxBuffer } from "./ofx-parser.js";
import { parsePdfTextBuffer } from "./pdf-text-parser.js";
import { parseQifBuffer } from "./qif-parser.js";
import { parseSpreadsheetBuffer } from "./spreadsheet-parser.js";
import { parseTextBuffer } from "./text-parser.js";
import { inferSourceKind } from "../source-kind-detector.js";

function buildWorkbookBuffer(sheets, bookType: "xlsx" | "xls" = "xlsx") {
  const workbook = XLSX.utils.book_new();

  for (const [sheetName, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  return XLSX.write(workbook, {
    type: "buffer",
    bookType,
  });
}

describe("universal import parsers", () => {
  it("parses simple CSV rows", () => {
    const csv = ["Data;Descricao;Valor", "06/04/2026;iFood;-67,90", "05/04/2026;Salario;6500,00"].join("\n");
    const rows = parseCsvLikeBuffer(Buffer.from(csv, "utf8"));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "iFood",
      amount: -67.9,
    });
    expect(rows[1].amount).toBe(6500);
  });

  it("parses debit and credit CSV columns", () => {
    const csv = ["Date,Description,Debit,Credit", "2026-04-06,Coffee,12.90,", "2026-04-05,Salary,,5000.00"].join("\n");
    const rows = parseCsvLikeBuffer(Buffer.from(csv, "utf8"));

    expect(rows).toHaveLength(2);
    expect(rows[0].amount).toBe(-12.9);
    expect(rows[1].amount).toBe(5000);
  });

  it("detects shifted CSV headers and ignores banners", () => {
    const csv = ["Banco Finly", "Extrato de abril", "", "Data|Historico|Valor", "06/04/2026|Padaria|-25,00"].join("\n");
    const rows = parseCsvLikeBuffer(Buffer.from(csv, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "Padaria",
      amount: -25,
    });
  });

  it("parses TSV content", () => {
    const tsv = ["date\tdescription\tamount", "2026-04-06\tBook Store\t-49.90"].join("\n");
    const rows = parseCsvLikeBuffer(Buffer.from(tsv, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0].description).toBe("Book Store");
  });

  it("parses XLSX and chooses the most likely transaction sheet", () => {
    const buffer = buildWorkbookBuffer({
      Summary: [
        ["Resumo", "Valor"],
        ["Total", "100"],
      ],
      Transactions: [
        ["Data", "Descricao", "Valor"],
        ["06/04/2026", "Mercado", "-120,50"],
      ],
    });
    const rows = parseSpreadsheetBuffer(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "Mercado",
      amount: -120.5,
    });
    expect(rows[0].raw.source).toBe("Transactions");
  });

  it("parses XLS workbooks through the same spreadsheet path", () => {
    const buffer = buildWorkbookBuffer(
      {
        Summary: [
          ["Resumo", "Valor"],
          ["Total", "100"],
        ],
        Statement: [
          ["Data", "Descricao", "Valor"],
          ["06/04/2026", "Padaria", "-18,50"],
        ],
      },
      "xls",
    );
    const rows = parseSpreadsheetBuffer(buffer);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "Padaria",
      amount: -18.5,
    });
    expect(rows[0].raw.source).toBe("Statement");
  });

  it("parses OFX with FITID", () => {
    const ofx = `
<OFX>
<CURDEF>BRL
<BANKID>341
<ACCTID>12345
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260406120000
<TRNAMT>-67.90
<FITID>ABC123
<NAME>iFood
<MEMO>iFood pedido
</STMTTRN>
</OFX>`;
    const rows = parseOfxBuffer(Buffer.from(ofx, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "iFood pedido",
      amount: -67.9,
      externalId: "ABC123",
      currency: "BRL",
    });
  });

  it("parses basic QIF", () => {
    const qif = ["!Type:Bank", "D06/04/2026", "T-34.90", "PSpotify", "MPlano familia", "^"].join("\n");
    const rows = parseQifBuffer(Buffer.from(qif, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "Spotify",
      amount: -34.9,
      memo: "Plano familia",
    });
  });

  it("parses structured TXT", () => {
    const txt = ["06/04/2026 Padaria R$ 23,50", "Salario 2026-04-05 5000,00"].join("\n");
    const rows = parseTextBuffer(Buffer.from(txt, "utf8"));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "Padaria",
      amount: 23.5,
    });
    expect(rows[1].description).toBe("Salario");
  });

  it("keeps low-confidence CSV rows with inferred dates and row issues", () => {
    const csv = ["05/04/2026;Cafe;-12,90", ";Uber;-45,00"].join("\n");
    const rows = parseCsvLikeBuffer(Buffer.from(csv, "utf8"));

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-04-05",
      description: "Cafe",
      amount: -12.9,
    });
    expect(rows[1]).toMatchObject({
      occurredOn: "2026-04-05",
      description: "Uber",
      amount: -45,
      confidence: 0.45,
    });
    expect(rows[1].issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "import_inferred_date",
          severity: "warning",
        }),
      ]),
    );
  });

  it("parses JSON array", () => {
    const json = JSON.stringify([{ date: "2026-01-10", description: "Market", amount: -120.5 }]);
    const rows = parseJsonBuffer(Buffer.from(json, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-01-10",
      description: "Market",
      amount: -120.5,
    });
  });

  it("parses JSON object with transactions", () => {
    const json = JSON.stringify({
      transactions: [{ occurredOn: "2026-01-10", name: "Salary", credit: 5000, id: "txn_1" }],
    });
    const rows = parseJsonBuffer(Buffer.from(json, "utf8"));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-01-10",
      description: "Salary",
      amount: 5000,
      externalId: "txn_1",
    });
  });

  it("parses generic PDF text transaction lines", async () => {
    const parsed = await parsePdfTextBuffer(Buffer.from("%PDF-1.4", "utf8"), {
      filename: "statement.pdf",
      text: ["06/04/2026 MERCADO R$ 123,45", "2026-04-05 Salary 5000.00"].join("\n"),
    });

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      occurredOn: "2026-04-06",
      description: "MERCADO",
      amount: 123.45,
    });
  });

  it("returns a clear error for PDFs with no selectable text", async () => {
    await expect(
      parsePdfTextBuffer(Buffer.from("%PDF-1.4", "utf8"), {
        filename: "scan.pdf",
        text: "   ",
      }),
    ).rejects.toMatchObject({
      code: "import_pdf_no_selectable_text",
      message: "PDF has no selectable text. Export a text-based PDF, CSV, OFX, or spreadsheet file.",
    });
  });

  it("parses unknown-institution PDF text without requiring issuer detection", async () => {
    const parsed = await parsePdfTextBuffer(Buffer.from("%PDF-1.4", "utf8"), {
      filename: "generic-bank.pdf",
      text: ["01/04/2026 PIX RECEBIDO 1.234,56", "02/04/2026 PAGAMENTO BOLETO -123,45"].join("\n"),
    });

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.metadata.issuerName).toBeNull();
  });

  it("infers bank statement and credit card source kinds conservatively", () => {
    const bankKind = inferSourceKind([
      { description: "PIX RECEBIDO", amount: 1234.56, balanceAfter: 5000 },
      { description: "PAGAMENTO BOLETO", amount: -123.45, balanceAfter: 4876.55 },
    ]);
    const cardKind = inferSourceKind([
      { description: "MERCADO PARCELA 1/3", amount: -120.5, balanceAfter: null },
      { description: "ANUIDADE CARTAO", amount: -12.9, balanceAfter: null },
    ]);

    expect(bankKind.sourceKind).toBe("bank_statement");
    expect(cardKind.sourceKind).toBe("credit_card_statement");
  });
});
