import prisma from '../lib/prisma';

export interface CreateAccountInput {
  username: string;
  cookie?: string | null;
  userAgent: string;
  proxyId?: string;
}

export async function createAccount(input: CreateAccountInput) {
  // Create account without cookie field (cookies are stored in CookieSession model)
  const account = await prisma.account.create({
    data: {
      username: input.username,
      userAgent: input.userAgent,
      proxyId: input.proxyId ?? null,
    },
    include: { proxy: true },
  });

  // If cookie was provided, create a cookie session
  if (input.cookie) {
    await prisma.cookieSession.create({
      data: {
        accountId: account.id,
        cookies: { sessionCookie: input.cookie }, // Store as JSON
        status: 'ACTIVE',
      },
    });
  }

  return account;
}

export async function getAccounts() {
  return prisma.account.findMany({
    include: { proxy: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function deleteAccount(accountId: string) {
  // Delete related cookie sessions first (cascade delete)
  await prisma.cookieSession.deleteMany({
    where: { accountId },
  });

  // Delete the account
  const deletedAccount = await prisma.account.delete({
    where: { id: accountId },
    include: { proxy: true },
  });

  return deletedAccount;
}

export async function deleteExpiredAccounts() {
  // Find accounts with expired cookie sessions (status is EXPIRED)
  const expiredSessions = await prisma.cookieSession.findMany({
    where: {
      status: 'EXPIRED'
    },
    include: { account: true }
  });

  const accountIdsToDelete = expiredSessions.map(session => session.accountId);

  if (accountIdsToDelete.length === 0) {
    return {
      deletedCount: 0,
      deletedAccounts: []
    };
  }

  // Delete cookie sessions first
  await prisma.cookieSession.deleteMany({
    where: { accountId: { in: accountIdsToDelete } },
  });

  // Delete accounts
  const deletedAccounts = await prisma.account.findMany({
    where: { id: { in: accountIdsToDelete } },
    include: { proxy: true },
  });

  await prisma.account.deleteMany({
    where: { id: { in: accountIdsToDelete } },
  });

  return {
    deletedCount: deletedAccounts.length,
    deletedAccounts
  };
}
