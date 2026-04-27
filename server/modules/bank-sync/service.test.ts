import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const findConnectionsByUserIdMock = vi.fn();
const setConnectionSyncedMock = vi.fn();
const upsertBankConnectionForPluggyMock = vi.fn();
const listCategoriesMock = vi.fn();
const listHistoricalCategorizationRowsMock = vi.fn();
const listRecurringCategorizationRulesMock = vi.fn();
const upsertTransactionCategorizationRuleMock = vi.fn();

vi.mock("../../shared/db.js", () => ({
  db: {
    query: queryMock,
  },
}));

vi.mock("./repository.js", () => ({
  deleteConnection: vi.fn(),
  findConnectionsByUserId: findConnectionsByUserIdMock,
  setConnectionSynced: setConnectionSyncedMock,
  updateConnectionInstitution: vi.fn(),
  upsertBankConnectionForPluggy: upsertBankConnectionForPluggyMock,
  upsertConnection: vi.fn(),
}));

vi.mock("../../database.js", () => ({
  listCategories: listCategoriesMock,
  listHistoricalCategorizationRows: listHistoricalCategorizationRowsMock,
  listRecurringCategorizationRules: listRecurringCategorizationRulesMock,
  upsertTransactionCategorizationRule: upsertTransactionCategorizationRuleMock,
}));

vi.mock("../../shared/env.js", () => ({
  env: {
    pluggy: {
      clientId: "client-id",
      clientSecret: "client-secret",
    },
  },
}));

describe("Pluggy sync transaction categorization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    listCategoriesMock.mockResolvedValue([
      { id: 1, slug: "restaurantes", label: "Restaurantes", transactionType: "expense" },
      { id: 3, slug: "salario", label: "Salario", transactionType: "income" },
      { id: 4, slug: "outros-despesas", label: "Outros", transactionType: "expense" },
    ]);
    listHistoricalCategorizationRowsMock.mockResolvedValue([]);
    listRecurringCategorizationRulesMock.mockResolvedValue([]);
    upsertBankConnectionForPluggyMock.mockResolvedValue(88);
    findConnectionsByUserIdMock.mockResolvedValue([
      {
        id: 10,
        pluggyItemId: "item-1",
        institutionName: "Nubank",
        institutionImageUrl: null,
      },
    ]);
    setConnectionSyncedMock.mockResolvedValue(undefined);
    upsertTransactionCategorizationRuleMock.mockResolvedValue(undefined);
    queryMock.mockResolvedValue({ rowCount: 1, rows: [{ id: 999 }] });

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ apiKey: "pluggy-key" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            total: 1,
            results: [
              {
                id: "acc-1",
                type: "CREDIT",
                marketingName: "Cartao",
                name: "Cartao",
                balance: 0,
                creditData: { creditLimit: 5000 },
              },
            ],
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            totalPages: 1,
            results: [
              {
                id: "tx-invoice-payment",
                accountId: "acc-1",
                description: "Pagamento da fatura do cartao",
                descriptionRaw: null,
                currencyCode: "BRL",
                amount: 500,
                date: "2026-04-09T12:00:00Z",
                category: null,
                type: "DEBIT",
                status: "CREATED",
              },
              {
                id: "tx-payment",
                accountId: "acc-1",
                description: "Pagamento recebido",
                descriptionRaw: null,
                currencyCode: "BRL",
                amount: 500,
                date: "2026-04-10T12:00:00Z",
                category: null,
                type: "CREDIT",
                status: "CREATED",
              },
              {
                id: "tx-ifood",
                accountId: "acc-1",
                description: "iFood",
                descriptionRaw: null,
                currencyCode: "BRL",
                amount: 67.9,
                date: "2026-04-11T12:00:00Z",
                category: null,
                type: "DEBIT",
                status: "CREATED",
              },
            ],
          }),
        }),
    );
  });

  it("categorizes imported Pluggy transactions and skips credit card bill payments on sync", async () => {
    const { syncTransactions } = await import("./service.ts");

    const result = await syncTransactions(1);

    expect(result).toEqual({ imported: 1, skipped: 2, accounts: 1 });
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO transactions"),
      [1, 88, 1, "iFood", -67.9, "2026-04-11", "pluggy:tx-ifood"],
    );
    expect(upsertTransactionCategorizationRuleMock).toHaveBeenCalledWith({
      userId: 1,
      matchKey: "ifood",
      type: "expense",
      categoryId: 1,
    });
    expect(setConnectionSyncedMock).toHaveBeenCalledWith(1, "item-1", null);
  });
});
