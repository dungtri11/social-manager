-- CreateTable
CREATE TABLE "proxies" (
    "id" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "cookie" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "proxyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_username_key" ON "accounts"("username");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
