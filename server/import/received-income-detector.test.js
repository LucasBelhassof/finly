import { describe, expect, it } from "vitest";
import { CLEARLY_RECEIVED_INCOME_KEYWORDS, isClearlyReceivedIncomeDescription } from "./received-income-detector.js";

describe("CLEARLY_RECEIVED_INCOME_KEYWORDS", () => {
  it("contains all expected income keywords", () => {
    const expected = [
      "pix recebido",
      "ted recebido",
      "doc recebido",
      "credito recebido",
      "credito em conta",
      "deposito recebido",
      "pagamento recebido",
      "transferencia recebida",
      "deposito",
      "reembolso",
      "estorno",
      "recebimento",
      "entrada",
    ];

    for (const keyword of expected) {
      expect(CLEARLY_RECEIVED_INCOME_KEYWORDS).toContain(keyword);
    }
  });
});

describe("isClearlyReceivedIncomeDescription", () => {
  it("detects pix recebido", () => {
    expect(isClearlyReceivedIncomeDescription("pix recebido: lucas")).toBe(true);
  });

  it("detects ted recebido", () => {
    expect(isClearlyReceivedIncomeDescription("ted recebido empresa sa")).toBe(true);
  });

  it("detects doc recebido", () => {
    expect(isClearlyReceivedIncomeDescription("doc recebido banco x")).toBe(true);
  });

  it("detects credito recebido", () => {
    expect(isClearlyReceivedIncomeDescription("credito recebido em conta")).toBe(true);
  });

  it("detects credito em conta", () => {
    expect(isClearlyReceivedIncomeDescription("credito em conta corrente")).toBe(true);
  });

  it("detects deposito recebido", () => {
    expect(isClearlyReceivedIncomeDescription("deposito recebido agencia")).toBe(true);
  });

  it("detects pagamento recebido for non-credit-card layouts", () => {
    expect(isClearlyReceivedIncomeDescription("pagamento recebido fatura")).toBe(true);
  });

  it("excludes pagamento recebido for credit_card_statement", () => {
    expect(
      isClearlyReceivedIncomeDescription("pagamento recebido fatura", {
        importLayout: "credit_card_statement",
      }),
    ).toBe(false);
  });

  it("detects transferencia recebida", () => {
    expect(isClearlyReceivedIncomeDescription("transferencia recebida cpf 123")).toBe(true);
  });

  it("detects deposito", () => {
    expect(isClearlyReceivedIncomeDescription("deposito bancario")).toBe(true);
  });

  it("detects reembolso", () => {
    expect(isClearlyReceivedIncomeDescription("reembolso plano saude")).toBe(true);
  });

  it("detects estorno", () => {
    expect(isClearlyReceivedIncomeDescription("estorno compra debito")).toBe(true);
  });

  it("detects recebimento", () => {
    expect(isClearlyReceivedIncomeDescription("recebimento de boleto")).toBe(true);
  });

  it("detects entrada", () => {
    expect(isClearlyReceivedIncomeDescription("entrada de valores")).toBe(true);
  });

  it("returns false for expense descriptions", () => {
    expect(isClearlyReceivedIncomeDescription("compra no debito posto shell")).toBe(false);
    expect(isClearlyReceivedIncomeDescription("pagamento boleto energia")).toBe(false);
    expect(isClearlyReceivedIncomeDescription("saque caixa eletronico")).toBe(false);
    expect(isClearlyReceivedIncomeDescription("tarifa manutencao conta")).toBe(false);
  });

  it("returns false for empty and null values", () => {
    expect(isClearlyReceivedIncomeDescription("")).toBe(false);
    expect(isClearlyReceivedIncomeDescription(null)).toBe(false);
    expect(isClearlyReceivedIncomeDescription(undefined)).toBe(false);
  });

  it("does not match 'ted' alone as positive (no keyword collision)", () => {
    // "ted" alone is a negative keyword in the fallback parser; the detector
    // only matches "ted recebido", so a bare "ted enviado" must not match.
    expect(isClearlyReceivedIncomeDescription("ted enviado empresa")).toBe(false);
  });

  it("does not match 'pix' alone as received income", () => {
    expect(isClearlyReceivedIncomeDescription("pix enviado: joao")).toBe(false);
  });

  it("matches regardless of surrounding text when keyword is embedded", () => {
    expect(isClearlyReceivedIncomeDescription("transferencia recebida via pix cpf 123")).toBe(true);
  });
});
