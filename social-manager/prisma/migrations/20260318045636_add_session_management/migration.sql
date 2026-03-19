-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('logged_out', 'logged_in', 'expired');

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "cookieExpiry" TIMESTAMP(3),
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "sessionDuration" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "sessionStatus" "SessionStatus" NOT NULL DEFAULT 'logged_out',
ALTER COLUMN "cookie" DROP NOT NULL;

-- CreateTable
CREATE TABLE "action_logs" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "targetUrl" TEXT,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "action_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "action_logs_accountId_idx" ON "action_logs"("accountId");

-- CreateIndex
CREATE INDEX "action_logs_accountId_executedAt_idx" ON "action_logs"("accountId", "executedAt");

-- CreateIndex
CREATE INDEX "action_logs_actionType_idx" ON "action_logs"("actionType");

-- AddForeignKey
ALTER TABLE "action_logs" ADD CONSTRAINT "action_logs_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
