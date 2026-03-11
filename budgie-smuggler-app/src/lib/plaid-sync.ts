import { CountryCode, Products } from "plaid";
import type { AccountBase, TransactionsSyncResponse } from "plaid";
import { startOfMonth } from "date-fns";
import { APP_NAME } from "@/lib/constants";
import { createPlaidClient } from "@/lib/plaid";
import { encrypt, decrypt } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";
import { inferCategoryNameFromPlaid } from "@/lib/category-mapping";

function parseDirection(amount: number) {
  return amount >= 0 ? "debit" : "credit";
}

function normalizeAmount(amount: number) {
  return Math.round(Math.abs(amount) * 100) / 100;
}

async function upsertAccounts(userId: string, plaidItemRefId: string, accounts: AccountBase[]) {
  if (!prisma) {
    return;
  }
  const db = prisma;

  await Promise.all(
    accounts.map((account) =>
      db.bankAccount.upsert({
        where: {
          plaidAccountId: account.account_id,
        },
        create: {
          ownerUserId: userId,
          plaidItemRefId,
          plaidAccountId: account.account_id,
          name: account.name,
          mask: account.mask ?? null,
          type: account.type,
          subtype: account.subtype ?? null,
          currentBalance: account.balances.current ?? null,
          availableBalance: account.balances.available ?? null,
          lastBalanceAt: new Date(),
        },
        update: {
          ownerUserId: userId,
          plaidItemRefId,
          name: account.name,
          mask: account.mask ?? null,
          type: account.type,
          subtype: account.subtype ?? null,
          currentBalance: account.balances.current ?? null,
          availableBalance: account.balances.available ?? null,
          lastBalanceAt: new Date(),
        },
      }),
    ),
  );
}

async function persistTransactions(userId: string, itemRefId: string, response: TransactionsSyncResponse) {
  if (!prisma) {
    return;
  }
  const db = prisma;

  const accounts = await db.bankAccount.findMany({
    where: {
      ownerUserId: userId,
      plaidItemRefId: itemRefId,
    },
    select: {
      id: true,
      plaidAccountId: true,
    },
  });

  const accountMap = new Map(accounts.map((account) => [account.plaidAccountId, account.id]));
  const categories = await db.category.findMany({
    where: {
      ownerUserId: userId,
    },
    select: {
      id: true,
      name: true,
    },
  });
  const categoryByLowerName = new Map(categories.map((category) => [category.name.toLowerCase(), category.id]));

  for (const txn of response.added) {
    const bankAccountId = accountMap.get(txn.account_id);
    if (!bankAccountId) {
      continue;
    }

    const inferredCategoryName = inferCategoryNameFromPlaid({
      plaidDetailed: txn.personal_finance_category?.detailed ?? null,
      merchantName: txn.merchant_name ?? null,
      description: txn.name,
    });
    const inferredCategoryId = inferredCategoryName ? categoryByLowerName.get(inferredCategoryName.toLowerCase()) : null;
    const existing = await db.transaction.findUnique({
      where: {
        plaidTransactionId: txn.transaction_id,
      },
      select: {
        id: true,
        categoryId: true,
        userOverrideCategory: true,
      },
    });

    if (!existing) {
      await db.transaction.create({
        data: {
          ownerUserId: userId,
          bankAccountId,
          plaidTransactionId: txn.transaction_id,
          postedDate: new Date(txn.date),
          merchantName: txn.merchant_name,
          description: txn.name,
          amount: normalizeAmount(txn.amount),
          direction: parseDirection(txn.amount),
          pending: txn.pending,
          categoryId: inferredCategoryId ?? null,
          userOverrideCategory: false,
          rawCategory: txn.personal_finance_category?.detailed ? txn.personal_finance_category.detailed.split("_") : [],
        },
      });
      continue;
    }

    await db.transaction.update({
      where: {
        id: existing.id,
      },
      data: {
        ownerUserId: userId,
        bankAccountId,
        postedDate: new Date(txn.date),
        merchantName: txn.merchant_name,
        description: txn.name,
        amount: normalizeAmount(txn.amount),
        direction: parseDirection(txn.amount),
        pending: txn.pending,
        categoryId: existing.userOverrideCategory ? existing.categoryId : inferredCategoryId ?? existing.categoryId,
        rawCategory: txn.personal_finance_category?.detailed ? txn.personal_finance_category.detailed.split("_") : [],
      },
    });
  }

  if (response.modified.length) {
    for (const txn of response.modified) {
      const existing = await db.transaction.findUnique({
        where: {
          plaidTransactionId: txn.transaction_id,
        },
        select: {
          id: true,
          categoryId: true,
          userOverrideCategory: true,
        },
      });

      if (!existing) {
        continue;
      }

      const inferredCategoryName = inferCategoryNameFromPlaid({
        plaidDetailed: txn.personal_finance_category?.detailed ?? null,
        merchantName: txn.merchant_name ?? null,
        description: txn.name,
      });
      const inferredCategoryId = inferredCategoryName ? categoryByLowerName.get(inferredCategoryName.toLowerCase()) : null;

      await db.transaction.update({
        where: {
          id: existing.id,
        },
        data: {
          postedDate: new Date(txn.date),
          merchantName: txn.merchant_name,
          description: txn.name,
          amount: normalizeAmount(txn.amount),
          direction: parseDirection(txn.amount),
          pending: txn.pending,
          categoryId: existing.userOverrideCategory ? existing.categoryId : inferredCategoryId ?? existing.categoryId,
          rawCategory: txn.personal_finance_category?.detailed ? txn.personal_finance_category.detailed.split("_") : [],
        },
      });
    }
  }

  if (response.removed.length) {
    await db.transaction.deleteMany({
      where: {
        ownerUserId: userId,
        plaidTransactionId: {
          in: response.removed.map((txn) => txn.transaction_id),
        },
      },
    });
  }
}

export async function createPlaidLinkToken(userId: string) {
  const plaid = createPlaidClient();
  const response = await plaid.linkTokenCreate({
    user: {
      client_user_id: userId,
    },
    client_name: APP_NAME,
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    webhook: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/api/plaid/webhook` : undefined,
  });

  return response.data.link_token;
}

export async function exchangePublicToken(userId: string, publicToken: string) {
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const db = prisma;

  const plaid = createPlaidClient();
  const exchange = await plaid.itemPublicTokenExchange({ public_token: publicToken });
  const accessToken = exchange.data.access_token;
  const itemId = exchange.data.item_id;

  const item = await db.plaidItem.upsert({
    where: {
      plaidItemId: itemId,
    },
    create: {
      ownerUserId: userId,
      plaidItemId: itemId,
      accessTokenEncrypted: encrypt(accessToken),
      syncStatus: "healthy",
    },
    update: {
      ownerUserId: userId,
      accessTokenEncrypted: encrypt(accessToken),
      syncStatus: "healthy",
    },
  });

  const accountsResponse = await plaid.accountsGet({ access_token: accessToken });
  await upsertAccounts(userId, item.id, accountsResponse.data.accounts);

  await syncPlaidItemTransactions({
    userId,
    plaidItemRefId: item.id,
  });

  return item;
}

export async function syncPlaidItemTransactions({
  userId,
  plaidItemRefId,
}: {
  userId: string;
  plaidItemRefId: string;
}) {
  if (!prisma) {
    throw new Error("Database is not configured.");
  }
  const db = prisma;

  const plaidItem = await db.plaidItem.findFirst({
    where: {
      id: plaidItemRefId,
      ownerUserId: userId,
    },
  });

  if (!plaidItem) {
    throw new Error("Plaid item not found.");
  }

  const plaid = createPlaidClient();
  const accessToken = decrypt(plaidItem.accessTokenEncrypted);

  let cursor = plaidItem.lastCursor ?? undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await plaid.transactionsSync({
      access_token: accessToken,
      cursor,
      options: {
        include_personal_finance_category: true,
      },
    });

    await persistTransactions(userId, plaidItemRefId, response.data);

    cursor = response.data.next_cursor;
    hasMore = response.data.has_more;
  }

  await db.plaidItem.update({
    where: {
      id: plaidItemRefId,
    },
    data: {
      lastCursor: cursor,
      lastSyncAt: new Date(),
      syncStatus: "healthy",
    },
  });
}

export async function syncAllPlaidItemsForUser(userId: string) {
  if (!prisma) {
    return {
      synced: 0,
      errors: ["Database is not configured."],
    };
  }
  const db = prisma;

  const items = await db.plaidItem.findMany({
    where: {
      ownerUserId: userId,
    },
    select: {
      id: true,
    },
  });

  let synced = 0;
  const errors: string[] = [];

  for (const item of items) {
    try {
      await syncPlaidItemTransactions({ userId, plaidItemRefId: item.id });
      synced += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Sync failed");
    }
  }

  return {
    synced,
    errors,
  };
}

export async function createDefaultCategories(userId: string) {
  if (!prisma) {
    return;
  }
  const db = prisma;

  const defaults = [
    { name: "Groceries", color: "#16a34a", icon: "shopping-cart" },
    { name: "Transport", color: "#2563eb", icon: "car" },
    { name: "Dining", color: "#f59e0b", icon: "utensils" },
    { name: "Utilities", color: "#7c3aed", icon: "bolt" },
    { name: "Housing", color: "#0f766e", icon: "home" },
  ];

  for (const category of defaults) {
    await db.category.upsert({
      where: {
        ownerUserId_name: {
          ownerUserId: userId,
          name: category.name,
        },
      },
      create: {
        ownerUserId: userId,
        isSystem: true,
        ...category,
      },
      update: {
        color: category.color,
        icon: category.icon,
      },
    });
  }

  const monthStart = startOfMonth(new Date());
  const rows = await db.category.findMany({ where: { ownerUserId: userId } });

  for (const category of rows) {
    await db.monthlyBudget.upsert({
      where: {
        ownerUserId_monthStart_categoryId: {
          ownerUserId: userId,
          monthStart,
          categoryId: category.id,
        },
      },
      create: {
        ownerUserId: userId,
        monthStart,
        categoryId: category.id,
        amountLimit: 0,
      },
      update: {},
    });
  }
}
