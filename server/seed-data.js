import { formatInstallmentDescription } from "./transaction-import.js";

const DEFAULT_FINANCE_SEED = "default-finance-seed";
const DEFAULT_REFERENCE_DATE = "2026-04-09";
const GENERATED_SEED_KEY_PREFIX = "seed:";

const ACCOUNT_SPECS = {
  cash: {
    slug: "caixa",
    name: "Caixa/Dinheiro",
    accountType: "cash",
    connected: true,
    color: "bg-amber-500",
    currentBalance: 1250,
    sortOrder: 5,
    parentSlug: null,
    statementCloseDay: null,
    statementDueDay: null,
  },
  primaryBank: {
    slug: "seed-conta-principal",
    name: "Conta Principal",
    accountType: "bank_account",
    connected: true,
    color: "bg-blue-500",
    currentBalance: 0,
    sortOrder: 10,
    parentSlug: null,
    statementCloseDay: null,
    statementDueDay: null,
  },
  reserveBank: {
    slug: "seed-conta-reserva",
    name: "Conta Reserva",
    accountType: "bank_account",
    connected: true,
    color: "bg-emerald-500",
    currentBalance: 0,
    sortOrder: 20,
    parentSlug: null,
    statementCloseDay: null,
    statementDueDay: null,
  },
  primaryCard: {
    slug: "seed-cartao-principal",
    name: "Cartao Principal",
    accountType: "credit_card",
    connected: true,
    color: "bg-violet-500",
    currentBalance: 0,
    sortOrder: 30,
    parentSlug: "seed-conta-principal",
    statementCloseDay: 8,
    statementDueDay: 15,
  },
  reserveCard: {
    slug: "seed-cartao-reserva",
    name: "Cartao Reserva",
    accountType: "credit_card",
    connected: true,
    color: "bg-rose-500",
    currentBalance: 0,
    sortOrder: 40,
    parentSlug: "seed-conta-reserva",
    statementCloseDay: 22,
    statementDueDay: 1,
  },
};

const INCOME_DESCRIPTIONS = [
  "Salario mensal",
  "Projeto freelance",
  "Reembolso corporativo",
  "Venda online",
  "Bonus trimestral",
  "Consultoria avulsa",
  "Cashback",
  "Aula particular",
];

const EXPENSE_DESCRIPTIONS = [
  "Mercado do bairro",
  "Jantar fora",
  "Remedios e farmacia",
  "Corrida de aplicativo",
  "Sessao de cinema",
  "Servico de streaming",
  "Plano anual digital",
  "Passagem urbana",
  "Mensalidade da academia",
  "Pedido de delivery",
  "Compra na loja online",
  "Consulta de rotina",
  "Ingresso de show",
  "Compra no shopping",
  "Plano de musica",
  "Corrida noturna",
];

const DEFAULT_EXPENSE_CATEGORY_SLUGS = [
  "outros-despesas",
  "transporte",
  "alimentacao",
  "supermercado",
  "assinaturas",
  "lazer",
  "compras",
  "saude",
];

function normalizeDateOnly(value) {
  return new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
}

function toDateOnlyString(date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(dateValue, months) {
  const source = normalizeDateOnly(dateValue);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth() + months;
  const day = source.getUTCDate();
  const candidate = new Date(Date.UTC(year, month, 1, 12, 0, 0));
  const lastDay = new Date(Date.UTC(candidate.getUTCFullYear(), candidate.getUTCMonth() + 1, 0, 12, 0, 0)).getUTCDate();
  candidate.setUTCDate(Math.min(day, lastDay));
  return candidate;
}

function shiftDays(dateValue, days) {
  const next = normalizeDateOnly(dateValue);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function hashSeed(seed) {
  let hash = 1779033703 ^ String(seed).length;

  for (const character of String(seed)) {
    hash = Math.imul(hash ^ character.charCodeAt(0), 3432918353);
    hash = (hash << 13) | (hash >>> 19);
  }

  return () => {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    hash ^= hash >>> 16;
    return hash >>> 0;
  };
}

export function createDeterministicRandom(seed = DEFAULT_FINANCE_SEED) {
  const nextSeed = hashSeed(seed);
  let state = nextSeed();

  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function pickOne(random, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("cannot pick from an empty list");
  }

  return items[randomInt(random, 0, items.length - 1)];
}

function randomCurrency(random, min, max) {
  return Number((min + random() * (max - min)).toFixed(2));
}

function buildSeedKey(...parts) {
  return [GENERATED_SEED_KEY_PREFIX, ...parts].join("");
}

function buildGeneratedDescription(random, pool, index) {
  const base = pool[index % pool.length];
  const suffix = randomInt(random, 1, 999);
  return `${base} ${suffix}`;
}

export function selectIncomeOrigin({ random, cashAccount, bankAccounts }) {
  if (random() < 0.3) {
    return cashAccount;
  }

  return pickOne(random, bankAccounts);
}

export function selectExpensePaymentMethod({ random, bankAccounts, creditCards }) {
  if (random() < 0.45) {
    return pickOne(random, bankAccounts);
  }

  return pickOne(random, creditCards);
}

export function pickBankAccountForCard({ random, bankAccounts }) {
  return pickOne(random, bankAccounts);
}

export function buildCardInstallmentPurchase({
  random,
  creditCard,
  expenseCategory,
  purchaseIndex,
  referenceDate = DEFAULT_REFERENCE_DATE,
}) {
  if (!creditCard || creditCard.accountType !== "credit_card") {
    throw new Error("installment purchases require a credit card origin");
  }

  const installmentCount = randomInt(random, 2, 12);
  const amountPerInstallment = randomCurrency(random, 45, 480);
  const purchaseOccurredOn = toDateOnlyString(shiftDays(referenceDate, -randomInt(random, 0, 75)));
  const descriptionBase = buildGeneratedDescription(random, EXPENSE_DESCRIPTIONS, purchaseIndex);
  const installmentPurchaseSeedKey = buildSeedKey(`installment_purchase:${String(purchaseIndex).padStart(3, "0")}`);
  const transactions = [];

  for (let installmentNumber = 1; installmentNumber <= installmentCount; installmentNumber += 1) {
    transactions.push({
      seedKey: buildSeedKey(
        `installment_transaction:${String(purchaseIndex).padStart(3, "0")}:${String(installmentNumber).padStart(2, "0")}`,
      ),
      categoryId: expenseCategory.id,
      bankConnectionId: creditCard.id,
      description: formatInstallmentDescription(descriptionBase, installmentNumber, installmentCount),
      amount: -Math.abs(amountPerInstallment),
      occurredOn: toDateOnlyString(addMonths(purchaseOccurredOn, installmentNumber - 1)),
      installmentNumber,
    });
  }

  return {
    purchase: {
      seedKey: installmentPurchaseSeedKey,
      bankConnectionId: creditCard.id,
      categoryId: expenseCategory.id,
      descriptionBase,
      normalizedDescriptionBase: descriptionBase.toLowerCase(),
      purchaseOccurredOn,
      installmentCount,
      amountPerInstallment,
    },
    transactions,
  };
}

export function generateIncomeTransactions({
  random,
  count,
  cashAccount,
  bankAccounts,
  incomeCategories,
  referenceDate = DEFAULT_REFERENCE_DATE,
}) {
  const transactions = [];

  for (let index = 0; index < count; index += 1) {
    const origin = selectIncomeOrigin({ random, cashAccount, bankAccounts });
    const category = pickOne(random, incomeCategories);
    transactions.push({
      seedKey: buildSeedKey(`income:${String(index).padStart(3, "0")}`),
      categoryId: category.id,
      bankConnectionId: origin.id,
      description: buildGeneratedDescription(random, INCOME_DESCRIPTIONS, index),
      amount: randomCurrency(random, 180, 7200),
      occurredOn: toDateOnlyString(shiftDays(referenceDate, -randomInt(random, 0, 80))),
      installmentPurchaseId: null,
      installmentNumber: null,
    });
  }

  return transactions;
}

export function generateExpenseTransactions({
  random,
  count,
  bankAccounts,
  creditCards,
  expenseCategories,
  referenceDate = DEFAULT_REFERENCE_DATE,
}) {
  const standaloneTransactions = [];
  const installmentPurchases = [];
  let purchaseIndex = 0;

  for (let index = 0; index < count; index += 1) {
    const paymentOrigin = selectExpensePaymentMethod({ random, bankAccounts, creditCards });
    const category = pickOne(random, expenseCategories);
    const baseOccurredOn = toDateOnlyString(shiftDays(referenceDate, -randomInt(random, 0, 80)));

    if (paymentOrigin.accountType === "credit_card" && random() < 0.4) {
      const installmentPurchase = buildCardInstallmentPurchase({
        random,
        creditCard: paymentOrigin,
        expenseCategory: category,
        purchaseIndex,
        referenceDate: baseOccurredOn,
      });
      installmentPurchases.push(installmentPurchase);
      purchaseIndex += 1;
      continue;
    }

    standaloneTransactions.push({
      seedKey: buildSeedKey(`expense:${String(index).padStart(3, "0")}`),
      categoryId: category.id,
      bankConnectionId: paymentOrigin.id,
      description: buildGeneratedDescription(random, EXPENSE_DESCRIPTIONS, index),
      amount: -Math.abs(randomCurrency(random, 18, 1450)),
      occurredOn: baseOccurredOn,
      installmentPurchaseId: null,
      installmentNumber: null,
    });
  }

  return {
    standaloneTransactions,
    installmentPurchases,
  };
}

export async function createSeedBankConnections(client, userId) {
  const insertedBySlug = new Map();

  await client.query(
    `
      UPDATE bank_connections
      SET account_type = 'bank_account',
          parent_bank_connection_id = NULL,
          statement_close_day = NULL,
          statement_due_day = NULL,
          updated_at = NOW()
      WHERE user_id = $1
        AND slug = 'nubank'
        AND account_type = 'credit_card'
        AND parent_bank_connection_id IS NULL
    `,
    [userId],
  );

  for (const spec of Object.values(ACCOUNT_SPECS)) {
    const parentId = spec.parentSlug ? insertedBySlug.get(spec.parentSlug) ?? null : null;
    const result = await client.query(
      `
        INSERT INTO bank_connections (
          user_id,
          slug,
          name,
          account_type,
          connected,
          color,
          current_balance,
          sort_order,
          parent_bank_connection_id,
          statement_close_day,
          statement_due_day
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (user_id, slug) DO UPDATE
        SET name = EXCLUDED.name,
            account_type = EXCLUDED.account_type,
            connected = EXCLUDED.connected,
            color = EXCLUDED.color,
            current_balance = EXCLUDED.current_balance,
            sort_order = EXCLUDED.sort_order,
            parent_bank_connection_id = EXCLUDED.parent_bank_connection_id,
            statement_close_day = EXCLUDED.statement_close_day,
            statement_due_day = EXCLUDED.statement_due_day,
            updated_at = NOW()
        RETURNING id, slug, name, account_type, parent_bank_connection_id
      `,
      [
        userId,
        spec.slug,
        spec.name,
        spec.accountType,
        spec.connected,
        spec.color,
        spec.currentBalance,
        spec.sortOrder,
        parentId,
        spec.statementCloseDay,
        spec.statementDueDay,
      ],
    );
    const row = result.rows[0];
    insertedBySlug.set(spec.slug, row.id);
  }

  const accountsResult = await client.query(
    `
      SELECT id, slug, name, account_type, parent_bank_connection_id
      FROM bank_connections
      WHERE user_id = $1
        AND slug = ANY($2::text[])
      ORDER BY sort_order ASC, id ASC
    `,
    [userId, Object.values(ACCOUNT_SPECS).map((item) => item.slug)],
  );

  const accounts = accountsResult.rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    name: row.name,
    accountType: row.account_type,
    parentBankConnectionId: row.parent_bank_connection_id === null ? null : Number(row.parent_bank_connection_id),
  }));

  return {
    cashAccount: accounts.find((item) => item.accountType === "cash"),
    bankAccounts: accounts.filter((item) => item.accountType === "bank_account"),
    creditCards: accounts.filter((item) => item.accountType === "credit_card"),
    allAccounts: accounts,
  };
}

async function getPrimaryUser(client) {
  const result = await client.query(
    `
      SELECT id, name
      FROM users
      ORDER BY id ASC
      LIMIT 1
    `,
  );

  return result.rows[0] ?? null;
}

async function listCategoriesByType(client, transactionType) {
  const result = await client.query(
    `
      SELECT id, slug, label, transaction_type
      FROM categories
      WHERE transaction_type = $1
      ORDER BY sort_order ASC, id ASC
    `,
    [transactionType],
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    slug: row.slug,
    label: row.label,
    transactionType: row.transaction_type,
  }));
}

export function selectSeedCategoriesBySlug(categories, preferredSlugs) {
  const categoriesBySlug = new Map(categories.map((category) => [category.slug, category]));
  const selectedCategories = preferredSlugs
    .map((slug) => categoriesBySlug.get(slug))
    .filter(Boolean);

  if (selectedCategories.length !== preferredSlugs.length) {
    const missingSlugs = preferredSlugs.filter((slug) => !categoriesBySlug.has(slug));
    throw new Error(`missing required seed categories: ${missingSlugs.join(", ")}`);
  }

  return selectedCategories;
}

async function clearGeneratedFinancialData(client, userId) {
  await client.query(
    `
      DELETE FROM transactions
      WHERE user_id = $1
        AND seed_key LIKE 'seed:%'
    `,
    [userId],
  );

  await client.query(
    `
      DELETE FROM installment_purchases
      WHERE user_id = $1
        AND seed_key LIKE 'seed:%'
    `,
    [userId],
  );
}

async function insertInstallmentPurchase(client, userId, purchase) {
  const result = await client.query(
    `
      INSERT INTO installment_purchases (
        user_id,
        bank_connection_id,
        category_id,
        seed_key,
        description_base,
        normalized_description_base,
        purchase_occurred_on,
        installment_count,
        amount_per_installment
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, seed_key) DO UPDATE
      SET bank_connection_id = EXCLUDED.bank_connection_id,
          category_id = EXCLUDED.category_id,
          description_base = EXCLUDED.description_base,
          normalized_description_base = EXCLUDED.normalized_description_base,
          purchase_occurred_on = EXCLUDED.purchase_occurred_on,
          installment_count = EXCLUDED.installment_count,
          amount_per_installment = EXCLUDED.amount_per_installment,
          updated_at = NOW()
      RETURNING id
    `,
    [
      userId,
      purchase.bankConnectionId,
      purchase.categoryId,
      purchase.seedKey,
      purchase.descriptionBase,
      purchase.normalizedDescriptionBase,
      purchase.purchaseOccurredOn,
      purchase.installmentCount,
      purchase.amountPerInstallment,
    ],
  );

  return Number(result.rows[0].id);
}

async function insertTransaction(client, userId, transaction) {
  await client.query(
    `
      INSERT INTO transactions (
        user_id,
        seed_key,
        category_id,
        bank_connection_id,
        description,
        amount,
        occurred_on,
        installment_purchase_id,
        installment_number
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (user_id, seed_key) DO UPDATE
      SET category_id = EXCLUDED.category_id,
          bank_connection_id = EXCLUDED.bank_connection_id,
          description = EXCLUDED.description,
          amount = EXCLUDED.amount,
          occurred_on = EXCLUDED.occurred_on,
          installment_purchase_id = EXCLUDED.installment_purchase_id,
          installment_number = EXCLUDED.installment_number
    `,
    [
      userId,
      transaction.seedKey,
      transaction.categoryId,
      transaction.bankConnectionId,
      transaction.description,
      transaction.amount,
      transaction.occurredOn,
      transaction.installmentPurchaseId ?? null,
      transaction.installmentNumber ?? null,
    ],
  );
}

export async function validateSeedFinancialInvariants(client, userId) {
  const invalidIncomeOnCard = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      JOIN bank_connections b ON b.id = t.bank_connection_id
      WHERE t.user_id = $1
        AND c.transaction_type = 'income'
        AND b.account_type = 'credit_card'
    `,
    [userId],
  );
  const invalidExpenseWithoutValidOrigin = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
      WHERE t.user_id = $1
        AND c.transaction_type = 'expense'
        AND (
          b.id IS NULL
          OR b.account_type NOT IN ('bank_account', 'credit_card', 'cash')
        )
    `,
    [userId],
  );
  const invalidNonCardInstallments = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM transactions t
      LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
      LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
      WHERE t.user_id = $1
        AND t.installment_purchase_id IS NOT NULL
        AND (
          ip.id IS NULL
          OR b.id IS NULL
          OR b.account_type <> 'credit_card'
          OR t.installment_number IS NULL
          OR ip.installment_count < 2
        )
    `,
    [userId],
  );
  const invalidCardsWithoutParentAccount = await client.query(
    `
      SELECT COUNT(*)::INT AS total
      FROM bank_connections card
      LEFT JOIN bank_connections parent ON parent.id = card.parent_bank_connection_id
      WHERE card.user_id = $1
        AND card.account_type = 'credit_card'
        AND (
          parent.id IS NULL
          OR parent.account_type <> 'bank_account'
        )
    `,
    [userId],
  );

  const counts = {
    invalidIncomeOnCard: Number(invalidIncomeOnCard.rows[0]?.total ?? 0),
    invalidExpenseWithoutValidOrigin: Number(invalidExpenseWithoutValidOrigin.rows[0]?.total ?? 0),
    invalidNonCardInstallments: Number(invalidNonCardInstallments.rows[0]?.total ?? 0),
    invalidCardsWithoutParentAccount: Number(invalidCardsWithoutParentAccount.rows[0]?.total ?? 0),
  };

  if (Object.values(counts).some((value) => value > 0)) {
    throw new Error(`seed financial invariants violated: ${JSON.stringify(counts)}`);
  }

  return counts;
}

export async function runSeedData(pool, options = {}) {
  const seed = options.seed ?? process.env.FINANCE_SEED ?? DEFAULT_FINANCE_SEED;
  const referenceDate = options.referenceDate ?? process.env.FINANCE_SEED_REFERENCE_DATE ?? DEFAULT_REFERENCE_DATE;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const user = await getPrimaryUser(client);

    if (!user) {
      throw new Error("no user available for financial seed generation");
    }

    await clearGeneratedFinancialData(client, user.id);

    const categories = {
      income: await listCategoriesByType(client, "income"),
      expense: selectSeedCategoriesBySlug(await listCategoriesByType(client, "expense"), DEFAULT_EXPENSE_CATEGORY_SLUGS),
    };

    if (!categories.income.length || !categories.expense.length) {
      throw new Error("missing income or expense categories for financial seed generation");
    }

    const random = createDeterministicRandom(seed);
    const accounts = await createSeedBankConnections(client, user.id);

    if (!accounts.cashAccount || accounts.bankAccounts.length < 2 || accounts.creditCards.length < 2) {
      throw new Error("seed bank connections were not created as expected");
    }

    const incomeCount = randomInt(random, 12, 20);
    const expenseCount = randomInt(random, 40, 80);
    const incomes = generateIncomeTransactions({
      random,
      count: incomeCount,
      cashAccount: accounts.cashAccount,
      bankAccounts: accounts.bankAccounts,
      incomeCategories: categories.income,
      referenceDate,
    });
    const expenses = generateExpenseTransactions({
      random,
      count: expenseCount,
      bankAccounts: accounts.bankAccounts,
      creditCards: accounts.creditCards,
      expenseCategories: categories.expense,
      referenceDate,
    });

    for (const transaction of incomes) {
      await insertTransaction(client, user.id, transaction);
    }

    for (const transaction of expenses.standaloneTransactions) {
      await insertTransaction(client, user.id, transaction);
    }

    for (const installmentBundle of expenses.installmentPurchases) {
      const installmentPurchaseId = await insertInstallmentPurchase(client, user.id, installmentBundle.purchase);

      for (const transaction of installmentBundle.transactions) {
        await insertTransaction(client, user.id, {
          ...transaction,
          installmentPurchaseId,
        });
      }
    }

    const validation = await validateSeedFinancialInvariants(client, user.id);
    await client.query("COMMIT");

    return {
      seed,
      referenceDate,
      userId: Number(user.id),
      generated: {
        incomes: incomes.length,
        standaloneExpenses: expenses.standaloneTransactions.length,
        installmentPurchases: expenses.installmentPurchases.length,
        installmentTransactions: expenses.installmentPurchases.reduce(
          (total, item) => total + item.transactions.length,
          0,
        ),
      },
      validation,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export const verificationQueries = {
  invalidIncomeOnCard: `
    SELECT COUNT(*) AS invalid_income_on_card
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    JOIN bank_connections b ON b.id = t.bank_connection_id
    WHERE c.transaction_type = 'income'
      AND b.account_type = 'credit_card';
  `,
  invalidExpenseWithoutValidOrigin: `
    SELECT COUNT(*) AS invalid_expense_without_valid_origin
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
    WHERE c.transaction_type = 'expense'
      AND (
        b.id IS NULL
        OR b.account_type NOT IN ('bank_account', 'credit_card')
      );
  `,
  invalidNonCardInstallments: `
    SELECT COUNT(*) AS invalid_non_card_installments
    FROM transactions t
    LEFT JOIN installment_purchases ip ON ip.id = t.installment_purchase_id
    LEFT JOIN bank_connections b ON b.id = t.bank_connection_id
    WHERE t.installment_purchase_id IS NOT NULL
      AND (
        ip.id IS NULL
        OR b.id IS NULL
        OR b.account_type <> 'credit_card'
        OR t.installment_number IS NULL
        OR ip.installment_count < 2
      );
  `,
  invalidCardsWithoutParentAccount: `
    SELECT COUNT(*) AS invalid_cards_without_parent_account
    FROM bank_connections card
    LEFT JOIN bank_connections parent ON parent.id = card.parent_bank_connection_id
    WHERE card.account_type = 'credit_card'
      AND (
        parent.id IS NULL
        OR parent.account_type <> 'bank_account'
      );
  `,
};
