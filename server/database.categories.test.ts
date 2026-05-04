import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runMigrationsMock = vi.hoisted(() => vi.fn());
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
    enabled: false,
    autoApplyThreshold: 0.8,
    maxRowsPerRequest: 20,
    provider: "openai",
    model: "gpt-4o-mini",
  }),
  suggestImportCategories: vi.fn(),
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
      id: 10,
      user_id: 1,
      slug: "compras",
      label: "Compras",
      transaction_type: "expense",
      icon: "ShoppingBag",
      color: "#f97316",
      group_slug: "compras",
      group_label: "Compras",
      group_color: "#f97316",
      is_system: true,
      sort_order: 70,
    },
    {
      id: 11,
      user_id: 1,
      slug: "salario",
      label: "Salario",
      transaction_type: "income",
      icon: "Wallet",
      color: "text-income",
      group_slug: "receitas",
      group_label: "Receitas",
      group_color: "bg-income",
      is_system: true,
      sort_order: 100,
    },
    {
      id: 12,
      user_id: 1,
      slug: "freelas",
      label: "Freelas",
      transaction_type: "income",
      icon: "TrendingUp",
      color: "#22c55e",
      group_slug: "receitas-extra",
      group_label: "Receitas Extra",
      group_color: "#22c55e",
      is_system: false,
      sort_order: 120,
    },
    {
      id: 13,
      user_id: 1,
      slug: "viagens-antigas",
      label: "Viagens Antigas",
      transaction_type: "expense",
      icon: "Plane",
      color: "#0ea5e9",
      group_slug: "lazer",
      group_label: "Lazer",
      group_color: "#0ea5e9",
      is_system: false,
      sort_order: 130,
    },
    {
      id: 20,
      user_id: 2,
      slug: "compras",
      label: "Compras",
      transaction_type: "expense",
      icon: "ShoppingBag",
      color: "#f97316",
      group_slug: "compras",
      group_label: "Compras",
      group_color: "#f97316",
      is_system: true,
      sort_order: 70,
    },
    {
      id: 21,
      user_id: 2,
      slug: "salario",
      label: "Salario",
      transaction_type: "income",
      icon: "Wallet",
      color: "text-income",
      group_slug: "receitas",
      group_label: "Receitas",
      group_color: "bg-income",
      is_system: true,
      sort_order: 100,
    },
    {
      id: 22,
      user_id: 2,
      slug: "viagens",
      label: "Viagens",
      transaction_type: "expense",
      icon: "Plane",
      color: "#38bdf8",
      group_slug: "lazer",
      group_label: "Lazer",
      group_color: "#38bdf8",
      is_system: false,
      sort_order: 110,
    },
  ];
  const bankConnections = [
    { id: 100, user_id: 1, slug: "conta-1", name: "Conta 1", account_type: "checking", color: "#111111" },
    { id: 200, user_id: 2, slug: "conta-2", name: "Conta 2", account_type: "checking", color: "#222222" },
  ];
  const transactions = [
    {
      id: 500,
      user_id: 2,
      description: "Aluguel",
      amount: "-1200.00",
      occurred_on: "2026-05-01",
      bank_connection_id: 200,
      category_id: 20,
      is_recurring: false,
      recurrence_ends_on: null,
      housing_id: null,
      installment_purchase_id: null,
      installment_number: null,
    },
  ];
  const categoryUsage = new Set(["1:12"]);
  let nextCategoryId = 30;
  let nextTransactionId = 900;

  function findCategory(userId: number, categoryId: number) {
    return categories.find((item) => item.user_id === userId && item.id === categoryId) ?? null;
  }

  function buildTransactionRow(userId: number, transactionId: number) {
    const transaction = transactions.find((item) => item.user_id === userId && item.id === transactionId);

    if (!transaction) {
      return null;
    }

    const bank = bankConnections.find((item) => item.id === transaction.bank_connection_id) ?? null;
    const category = categories.find((item) => item.id === transaction.category_id) ?? null;

    if (!bank || !category) {
      return null;
    }

    return {
      id: transaction.id,
      description: transaction.description,
      amount: transaction.amount,
      occurred_on: transaction.occurred_on,
      housing_id: transaction.housing_id,
      installment_purchase_id: transaction.installment_purchase_id,
      installment_number: transaction.installment_number,
      bank_connection_id: bank.id,
      bank_slug: bank.slug,
      bank_name: bank.name,
      bank_account_type: bank.account_type,
      bank_color: bank.color,
      category_id: category.id,
      category_slug: category.slug,
      category_label: category.label,
      category_icon: category.icon,
      category_color: category.color,
      group_slug: category.group_slug,
      group_label: category.group_label,
      group_color: category.group_color,
      is_recurring: transaction.is_recurring,
      recurrence_ends_on: transaction.recurrence_ends_on,
      installment_count: null,
      purchase_occurred_on: null,
    };
  }

  return {
    handleQuery(sql: string, params: unknown[]) {
      const normalizedSql = sql.replace(/\s+/g, " ").trim();

      if (normalizedSql === "BEGIN" || normalizedSql === "COMMIT" || normalizedSql === "ROLLBACK") {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (
        normalizedSql.includes(
          "SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system",
        ) &&
        normalizedSql.includes("FROM categories") &&
        normalizedSql.includes("WHERE user_id = $1") &&
        normalizedSql.includes("ORDER BY sort_order ASC, label ASC, id ASC")
      ) {
        const userId = Number(params[0]);
        const rows = categories
          .filter((item) => item.user_id === userId)
          .sort(
            (left, right) =>
              left.sort_order - right.sort_order || left.label.localeCompare(right.label) || left.id - right.id,
          );
        return Promise.resolve({ rows, rowCount: rows.length });
      }

      if (normalizedSql.includes("SELECT COUNT(*)::INT AS total FROM categories WHERE user_id = $1")) {
        const userId = Number(params[0]);
        const slug = String(params[1]);
        const slugLike = String(params[2]).replace("%", "");
        const total = categories.filter(
          (item) => item.user_id === userId && (item.slug === slug || item.slug.startsWith(slugLike)),
        ).length;
        return Promise.resolve({ rows: [{ total }], rowCount: 1 });
      }

      if (
        normalizedSql.includes(
          "SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_sort_order FROM categories WHERE user_id = $1",
        )
      ) {
        const userId = Number(params[0]);
        const maxSort = categories
          .filter((item) => item.user_id === userId)
          .reduce((max, item) => Math.max(max, item.sort_order), 0);
        return Promise.resolve({ rows: [{ next_sort_order: maxSort + 10 }], rowCount: 1 });
      }

      if (normalizedSql.includes("INSERT INTO categories ( user_id,")) {
        const created = {
          id: nextCategoryId++,
          user_id: Number(params[0]),
          slug: String(params[1]),
          label: String(params[2]),
          transaction_type: String(params[3]),
          icon: String(params[4]),
          color: String(params[5]),
          group_slug: String(params[6]),
          group_label: String(params[7]),
          group_color: String(params[8]),
          sort_order: Number(params[9]),
          is_system: false,
        };
        categories.push(created);
        return Promise.resolve({ rows: [created], rowCount: 1 });
      }

      if (
        normalizedSql.includes(
          "SELECT id, slug, label, transaction_type, icon, color, group_slug, group_label, group_color, is_system",
        ) &&
        normalizedSql.includes("FROM categories") &&
        normalizedSql.includes("WHERE user_id = $1 AND id = $2 LIMIT 1")
      ) {
        const row = findCategory(Number(params[0]), Number(params[1]));
        return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
      }

      if (normalizedSql.includes("UPDATE categories SET label = $2")) {
        const category = findCategory(Number(params[7]), Number(params[0]));

        if (!category) {
          return Promise.resolve({ rows: [], rowCount: 0 });
        }

        category.label = String(params[1]);
        category.icon = String(params[2]);
        category.color = String(params[3]);
        category.group_slug = String(params[4]);
        category.group_label = String(params[5]);
        category.group_color = String(params[6]);
        return Promise.resolve({ rows: [category], rowCount: 1 });
      }

      if (normalizedSql.includes("SELECT EXISTS ( SELECT 1 FROM transactions")) {
        const inUse = categoryUsage.has(`${Number(params[0])}:${Number(params[1])}`);
        return Promise.resolve({ rows: [{ in_use: inUse }], rowCount: 1 });
      }

      if (normalizedSql.includes("DELETE FROM categories WHERE user_id = $1 AND id = $2")) {
        const index = categories.findIndex(
          (item) => item.user_id === Number(params[0]) && item.id === Number(params[1]),
        );

        if (index >= 0) {
          categories.splice(index, 1);
          return Promise.resolve({ rows: [], rowCount: 1 });
        }

        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (normalizedSql.includes("FROM bank_connections WHERE user_id = $1 AND id = $2 LIMIT 1")) {
        const row =
          bankConnections.find((item) => item.user_id === Number(params[0]) && item.id === Number(params[1])) ?? null;
        return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
      }

      if (
        normalizedSql.includes(
          "INSERT INTO transactions (user_id, bank_connection_id, category_id, description, amount, occurred_on, is_recurring)",
        )
      ) {
        const created = {
          id: nextTransactionId++,
          user_id: Number(params[0]),
          bank_connection_id: Number(params[1]),
          category_id: Number(params[2]),
          description: String(params[3]),
          amount: Number(params[4]).toFixed(2),
          occurred_on: String(params[5]),
          is_recurring: Boolean(params[6]),
          recurrence_ends_on: null,
          housing_id: null,
          installment_purchase_id: null,
          installment_number: null,
        };
        transactions.push(created);
        return Promise.resolve({ rows: [{ id: created.id }], rowCount: 1 });
      }

      if (
        normalizedSql.includes("SELECT id, public_id, title, description, source, goal_type") &&
        normalizedSql.includes("FROM plans") &&
        normalizedSql.includes("WHERE user_id = $1") &&
        normalizedSql.includes("goal_type = 'transaction_sum'") &&
        normalizedSql.includes("goal_target_model = 'category'")
      ) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }

      if (
        normalizedSql.includes("SELECT t.id, t.description, t.amount, t.occurred_on") &&
        normalizedSql.includes("FROM transactions t") &&
        normalizedSql.includes("WHERE t.user_id = $1") &&
        normalizedSql.includes("AND t.id = $2 LIMIT 1")
      ) {
        const row = buildTransactionRow(Number(params[0]), Number(params[1]));
        return Promise.resolve({ rows: row ? [row] : [], rowCount: row ? 1 : 0 });
      }

      throw new Error(`Unhandled SQL in database.categories.test.ts: ${normalizedSql}`);
    },
  };
}

async function loadDatabaseModule() {
  vi.resetModules();
  return import("./database.js");
}

describe("database category user scope", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "postgres://finance:test@localhost:5432/finance_test";
    pgState.current = createDbState();
    runMigrationsMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lists and creates categories within the authenticated user scope", async () => {
    const { createCategory, listCategories } = await loadDatabaseModule();

    const before = await listCategories(1);
    expect(before.map((item) => item.id)).toEqual([10, 11, 12, 13]);

    const created = await createCategory(1, {
      label: "Eventos",
      transactionType: "expense",
      icon: "Plane",
      color: "#38bdf8",
      groupLabel: "Lazer",
      groupColor: "#38bdf8",
    });

    expect(created.slug).toBe("eventos");

    const userOneCategories = await listCategories(1);
    const userTwoCategories = await listCategories(2);

    expect(userOneCategories.some((item) => item.id === created.id)).toBe(true);
    expect(userTwoCategories.map((item) => item.id)).toEqual([20, 21, 22]);
  });

  it("blocks cross-user edits and enforces deletion rules", async () => {
    const { deleteCategory, updateCategory, listCategories } = await loadDatabaseModule();

    await expect(
      updateCategory(1, 22, {
        label: "Viagens Atualizadas",
        icon: "Plane",
        color: "#38bdf8",
        groupLabel: "Lazer",
        groupColor: "#38bdf8",
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: "category_not_found",
    });

    await expect(deleteCategory(1, 10)).rejects.toMatchObject({
      status: 409,
      code: "default_category_cannot_be_deleted",
    });

    await expect(deleteCategory(1, 12)).rejects.toMatchObject({
      status: 409,
      code: "category_in_use",
    });

    await deleteCategory(1, 13);

    const categories = await listCategories(1);
    expect(categories.some((item) => item.id === 13)).toBe(false);
  });

  it("rejects category ids that belong to another user during transaction creation", async () => {
    const { createTransaction } = await loadDatabaseModule();

    await expect(
      createTransaction(1, {
        description: "Compra teste",
        amount: -120.5,
        occurredOn: "2026-05-03",
        bankConnectionId: 100,
        categoryId: 20,
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: "category_not_found",
    });
  });

  it("allows using a custom category from the same user in a transaction", async () => {
    const { createCategory, createTransaction } = await loadDatabaseModule();

    const category = await createCategory(1, {
      label: "Viagens",
      transactionType: "expense",
      icon: "Plane",
      color: "#38bdf8",
      groupLabel: "Lazer",
      groupColor: "#38bdf8",
    });

    const transaction = await createTransaction(1, {
      description: "Hotel",
      amount: -450,
      occurredOn: "2026-05-04",
      bankConnectionId: 100,
      categoryId: category.id,
    });

    expect(transaction.category.id).toBe(category.id);
    expect(transaction.category.label).toBe("Viagens");
  });

  it("treats transactions from another user as not found during updates", async () => {
    const { updateTransaction } = await loadDatabaseModule();

    await expect(
      updateTransaction(1, 500, {
        description: "Aluguel",
        amount: -1200,
        occurredOn: "2026-05-01",
        bankConnectionId: 100,
        categoryId: 10,
        isRecurring: false,
      }),
    ).rejects.toMatchObject({
      status: 404,
      code: "transaction_not_found",
    });
  });
});
