import { queueService, ActionJob } from './queue.service';
import prisma from '../lib/prisma';
import riskControl from './risk.service';
import sessionService from './session.service';

export interface BatchActionOptions {
  accountIds: string[];
  actionType: 'like' | 'comment' | 'share' | 'follow';
  targetUrl: string;
  payload?: Record<string, any>;
  delayBetweenAccounts?: {
    min: number; // Minimum delay in milliseconds
    max: number; // Maximum delay in milliseconds
  };
  skipRiskCheck?: boolean; // Skip pre-queue risk filtering (safety checks still run in worker)
}

export interface BatchActionResult {
  success: boolean;
  totalAccounts: number;
  jobsEnqueued: number;
  skippedAccounts: number;
  skippedReasons: Array<{
    accountId: string;
    accountUsername: string;
    reason: string;
    riskLevel: string;
  }>;
  jobs: Array<{
    accountId: string;
    accountUsername: string;
    jobId: string | number | undefined;
    delay: number;
    scheduledAt: Date;
  }>;
  message: string;
}

class BatchService {
  /**
   * Generate random delay in milliseconds
   */
  private randomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Execute action across multiple accounts with random delays
   * This prevents all accounts from executing simultaneously (which looks suspicious)
   */
  async executeBatchAction(options: BatchActionOptions): Promise<BatchActionResult> {
    const {
      accountIds,
      actionType,
      targetUrl,
      payload = {},
      delayBetweenAccounts = {
        min: 30000, // Default: 30 seconds min
        max: 300000, // Default: 5 minutes max
      },
      skipRiskCheck = false,
    } = options;

    console.log(`[batch] Starting batch action: ${actionType}`);
    console.log(`[batch] Accounts: ${accountIds.length}`);
    console.log(`[batch] Target: ${targetUrl}`);
    console.log(`[batch] Delay range: ${delayBetweenAccounts.min}ms - ${delayBetweenAccounts.max}ms`);
    console.log(`[batch] Risk pre-check: ${skipRiskCheck ? 'disabled' : 'enabled'}`);

    // Validate accounts exist
    const accounts = await prisma.account.findMany({
      where: {
        id: {
          in: accountIds,
        },
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (accounts.length === 0) {
      throw new Error('No valid accounts found');
    }

    if (accounts.length < accountIds.length) {
      console.warn(`[batch] Warning: ${accountIds.length - accounts.length} account(s) not found`);
    }

    // Filter out accounts with expired sessions
    console.log(`[batch] Validating sessions for ${accounts.length} accounts...`);
    const accountsWithValidSessions: typeof accounts = [];
    const skippedReasons: BatchActionResult['skippedReasons'] = [];

    for (const account of accounts) {
      const validation = await sessionService.validateSession(account.id);
      if (!validation.isValid) {
        console.log(`[batch] ⛔ Account ${account.username}: ${validation.reason}`);
        skippedReasons.push({
          accountId: account.id,
          accountUsername: account.username,
          reason: validation.reason || 'Session invalid',
          riskLevel: 'N/A',
        });
      } else {
        accountsWithValidSessions.push(account);
      }
    }

    console.log(`[batch] Session validation complete: ${accountsWithValidSessions.length} valid, ${skippedReasons.length} expired/invalid`);

    if (accountsWithValidSessions.length === 0) {
      return {
        success: false,
        totalAccounts: accountIds.length,
        jobsEnqueued: 0,
        skippedAccounts: skippedReasons.length,
        skippedReasons,
        jobs: [],
        message: 'All accounts have expired or invalid sessions',
      };
    }

    // Pre-filter accounts based on risk score (unless disabled)
    const eligibleAccounts: typeof accounts = [];

    if (!skipRiskCheck) {
      console.log(`[batch] Running risk pre-check for ${accountsWithValidSessions.length} accounts...`);

      for (const account of accountsWithValidSessions) {
        const riskScore = await riskControl.calculateRiskScore(account.id);

        if (!riskScore.canPerformAction) {
          console.log(`[batch] ⛔ Account ${account.username}: Risk too high (${riskScore.level})`);
          skippedReasons.push({
            accountId: account.id,
            accountUsername: account.username,
            reason: riskScore.reasons.join('; '),
            riskLevel: riskScore.level,
          });
        } else {
          eligibleAccounts.push(account);
        }
      }

      console.log(`[batch] Risk pre-check complete: ${eligibleAccounts.length} eligible, ${skippedReasons.length} skipped`);
    } else {
      eligibleAccounts.push(...accountsWithValidSessions);
    }

    if (eligibleAccounts.length === 0) {
      return {
        success: false,
        totalAccounts: accountIds.length,
        jobsEnqueued: 0,
        skippedAccounts: skippedReasons.length,
        skippedReasons,
        jobs: [],
        message: 'All accounts blocked by risk control',
      };
    }

    const jobs: BatchActionResult['jobs'] = [];
    let cumulativeDelay = 0;

    // Enqueue jobs with staggered delays
    for (let i = 0; i < eligibleAccounts.length; i++) {
      const account = eligibleAccounts[i];

      // First account: immediate or small delay
      // Subsequent accounts: add random delay
      if (i === 0) {
        cumulativeDelay = this.randomDelay(0, 5000); // 0-5 seconds for first account
      } else {
        cumulativeDelay += this.randomDelay(
          delayBetweenAccounts.min,
          delayBetweenAccounts.max
        );
      }

      const jobData: ActionJob = {
        accountId: account.id,
        actionType,
        targetUrl,
        payload: {
          ...payload,
          batchId: `batch-${Date.now()}`,
          accountIndex: i + 1,
          totalAccounts: eligibleAccounts.length,
        },
      };

      // Add job with delay
      const job = await queueService.getQueue().add('execute-action', jobData, {
        delay: cumulativeDelay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 3600,
        },
        removeOnFail: {
          age: 86400,
        },
      });

      const scheduledAt = new Date(Date.now() + cumulativeDelay);

      jobs.push({
        accountId: account.id,
        accountUsername: account.username,
        jobId: job.id,
        delay: cumulativeDelay,
        scheduledAt,
      });

      console.log(
        `[batch] Account ${i + 1}/${eligibleAccounts.length}: ${account.username} - ` +
        `Job ${job.id} scheduled at ${scheduledAt.toLocaleTimeString()} (delay: ${Math.round(cumulativeDelay / 1000)}s)`
      );
    }

    const totalDelayMinutes = Math.round(cumulativeDelay / 60000);

    console.log(`[batch] ✅ Batch enqueued successfully`);
    console.log(`[batch] Total jobs: ${jobs.length}`);
    console.log(`[batch] Skipped (risk): ${skippedReasons.length}`);
    console.log(`[batch] Total execution time: ~${totalDelayMinutes} minutes`);

    return {
      success: true,
      totalAccounts: accountIds.length,
      jobsEnqueued: jobs.length,
      skippedAccounts: skippedReasons.length,
      skippedReasons,
      jobs,
      message: `Batch action scheduled for ${jobs.length} accounts over ~${totalDelayMinutes} minutes` +
        (skippedReasons.length > 0 ? ` (${skippedReasons.length} skipped due to risk)` : ''),
    };
  }

  /**
   * Execute action for all accounts in database
   */
  async executeAllAccounts(
    actionType: 'like' | 'comment' | 'share' | 'follow',
    targetUrl: string,
    options?: {
      payload?: Record<string, any>;
      delayBetweenAccounts?: { min: number; max: number };
      limit?: number;
    }
  ): Promise<BatchActionResult> {
    console.log(`[batch] Fetching all accounts from database...`);

    const accounts = await prisma.account.findMany({
      take: options?.limit,
      select: { id: true },
    });

    if (accounts.length === 0) {
      throw new Error('No accounts found in database');
    }

    console.log(`[batch] Found ${accounts.length} accounts`);

    return this.executeBatchAction({
      accountIds: accounts.map((a) => a.id),
      actionType,
      targetUrl,
      payload: options?.payload,
      delayBetweenAccounts: options?.delayBetweenAccounts,
    });
  }
}

export const batchService = new BatchService();
