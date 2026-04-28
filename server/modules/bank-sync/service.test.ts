import { beforeEach, describe, expect, it, vi } from "vitest";

const createImportedTransactionMock = vi.fn();
const dbQueryMock = vi.fn();
const findConnectionsByUserIdMock = vi.fn();
const getOrCreateInstallmentPurchaseMock = vi.fn();
const setConnectionSyncedMock = vi.fn();
const upsertBankConnectionForPluggyMock = vi.fn();
const listCategoriesMock = vi.fn();
const listHistoricalCategorizationRowsMock = vi.fn();
const listRecurringCategorizationRulesMock = vi.fn();
const upsertTransactionCategorizationRuleMock = vi.fn();

vi.mock("./repository.js", () => ({
  deleteConnection: vi.fn(),
  findConnectionsByUserId: findConnectionsByUserIdMock,
  setConnectionSynced: setConnectionSyncedMock,
  updateConnectionInstitution: vi.fn(),
  upsertBankConnectionForPluggy: upsertBankConnectionForPluggyMock,
  upsertConnection: vi.fn(),
}));

vi.mock("../../shared/db.js", () => ({
  db: {
    query: dbQueryMock,
  },
}));

vi.mock("../../database.js", () => ({
  createImportedTransaction: createImportedTransactionMock,
  getOrCreateInstallmentPurchase: getOrCreateInstallmentPurchaseMock,
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

function mockPluggyFetch() {
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
            {
              id: "tx-installment",
              accountId: "acc-1",
              description: "Notebook 2/10",
              descriptionRaw: null,
              currencyCode: "BRL",
              amount: 320,
              date: "2026-04-20T12:00:00Z",
              category: null,
              type: "DEBIT",
              status: "CREATED",
            },
          ],
        }),
      }),
  );
}

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
    getOrCreateInstallmentPurchaseMock.mockResolvedValue({ id: 77 });
    createImportedTransactionMock.mockResolvedValue({ id: 999 });
    mockPluggyFetch();
  });

  it("categorizes imported Pluggy transactions and skips credit card bill payments on sync", async () => {
    dbQueryMock.mockImplementation(async (query, params) => {
      const sql = String(query);

      if (sql.includes("FROM transactions")) {
        if (params[1] === "pluggy:tx-ifood") {
          return { rows: [] };
        }

        if (params[1] === "pluggy:tx-installment") {
          return { rows: [] };
        }
      }

      if (sql.includes("FROM installment_purchases")) {
        return { rows: [{ id: 77 }] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const { syncTransactions } = await import("./service.ts");

    const result = await syncTransactions(1);

    expect(result).toEqual({ imported: 2, skipped: 2, accounts: 1 });
    expect(dbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM transactions"),
      [1, "pluggy:tx-ifood"],
    );
    expect(createImportedTransactionMock).toHaveBeenCalledWith({
      userId: 1,
      bankConnectionId: 88,
      categoryId: 1,
      description: "iFood",
      amount: -67.9,
      occurredOn: "2026-04-11",
      seedKey: "pluggy:tx-ifood",
      installmentPurchaseId: null,
      installmentNumber: null,
    });
    expect(dbQueryMock).toHaveBeenCalledWith(
      expect.stringContaining("FROM installment_purchases"),
      [1, 88, "notebook", 10, 2],
    );
    expect(getOrCreateInstallmentPurchaseMock).not.toHaveBeenCalled();
    expect(createImportedTransactionMock).toHaveBeenCalledWith({
      userId: 1,
      bankConnectionId: 88,
      categoryId: 4,
      description: "Notebook 2/10",
      amount: -320,
      occurredOn: "2026-04-20",
      seedKey: "pluggy:tx-installment",
      installmentPurchaseId: 77,
      installmentNumber: 2,
    });
    expect(upsertTransactionCategorizationRuleMock).toHaveBeenCalledWith({
      userId: 1,
      matchKey: "ifood",
      type: "expense",
      categoryId: 1,
    });
    expect(setConnectionSyncedMock).toHaveBeenCalledWith(1, "item-1", null);
  });

  it("preserves the existing category for synced transactions while still linking installments", async () => {
    dbQueryMock.mockImplementation(async (query, params) => {
      const sql = String(query);

      if (sql.includes("FROM transactions")) {
        if (params[1] === "pluggy:tx-ifood") {
          return { rows: [] };
        }

        if (params[1] === "pluggy:tx-installment") {
          return {
            rows: [
              {
                id: 456,
                category_id: 1,
                installment_purchase_id: null,
                installment_number: null,
              },
            ],
          };
        }
      }

      if (sql.includes("FROM installment_purchases")) {
        return { rows: [] };
      }

      if (sql.includes("UPDATE transactions")) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${sql}`);
    });

    const { syncTransactions } = await import("./service.ts");

    const result = await syncTransactions(1);

    expect(result).toEqual({ imported: 1, skipped: 3, accounts: 1 });
    expect(createImportedTransactionMock).toHaveBeenCalledTimes(1);
    expect(createImportedTransactionMock).toHaveBeenCalledWith({
      userId: 1,
      bankConnectionId: 88,
      categoryId: 1,
      description: "iFood",
      amount: -67.9,
      occurredOn: "2026-04-11",
      seedKey: "pluggy:tx-ifood",
      installmentPurchaseId: null,
      installmentNumber: null,
    });
    expect(getOrCreateInstallmentPurchaseMock).toHaveBeenCalledWith({
      userId: 1,
      bankConnectionId: 88,
      categoryId: 1,
      seedKey: expect.any(String),
      descriptionBase: "Notebook",
      normalizedDescriptionBase: "notebook",
      purchaseOccurredOn: "2026-03-20",
      installmentCount: 10,
      amountPerInstallment: 320,
    });

    const updateQueries = dbQueryMock.mock.calls.filter(([query]) => String(query).includes("UPDATE transactions"));
    expect(updateQueries).toHaveLength(1);
    expect(String(updateQueries[0][0])).not.toContain("category_id");
    expect(updateQueries[0][1]).toEqual([1, 456, 77, 2]);
    expect(upsertTransactionCategorizationRuleMock).toHaveBeenCalledTimes(1);
    expect(upsertTransactionCategorizationRuleMock).toHaveBeenCalledWith({
      userId: 1,
      matchKey: "ifood",
      type: "expense",
      categoryId: 1,
    });
  });
});
