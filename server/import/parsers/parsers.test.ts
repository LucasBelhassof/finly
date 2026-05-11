import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import { analyzeCsvLikeBuffer, parseCsvLikeBuffer } from "./csv-parser.js";
import {
  inferFallbackStatementSourceKind,
  parseFallbackStatementLines,
  parseStatementDateHeader,
} from "./fallback-statement-parser.js";
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

  it("builds preflight metadata for unknown CSV headers", () => {
    const csv = ["posted_at,narrative,gross", "2026-04-06,Coffee,-12.90"].join("\n");
    const parsed = analyzeCsvLikeBuffer(Buffer.from(csv, "utf8"), { source: "unknown.csv" });

    expect(parsed.preflight).toMatchObject({
      headerDetectionMode: "fallback",
      requiresManualMapping: true,
      missingRequiredFields: ["date", "description", "amount"],
    });
    expect(parsed.preflight.availableColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ header: "posted_at" }),
        expect.objectContaining({ header: "narrative" }),
        expect.objectContaining({ header: "gross" }),
      ]),
    );
  });

  it("applies explicit CSV column mapping overrides", () => {
    const csv = ["posted_at,narrative,outflow,inflow", "2026-04-06,Coffee,12.90,", "2026-04-05,Salary,,5000.00"].join(
      "\n",
    );
    const parsed = analyzeCsvLikeBuffer(Buffer.from(csv, "utf8"), {
      source: "mapped.csv",
      columnMapping: {
        date: "posted_at",
        description: "narrative",
        debit: "outflow",
        credit: "inflow",
      },
    });

    expect(parsed.preflight.requiresManualMapping).toBe(false);
    expect(parsed.preflight.selectedMapping).toMatchObject({
      date: { header: "posted_at" },
      description: { header: "narrative" },
      debit: { header: "outflow" },
      credit: { header: "inflow" },
    });
    expect(parsed.rows[0].amount).toBe(-12.9);
    expect(parsed.rows[1].amount).toBe(5000);
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

  it("parses grouped-date bank statement rows with running balance", () => {
    const rows = parseFallbackStatementLines(
      [
        "27 de Fevereiro de 2026 Saldo do dia: R$ 115,00",
        'Pix recebido: "Cp :18236120-LUCAS SOBRINHO BELHASSOF LEAO 16660042784" R$ 115,00 R$ 115,00',
      ],
      {
        referenceYear: 2026,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-02-27",
      description: 'Pix recebido: "Cp :18236120-LUCAS SOBRINHO BELHASSOF LEAO 16660042784"',
      amount: 115,
      balanceAfter: 115,
    });
  });

  it("parses negative PIX transfers with running balance", () => {
    const rows = parseFallbackStatementLines(
      [
        "16 de Março de 2026 Saldo do dia: R$ 0,00",
        'Pix enviado: "Cp :18236120-Lucas Sobrinho Belhassof Leao 16660042784" -R$ 132,00 R$ 438,00',
      ],
      {
        referenceYear: 2026,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-03-16",
      amount: -132,
      balanceAfter: 438,
    });
  });

  it("parses debit card purchase rows as negative transactions", () => {
    const rows = parseFallbackStatementLines(
      [
        "22 de Março de 2026 Saldo do dia: R$ 86,00",
        'Compra no debito: "No estabelecimento POSTO HAWAI RIO DE JANEIR BRA" -R$ 60,00 R$ 86,00',
      ],
      {
        referenceYear: 2026,
      },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-03-22",
      amount: -60,
      balanceAfter: 86,
    });
  });

  it("parses Portuguese month names with accents in statement headers", () => {
    const header = parseStatementDateHeader("1 de Março de 2026", {
      referenceYear: 2026,
    });

    expect(header).toMatchObject({
      occurredOn: "2026-03-01",
    });
  });

  it("filters statement footer and support noise lines", () => {
    const rows = parseFallbackStatementLines(
      [
        "Fale com a gente",
        "SAC: 0800 940 9999 (opção 09)",
        "Ouvidoria: 0800 940 7772",
        "Deficiência de fala e audição: 0800 979 7099",
        "-- 1 of 5 --",
      ],
      {
        referenceYear: 2026,
      },
    );

    expect(rows).toHaveLength(0);
  });

  it("does not create parsed rows without prior date context", () => {
    const rows = parseFallbackStatementLines(
      ['Pix recebido: "Cp :18236120-LUCAS SOBRINHO BELHASSOF LEAO 16660042784" R$ 115,00 R$ 115,00'],
      {
        referenceYear: 2026,
      },
    );

    expect(rows).toHaveLength(0);
  });

  // ── Inline-date regression tests (fix: date + transaction on same line) ──

  it("parses inline-date row with DD/MM/YYYY prefix", () => {
    const rows = parseFallbackStatementLines(['27/02/2026 Pix recebido: "Cp :18236120-LUCAS" R$ 115,00 R$ 230,00'], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-02-27",
      amount: 115,
      balanceAfter: 230,
    });
    expect(rows[0].description).not.toMatch(/^27\/02\/2026/);
  });

  it("parses inline-date row with YYYY-MM-DD prefix", () => {
    const rows = parseFallbackStatementLines(['2026-03-16 Pix enviado: "Lucas" -R$ 132,00 R$ 438,00'], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-03-16",
      amount: -132,
      balanceAfter: 438,
    });
    expect(rows[0].description).not.toMatch(/^2026-03-16/);
  });

  it("parses inline-date row with long Portuguese date prefix", () => {
    const rows = parseFallbackStatementLines(
      ['22 de Março de 2026 Compra no debito: "Posto Hawai" -R$ 60,00 R$ 86,00'],
      { referenceYear: 2026 },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      occurredOn: "2026-03-22",
      amount: -60,
      balanceAfter: 86,
    });
  });

  it("still parses grouped-date rows (date on own line) after inline-date fix", () => {
    const rows = parseFallbackStatementLines(
      [
        "27 de Fevereiro de 2026 Saldo do dia: R$ 115,00",
        'Pix recebido: "Cp :18236120-LUCAS" R$ 115,00 R$ 115,00',
        "28 de Fevereiro de 2026 Saldo do dia: R$ 200,00",
        'Deposito: "Banco X" R$ 85,00 R$ 200,00',
      ],
      { referenceYear: 2026 },
    );

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ occurredOn: "2026-02-27", amount: 115 });
    expect(rows[1]).toMatchObject({ occurredOn: "2026-02-28", amount: 85 });
  });

  it("discards pure date-header-only lines with no transaction data", () => {
    const rows = parseFallbackStatementLines(
      ["27 de Fevereiro de 2026 Saldo do dia: R$ 115,00", 'Pix recebido: "Cp :18236120-LUCAS" R$ 115,00 R$ 230,00'],
      { referenceYear: 2026 },
    );

    // The date-header line has "saldo do dia" which is a NOISE_PATTERN.
    // parseFallbackStatementLines should treat it as a pure header (sets
    // activeDate) and NOT produce a row from it; only the next transaction
    // line yields a row.
    expect(rows).toHaveLength(1);
    expect(rows[0].occurredOn).toBe("2026-02-27");
  });

  // ── Expanded income keywords ──

  it("infers positive amount for TED recebido", () => {
    const rows = parseFallbackStatementLines(["2026-04-01 Ted recebido: empresa sa R$ 500,00 R$ 1000,00"], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeGreaterThan(0);
  });

  it("infers positive amount for DOC recebido", () => {
    const rows = parseFallbackStatementLines(["2026-04-02 Doc recebido banco xyz R$ 300,00 R$ 800,00"], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeGreaterThan(0);
  });

  it("infers positive amount for credito em conta", () => {
    const rows = parseFallbackStatementLines(["2026-04-03 Credito em conta corrente R$ 1200,00 R$ 2000,00"], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeGreaterThan(0);
  });

  it("infers positive amount for deposito recebido", () => {
    const rows = parseFallbackStatementLines(["2026-04-04 Deposito recebido agencia R$ 250,00 R$ 750,00"], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeGreaterThan(0);
  });

  it("infers positive amount for reembolso even without explicit sign", () => {
    const rows = parseFallbackStatementLines(["2026-04-05 Reembolso plano saude R$ 150,00 R$ 900,00"], {
      referenceYear: 2026,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBeGreaterThan(0);
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

  it("parses realistic grouped-date PDF text fixtures before generic line fallback", async () => {
    const parsed = await parsePdfTextBuffer(Buffer.from("%PDF-1.4", "utf8"), {
      filename: "Extrato-Inter.pdf",
      text: [
        "Solicitado em: 10/05/2026 - 15h46",
        "CPF/CNPJ: 47.304.326/0001-76, Instituição: Banco Inter, Agência: 0001-9, Conta: 51503659-5",
        "27 de Fevereiro de 2026 Saldo do dia: R$ 115,00",
        'Pix recebido: "Cp :18236120-LUCAS SOBRINHO BELHASSOF LEAO 16660042784" R$ 115,00 R$ 115,00',
        "16 de Março de 2026 Saldo do dia: R$ 0,00",
        'Pix enviado: "Cp :18236120-Lucas Sobrinho Belhassof Leao 16660042784" -R$ 132,00 R$ 438,00',
        "Fale com a gente",
        "-- 1 of 5 --",
      ].join("\n"),
    });

    expect(parsed.rows).toHaveLength(2);
    expect(parsed.rows[0]).toMatchObject({
      occurredOn: "2026-02-27",
      amount: 115,
      balanceAfter: 115,
      raw: expect.objectContaining({
        source: "pdf:inter",
      }),
    });
    expect(parsed.sourceKind).toBe("bank_statement");
    expect(parsed.sourceKindConfidence).toBeGreaterThanOrEqual(0.78);
    expect(parsed.metadata.issuerName).toBe("Inter");
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

  it("classifies fallback statement rows conservatively", () => {
    const bankKind = inferFallbackStatementSourceKind([
      { description: "Pix recebido", amount: 115, balanceAfter: 115 },
      { description: "Pix enviado", amount: -132, balanceAfter: 438 },
    ]);
    const genericKind = inferFallbackStatementSourceKind([
      { description: "Reembolso de compra", amount: 20, balanceAfter: null },
    ]);

    expect(bankKind).toMatchObject({
      sourceKind: "bank_statement",
    });
    expect(genericKind).toMatchObject({
      sourceKind: "generic_transactions",
    });
  });
});
