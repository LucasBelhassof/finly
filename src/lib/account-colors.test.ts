import { describe, expect, it } from "vitest";

import { getDefaultAccountColor, getKnownInstitutionColor, getSuggestedAccountColor } from "@/lib/account-colors";

describe("account colors", () => {
  it("suggests brand colors for known institutions with accent-insensitive matching", () => {
    expect(getKnownInstitutionColor("Itaú Uniclass", "bank_account")).toBe("#ff7a00");
    expect(getKnownInstitutionColor("Cartao Nubank Platinum", "credit_card")).toBe("#8a05be");
    expect(getKnownInstitutionColor("Banco do Brasil", "bank_account")).toBe("#ffdd00");
  });

  it("returns null for unknown institutions and cash accounts", () => {
    expect(getKnownInstitutionColor("Minha conta local", "bank_account")).toBeNull();
    expect(getKnownInstitutionColor("Carteira fisica", "cash")).toBeNull();
  });

  it("falls back to the default account color when the institution is unknown", () => {
    expect(getSuggestedAccountColor("Conta pessoal", "bank_account")).toBe(getDefaultAccountColor("bank_account"));
    expect(getSuggestedAccountColor("Cartao secundario", "credit_card")).toBe(getDefaultAccountColor("credit_card"));
    expect(getSuggestedAccountColor("Carteira", "cash")).toBe(getDefaultAccountColor("cash"));
  });
});
