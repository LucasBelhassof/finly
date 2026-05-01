import { createHash } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runMigrationsMock = vi.hoisted(() => vi.fn());
const suggestImportCategoriesMock = vi.hoisted(() => vi.fn());
const pgState = vi.hoisted(() => ({ current: null as null | ReturnType<typeof createDbState> }));

vi.mock("dotenv", () => ({
  default: {
    config: vi.fn(),
  },
}));

vi.mock("./migrations.js", () => ({
  runMigrations: runMigrationsMock,
}));

vi.mock("./import-ai-service.js", () => ({
  getImportAiConfig: () => ({
    enabled: true,
    autoApplyThreshold: 0.8,
    maxRowsPerRequest: 20,
    provider: "openai",
    model: "gpt-4o-mini",
  }),
  suggestImportCategories: suggestImportCategoriesMock,
}));

vi.mock("pg", () => {
  class Pool {
    query(sql: string, params?: unknown[]) {
      return pgState.current?.handleQuery(sql, params ?? []);
    }

    connect() {
      return Promise.resolve({
        query: (sql: string, params?: unknown[]) => pgState.current?.handleQuery(sql, params ?? []),
        release: vi.fn(),
      });
    }
  }

  return {
    default: { Pool },
    Pool,
  };
});

function createDbState() {
  const categories = [
    {
      id: 1,
      slug: "restaurantes",
      label: "Restaurantes",
      transaction_type: "expense",
      icon: "utensils",
      color: "#111111",
      group_slug: "alimentacao",
      group_label: "Alimentacao",
      group_color: "#222222",
      is_system: true,
    },
    {
      id: 3,
      slug: "salario",
      label: "Salario",
      transaction_type: "income",
      icon: "wallet",
      color: "#333333",
      group_slug: "receitas",
      group_label: "Receitas",
      group_color: "#444444",
      is_system: true,
    },
    {
      id: 4,
      slug: "outros-despesas",
      label: "Outros",
      transaction_type: "expense",
      icon: "circle",
      color: "#555555",
      group_slug: "outros",
      group_label: "Outros",
      group_color: "#666666",
      is_system: true,
    },
  ];
  const bankConnections = new Map([
    [
      10,
      {
        id: 10,
        slug: "conta-principal",
        name: "Conta Principal",
        account_type: "checking",
        connected: false,
        color: "#123456",
        current_balance: "0",
        credit_limit: null,
        parent_bank_connection_id: null,
        statement_close_day: null,
        statement_due_day: null,
      },
    ],
    [
      20,
      {
        id: 20,
        slug: "cartao-nubank",
        name: "Cartao Nubank",
        account_type: "credit_card",
        connected: false,
        color: "#654321",
        current_balance: "0",
        credit_limit: null,
        parent_bank_connection_id: null,
        statement_close_day: 1,
        statement_due_day: 7,
      },
    ],
  ]);
  const transactionsBySeed = new Map<string, { id: number; row: Record<string, unknown> }>();
  const installmentPurchases = new Map<string, { id: number; installment_count: number; purchase_occurred_on: string }>();
  const rules = new Map<string, { id: number; type: string; category_id: number; times_confirmed: number }>();
  let nextTransactionId = 1000;
  let nextInstallmentPurchaseId = 500;

  return {
    transactionsBySeed,
    installmentPurchases,
    rules,
    inserts: [] as Array<{ seedKey: string; description: string; amount: number; occurredOn: string }>,
    aiUsageEvents: 0,
    handleQuery(sql: string, params: unknown[]) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim();

      if (normalizedSql === "BEGIN" || normalizedSql === "COMMIT" || normalizedSql === "ROLLBACK") {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (normalizedSql.includes("SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system FROM categories")) {
        return Promise.resolve({ rows: categories, rowCount: categories.length });
      }

      if (normalizedSql.includes("SELECT occurred_on, amount, description, seed_key FROM transactions WHERE user_id = $1")) {
        return Promise.resolve({
          rows: Array.from(transactionsBySeed.values()).map(({ row }) => ({
            occurred_on: row.occurred_on,
            amount: row.amount,
            description: row.description,
            seed_key: row.seed_key,
          })),
          rowCount: transactionsBySeed.size,
        });
      }

      if (
        normalizedSql.includes("SELECT t.description, t.amount, t.category_id, t.occurred_on, c.transaction_type") &&
        normalizedSql.includes("FROM transactions t") &&
        normalizedSql.includes("INNER JOIN categories c ON c.id = t.category_id")
      ) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (normalizedSql.includes("FROM bank_connections WHERE user_id = $1 AND id = $2 LIMIT 1")) {
        const bankConnection = bankConnections.get(Number(params[1]));
        return Promise.resolve({ rows: bankConnection ? [bankConnection] : [], rowCount: bankConnection ? 1 : 0 });
      }

      if (
        normalizedSql.includes("SELECT match_key, type, category_id, times_confirmed, source") &&
        normalizedSql.includes("FROM transaction_categorization_rules") &&
        normalizedSql.includes("WHERE user_id = $1")
      ) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (normalizedSql.includes("FROM transaction_categorization_rules WHERE user_id = $1 AND match_key = $2 LIMIT 1")) {
        const existing = rules.get(String(params[1]));
        return Promise.resolve({ rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 });
      }

      if (normalizedSql.includes("INSERT INTO transaction_categorization_rules")) {
        rules.set(String(params[1]), {
          id: rules.size + 1,
          type: String(params[2]),
          category_id: Number(params[3]),
          times_confirmed: 1,
        });
        return Promise.resolve({ rows: [], rowCount: 1 });
      }

      if (normalizedSql.includes("UPDATE transaction_categorization_rules")) {
        return Promise.resolve({ rows: [], rowCount: 1 });
      }

      if (normalizedSql.includes("SELECT id, installment_count, purchase_occurred_on FROM installment_purchases WHERE user_id = $1 AND seed_key = $2 LIMIT 1")) {
        const existing = installmentPurchases.get(String(params[1]));
        return Promise.resolve({ rows: existing ? [existing] : [], rowCount: existing ? 1 : 0 });
      }

      if (normalizedSql.includes("INSERT INTO installment_purchases")) {
        const seedKey = String(params[3]);
        const created = {
          id: nextInstallmentPurchaseId++,
          installment_count: Number(params[7]),
          purchase_occurred_on: String(params[6]),
        };
        installmentPurchases.set(seedKey, created);
        return Promise.resolve({ rows: [created], rowCount: 1 });
      }

      if (normalizedSql.includes("INSERT INTO transactions (")) {
        const seedKey = String(params[6]);

        if (transactionsBySeed.has(seedKey)) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }

        const id = nextTransactionId++;
        const bankConnection = bankConnections.get(Number(params[1]));
        const category = categories.find((item) => Number(item.id) === Number(params[2]));
        const installmentPurchase = params[7] ? Array.from(installmentPurchases.values()).find((item) => item.id === Number(params[7])) : null;
        const row = {
          id,
          description: String(params[3]),
          amount: Number(params[4]),
          occurred_on: String(params[5]),
          housing_id: null,
          installment_purchase_id: params[7] ?? null,
          installment_number: params[8] ?? null,
          bank_connection_id: Number(params[1]),
          bank_slug: bankConnection?.slug ?? null,
          bank_name: bankConnection?.name ?? null,
          bank_account_type: bankConnection?.account_type ?? null,
          bank_color: bankConnection?.color ?? null,
          category_id: category?.id ?? null,
          category_slug: category?.slug ?? null,
          category_label: category?.label ?? null,
          category_icon: category?.icon ?? null,
          category_color: category?.color ?? null,
          group_slug: category?.group_slug ?? null,
          group_label: category?.group_label ?? null,
          group_color: category?.group_color ?? null,
          is_recurring: false,
          is_recurring_projection: false,
          recurring_source_transaction_id: null,
          recurrence_ends_on: null,
          installment_count: installmentPurchase?.installment_count ?? null,
          purchase_occurred_on: installmentPurchase?.purchase_occurred_on ?? null,
          seed_key: seedKey,
        };

        transactionsBySeed.set(seedKey, { id, row });
        this.inserts.push({
          seedKey,
          description: String(params[3]),
          amount: Number(params[4]),
          occurredOn: String(params[5]),
        });

        return Promise.resolve({ rows: [{ id }], rowCount: 1 });
      }

      if (
        normalizedSql.includes("FROM transactions t INNER JOIN bank_connections b ON b.id = t.bank_connection_id") &&
        normalizedSql.includes("LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id")
      ) {
        const transaction = Array.from(transactionsBySeed.values()).find((item) => item.id === Number(params[1]));
        return Promise.resolve({ rows: transaction ? [transaction.row] : [], rowCount: transaction ? 1 : 0 });
      }

      if (normalizedSql.includes("INSERT INTO ai_usage_events")) {
        this.aiUsageEvents += 1;
        return Promise.resolve({ rows: [{ id: this.aiUsageEvents }], rowCount: 1 });
      }

      if (
        normalizedSql.includes("FROM plans ") ||
        normalizedSql.includes("FROM plan_items ") ||
        normalizedSql.includes("FROM chat_conversations ") ||
        normalizedSql.includes("FROM investments ") ||
        normalizedSql.includes("FROM plan_ai_assessments ") ||
        normalizedSql.includes("FROM plan_recommendations ")
      ) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      throw new Error(`Unhandled SQL in test: ${normalizedSql}`);
    },
  };
}

function buildUniversalSessionRow(overrides: Partial<Record<string, unknown>> = {}) {
  const original = {
    rowIndex: 1,
    description: "iFood pedido",
    amount: 67.9,
    signedAmount: -67.9,
    occurredOn: "2026-04-06",
    type: "expense",
    errors: [],
    warnings: [],
    issues: [],
    possibleDuplicate: false,
    defaultExclude: false,
    suggestedCategoryId: 1,
    requiresUserAction: false,
    normalizedDescription: "ifood pedido",
    sourceKind: "generic_transactions",
    bankConnectionId: "",
    importSource: "generic_transactions",
    isInstallment: false,
  };

  const commitData = {
    rowIndex: 1,
    occurredOn: "2026-04-06",
    description: "iFood pedido",
    amount: 67.9,
    signedAmount: -67.9,
    type: "expense",
    sourceKind: "generic_transactions",
    suggestedCategoryId: 1,
    selectedBankConnectionId: null,
    defaultExclude: false,
    possibleDuplicate: false,
    duplicateReason: null,
    externalId: null,
    confidence: 0.9,
    issues: [],
    rawMetadata: { source: "test" },
    rawFallbackHash: "raw-hash-1",
    isInstallment: false,
    purchaseOccurredOn: null,
    purchaseDescriptionBase: null,
    normalizedPurchaseDescriptionBase: null,
    installmentIndex: null,
    installmentCount: null,
    generatedInstallmentCount: null,
    parserId: "json-transactions",
    parserLabel: "JSON parser",
  };

  return {
    rowIndex: 1,
    original: { ...original, ...overrides.original },
    aiSuggestion: null,
    commitData: { ...commitData, ...overrides.commitData },
  };
}

function buildUniversalInstallmentSessionRow({
  description,
  accountId = 20,
  purchaseOccurredOn,
  occurredOn,
  installmentIndex,
  installmentCount,
  generatedInstallmentCount = installmentCount,
}: {
  description: string;
  accountId?: number;
  purchaseOccurredOn: string;
  occurredOn: string;
  installmentIndex: number;
  installmentCount: number;
  generatedInstallmentCount?: number;
}) {
  const normalizedBase = "compra loja";

  return buildUniversalSessionRow({
    original: {
      description,
      sourceKind: "generic_transactions",
      importSource: "generic_transactions",
      bankConnectionId: "",
      isInstallment: true,
      purchaseDescriptionBase: "Compra Loja",
      normalizedPurchaseDescriptionBase: normalizedBase,
      purchaseOccurredOn,
      occurredOn,
      installmentIndex,
      installmentCount,
      generatedInstallmentCount,
    },
    commitData: {
      description,
      sourceKind: "generic_transactions",
      selectedBankConnectionId: accountId,
      isInstallment: true,
      purchaseDescriptionBase: "Compra Loja",
      normalizedPurchaseDescriptionBase: normalizedBase,
      purchaseOccurredOn,
      occurredOn,
      installmentIndex,
      installmentCount,
      generatedInstallmentCount,
    },
  });
}

async function loadDatabaseModule() {
  process.env.DATABASE_URL = "postgres://finance:test@localhost:5432/finance";
  return import("./database.js");
}

describe("transaction import commit dispatcher", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    runMigrationsMock.mockResolvedValue(undefined);
    suggestImportCategoriesMock.mockResolvedValue([]);
    pgState.current = createDbState();
  });

  afterEach(() => {
    pgState.current = null;
  });

  it("commits a universal preview using the global selected account", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-global", {
      kind: "universal",
      previewToken: "universal-global",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 10,
      items: [buildUniversalSessionRow()],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-global",
      items: [
        {
          rowIndex: 1,
          description: "iFood pedido",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(1);
    expect(result.failedCount).toBe(0);
    expect(result.results[0]).toMatchObject({ status: "imported", rowIndex: 1 });
    expect(pgState.current?.inserts).toHaveLength(1);
    expect(pgState.current?.inserts[0]).toMatchObject({
      description: "iFood pedido",
      amount: -67.9,
      occurredOn: "2026-04-06",
    });
  });

  it("supports a per-row account override for universal previews", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-row-account", {
      kind: "universal",
      previewToken: "universal-row-account",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "credit_card_statement",
      selectedBankConnectionId: null,
      items: [
        buildUniversalSessionRow({
          original: { sourceKind: "credit_card_statement", importSource: "credit_card_statement" },
          commitData: { sourceKind: "credit_card_statement", selectedBankConnectionId: null },
        }),
      ],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-row-account",
      items: [
        {
          rowIndex: 1,
          description: "iFood pedido",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          bankConnectionId: 20,
          sourceKind: "credit_card_statement",
        },
      ],
    });

    expect(result.importedCount).toBe(1);
    expect(result.results[0].status).toBe("imported");
    expect(pgState.current?.inserts[0].seedKey).toBeTruthy();
  });

  it("returns a row-level failure when a universal row has no account", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-missing-account", {
      kind: "universal",
      previewToken: "universal-missing-account",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: null,
      items: [buildUniversalSessionRow()],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-missing-account",
      items: [
        {
          rowIndex: 1,
          description: "iFood pedido",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(0);
    expect(result.failedCount).toBe(1);
    expect(result.results[0]).toMatchObject({
      status: "failed",
      message: "Selecione a conta ou cartao desta linha antes de confirmar a importacao.",
    });
  });

  it("detects universal duplicates by externalId before inserting", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");
    const duplicateSeed = createHash("sha256")
      .update(["universal_external_id_v1", "7", "10", "json-transactions", "generic_transactions", "txn-123"].join("|"))
      .digest("hex");

    pgState.current?.transactionsBySeed.set(duplicateSeed, {
      id: 999,
      row: {
        id: 999,
        description: "ja importada",
        amount: -67.9,
        occurred_on: "2026-04-06",
        seed_key: duplicateSeed,
      },
    });

    setUniversalPreviewSession("universal-duplicate-external", {
      kind: "universal",
      previewToken: "universal-duplicate-external",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 10,
      items: [
        buildUniversalSessionRow({
          commitData: {
            externalId: "txn-123",
            parserId: "json-transactions",
          },
        }),
      ],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-duplicate-external",
      items: [
        {
          rowIndex: 1,
          description: "iFood pedido",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(result.results[0].reason).toBe("duplicate");
    expect(pgState.current?.inserts).toHaveLength(0);
  });

  it("preserves installment expansion for universal generic rows", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-installments", {
      kind: "universal",
      previewToken: "universal-installments",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 20,
      items: [
        buildUniversalSessionRow({
          original: {
            description: "Kabum 3/4",
            sourceKind: "generic_transactions",
            importSource: "generic_transactions",
            isInstallment: true,
            purchaseDescriptionBase: "Kabum",
            normalizedPurchaseDescriptionBase: "kabum",
            purchaseOccurredOn: "2026-02-25",
            installmentIndex: 3,
            installmentCount: 4,
            generatedInstallmentCount: 4,
          },
          commitData: {
            description: "Kabum 3/4",
            sourceKind: "generic_transactions",
            selectedBankConnectionId: 20,
            isInstallment: true,
            purchaseDescriptionBase: "Kabum",
            normalizedPurchaseDescriptionBase: "kabum",
            purchaseOccurredOn: "2026-02-25",
            installmentIndex: 3,
            installmentCount: 4,
            generatedInstallmentCount: 4,
          },
        }),
      ],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-installments",
      items: [
        {
          rowIndex: 1,
          description: "Kabum 3/4",
          amount: "154.25",
          occurredOn: "2026-03-25",
          type: "expense",
          categoryId: 4,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(4);
    expect(pgState.current?.inserts).toHaveLength(4);
    expect(pgState.current?.inserts.map((item) => item.description)).toEqual(["Kabum 1/4", "Kabum 2/4", "Kabum 3/4", "Kabum 4/4"]);
  });

  it("imports 'Compra Loja 1/3' as one purchase plus three installment transactions", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-installments-1-3", {
      kind: "universal",
      previewToken: "universal-installments-1-3",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 20,
      items: [
        buildUniversalInstallmentSessionRow({
          description: "Compra Loja 1/3",
          purchaseOccurredOn: "2026-03-15",
          occurredOn: "2026-03-15",
          installmentIndex: 1,
          installmentCount: 3,
        }),
      ],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-installments-1-3",
      items: [
        {
          rowIndex: 1,
          description: "Compra Loja 1/3",
          amount: "120.00",
          occurredOn: "2026-03-15",
          type: "expense",
          categoryId: 4,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(3);
    expect(pgState.current?.installmentPurchases.size).toBe(1);
    expect(pgState.current?.inserts.map((item) => item.description)).toEqual(["Compra Loja 1/3", "Compra Loja 2/3", "Compra Loja 3/3"]);
    expect(pgState.current?.inserts.map((item) => item.occurredOn)).toEqual(["2026-03-15", "2026-04-15", "2026-05-15"]);
  });

  it("imports 'Compra Loja 2/3' with the expected installment series using the existing purchase date rule", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-installments-2-3", {
      kind: "universal",
      previewToken: "universal-installments-2-3",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 20,
      items: [
        buildUniversalInstallmentSessionRow({
          description: "Compra Loja 2/3",
          purchaseOccurredOn: "2026-03-15",
          occurredOn: "2026-04-15",
          installmentIndex: 2,
          installmentCount: 3,
        }),
      ],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-installments-2-3",
      items: [
        {
          rowIndex: 1,
          description: "Compra Loja 2/3",
          amount: "120.00",
          occurredOn: "2026-04-15",
          type: "expense",
          categoryId: 4,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(3);
    expect(pgState.current?.installmentPurchases.size).toBe(1);
    expect(pgState.current?.inserts.map((item) => item.description)).toEqual(["Compra Loja 1/3", "Compra Loja 2/3", "Compra Loja 3/3"]);
    expect(pgState.current?.inserts.map((item) => item.occurredOn)).toEqual(["2026-03-15", "2026-04-15", "2026-05-15"]);
  });

  it("does not duplicate installment purchases or installment transactions when the same file is imported again", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-installments-duplicate", {
      kind: "universal",
      previewToken: "universal-installments-duplicate",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 20,
      items: [
        buildUniversalInstallmentSessionRow({
          description: "Compra Loja 1/3",
          purchaseOccurredOn: "2026-03-15",
          occurredOn: "2026-03-15",
          installmentIndex: 1,
          installmentCount: 3,
        }),
      ],
    });

    const input = {
      previewToken: "universal-installments-duplicate",
      items: [
        {
          rowIndex: 1,
          description: "Compra Loja 1/3",
          amount: "120.00",
          occurredOn: "2026-03-15",
          type: "expense" as const,
          categoryId: 4,
          sourceKind: "generic_transactions" as const,
        },
      ],
    };

    const first = await commitTransactionImport(7, input);
    const purchasesAfterFirstImport = pgState.current?.installmentPurchases.size;
    const insertsAfterFirstImport = pgState.current?.inserts.length;
    const second = await commitTransactionImport(7, input);

    expect(first.importedCount).toBe(3);
    expect(second.importedCount).toBe(0);
    expect(second.skippedCount).toBe(3);
    expect(pgState.current?.installmentPurchases.size).toBe(purchasesAfterFirstImport);
    expect(pgState.current?.inserts.length).toBe(insertsAfterFirstImport);
  });

  it("keeps non-installment universal expenses as a single imported transaction", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    setUniversalPreviewSession("universal-single-expense", {
      kind: "universal",
      previewToken: "universal-single-expense",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 10,
      items: [buildUniversalSessionRow()],
    });

    const result = await commitTransactionImport(7, {
      previewToken: "universal-single-expense",
      items: [
        {
          rowIndex: 1,
          description: "iFood pedido",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
          sourceKind: "generic_transactions",
        },
      ],
    });

    expect(result.importedCount).toBe(1);
    expect(pgState.current?.installmentPurchases.size).toBe(0);
    expect(pgState.current?.inserts).toHaveLength(1);
  });

  it("keeps AI suggestions working for universal sessions without mutating protected fields", async () => {
    const { getTransactionImportAiSuggestions } = await loadDatabaseModule();
    const { getUniversalPreviewSession, setUniversalPreviewSession } = await import("./import/preview-session-store.js");

    suggestImportCategoriesMock.mockResolvedValue({
      items: [
        {
          rowIndex: 1,
          suggestedType: "income",
          categoryKey: "salary",
          confidence: 0.93,
          reason: "Transferencia recebida",
          status: "suggested",
        },
      ],
      provider: "openai",
      model: "gpt-4o-mini",
      usage: null,
    });

    setUniversalPreviewSession("universal-ai", {
      kind: "universal",
      previewToken: "universal-ai",
      userId: "7",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60_000,
      detectedSourceKind: "generic_transactions",
      selectedBankConnectionId: 10,
      items: [
        buildUniversalSessionRow({
          original: {
            description: "Transferencia recebida",
            normalizedDescription: "transferencia recebida",
            suggestedCategoryId: null,
            type: "income",
          },
          commitData: {
            description: "Transferencia recebida",
            type: "income",
            signedAmount: 396,
            amount: 396,
          },
        }),
      ],
    });

    const result = await getTransactionImportAiSuggestions(7, {
      previewToken: "universal-ai",
      rowIndexes: [1],
    });
    const session = getUniversalPreviewSession("universal-ai", 7);

    expect(result.status).toBe("completed");
    expect(result.items[0]).toMatchObject({
      rowIndex: 1,
      aiSuggestedType: "income",
      aiSuggestedCategoryId: 3,
      aiStatus: "suggested",
    });
    expect(session.items[0].original.description).toBe("Transferencia recebida");
    expect(session.items[0].commitData.description).toBe("Transferencia recebida");
  });

  it("keeps the legacy preview + commit flow working unchanged", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();
    const { createImportPreview } = await import("./transaction-import.js");

    const preview = await createImportPreview({
      categories: [
        { id: 1, slug: "restaurantes", label: "Restaurantes", transactionType: "expense" },
        { id: 3, slug: "salario", label: "Salario", transactionType: "income" },
        { id: 4, slug: "outros-despesas", label: "Outros", transactionType: "expense" },
      ],
      existingFingerprints: new Set(),
      bankConnectionId: 10,
      bankConnectionName: "Conta Principal",
      fileBuffer: Buffer.from(["Data;Descricao;Valor", "06/04/2026;iFood;-67,90"].join("\n"), "utf8"),
      userId: 7,
    });

    const result = await commitTransactionImport(7, {
      previewToken: preview.previewToken,
      items: [
        {
          rowIndex: 1,
          description: "iFood",
          amount: "67.90",
          occurredOn: "2026-04-06",
          type: "expense",
          categoryId: 1,
        },
      ],
    });

    expect(result.importedCount).toBe(1);
    expect(result.results[0].status).toBe("imported");
  });

  it("allows universal preview with a credit-card account when no importSource hint is provided", async () => {
    const { previewTransactionImport } = await loadDatabaseModule();
    const csv = [
      "date,title,amount",
      "2026-03-19,Compra Loja - Parcela 3/10,30.99",
      "2026-03-18,Cartao credito mercado,12.45",
    ].join("\n");

    const result = await previewTransactionImport(
      7,
      Buffer.from(csv, "utf8"),
      undefined,
      20,
      "Nubank_2026-03-27.csv",
      "text/csv",
      undefined,
    );

    expect(result.detectedSourceKind).toBe("credit_card_statement");
    expect(result.selectedBankConnectionId).toBe(20);
    expect(result.bankConnectionId).toBe(20);
    expect(result.fileSummary.totalRows).toBe(2);
  });

  it("rejects a universal preview after detection when a bank statement is linked to a credit card", async () => {
    const { previewTransactionImport } = await loadDatabaseModule();
    const csv = ["Data;Descricao;Valor", "06/04/2026;Transferencia Pix;-67,90", "06/04/2026;Deposito recebido;100,00"].join(
      "\n",
    );

    await expect(
      previewTransactionImport(7, Buffer.from(csv, "utf8"), undefined, 20, "extrato.csv", "text/csv", undefined),
    ).rejects.toThrow("O extrato bancario precisa ser vinculado a uma conta nao-cartao.");
  });

  it("rejects a universal preview after detection when a credit card statement is linked to a non-card account", async () => {
    const { previewTransactionImport } = await loadDatabaseModule();
    const csv = [
      "date,title,amount",
      "2026-03-19,Compra Loja - Parcela 3/10,30.99",
      "2026-03-18,Cartao credito mercado,12.45",
    ].join("\n");

    await expect(
      previewTransactionImport(7, Buffer.from(csv, "utf8"), undefined, 10, "Nubank_2026-03-27.csv", "text/csv", undefined),
    ).rejects.toThrow("A fatura do cartao precisa ser vinculada a uma conta do tipo cartao.");
  });

  it("keeps the legacy preview compatibility check when importSource is explicit", async () => {
    const { previewTransactionImport } = await loadDatabaseModule();

    await expect(
      previewTransactionImport(7, Buffer.from("fake file"), "bank_statement", 20, "extrato.csv", "text/csv", undefined),
    ).rejects.toThrow("O extrato bancario precisa ser vinculado a uma conta nao-cartao.");
  });

  it("surfaces invalid preview tokens for commit", async () => {
    const { commitTransactionImport } = await loadDatabaseModule();

    await expect(
      commitTransactionImport(7, {
        previewToken: "missing-preview",
        items: [
          {
            rowIndex: 1,
            description: "iFood",
            amount: "67.90",
            occurredOn: "2026-04-06",
            type: "expense",
            categoryId: 1,
          },
        ],
      }),
    ).rejects.toThrow("Preview invalido ou expirado.");
  });
});
