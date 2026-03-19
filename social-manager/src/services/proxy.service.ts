import prisma from '../lib/prisma';

export interface CreateProxyInput {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export async function createProxy(input: CreateProxyInput) {
  return prisma.proxy.create({
    data: {
      host: input.host,
      port: input.port,
      username: input.username ?? null,
      password: input.password ?? null,
    },
  });
}

export async function getProxies() {
  return prisma.proxy.findMany({
    include: {
      accounts: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
