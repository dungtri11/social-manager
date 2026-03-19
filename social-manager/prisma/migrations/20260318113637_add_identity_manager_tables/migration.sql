-- CreateEnum
CREATE TYPE "CookieStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CHECKPOINT');

-- CreateEnum
CREATE TYPE "RiskEventType" AS ENUM ('IP_CHANGE', 'UA_CHANGE', 'CHECKPOINT', 'LOGIN_FAIL');

-- CreateEnum
CREATE TYPE "RiskSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "identity_profiles" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "proxyId" TEXT,
    "timezone" TEXT NOT NULL,
    "fingerprintHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identity_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cookie_sessions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "cookies" JSONB NOT NULL,
    "status" "CookieStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastValidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cookie_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_usage_logs" (
    "id" TEXT NOT NULL,
    "proxyId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT,

    CONSTRAINT "proxy_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_events" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "RiskEventType" NOT NULL,
    "severity" "RiskSeverity" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "identity_profiles_accountId_key" ON "identity_profiles"("accountId");

-- CreateIndex
CREATE INDEX "identity_profiles_accountId_idx" ON "identity_profiles"("accountId");

-- CreateIndex
CREATE INDEX "identity_profiles_fingerprintHash_idx" ON "identity_profiles"("fingerprintHash");

-- CreateIndex
CREATE INDEX "cookie_sessions_accountId_idx" ON "cookie_sessions"("accountId");

-- CreateIndex
CREATE INDEX "cookie_sessions_status_idx" ON "cookie_sessions"("status");

-- CreateIndex
CREATE INDEX "proxy_usage_logs_proxyId_idx" ON "proxy_usage_logs"("proxyId");

-- CreateIndex
CREATE INDEX "proxy_usage_logs_accountId_idx" ON "proxy_usage_logs"("accountId");

-- CreateIndex
CREATE INDEX "proxy_usage_logs_usedAt_idx" ON "proxy_usage_logs"("usedAt");

-- CreateIndex
CREATE INDEX "risk_events_accountId_idx" ON "risk_events"("accountId");

-- CreateIndex
CREATE INDEX "risk_events_severity_idx" ON "risk_events"("severity");

-- CreateIndex
CREATE INDEX "risk_events_createdAt_idx" ON "risk_events"("createdAt");

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_profiles" ADD CONSTRAINT "identity_profiles_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cookie_sessions" ADD CONSTRAINT "cookie_sessions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_usage_logs" ADD CONSTRAINT "proxy_usage_logs_proxyId_fkey" FOREIGN KEY ("proxyId") REFERENCES "proxies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proxy_usage_logs" ADD CONSTRAINT "proxy_usage_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_events" ADD CONSTRAINT "risk_events_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
