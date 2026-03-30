import { Worker, Job } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis';
import { ActionJob } from './queue.service';
import { likePost, commentPost } from './automation.service';
import riskControl from './risk.service';
import executionGuard from '../guards/execution.guard';
import identityService from './identity.service';
import { behaviorContext } from '../lib/behavior-context';
import { behaviorEventsService } from './behavior-events.service';

class WorkerService {
  private worker: Worker<ActionJob>;
  private concurrency: number;

  constructor(concurrency: number = 2) {
    this.concurrency = concurrency;

    this.worker = new Worker<ActionJob>(
      'action_queue',
      async (job: Job<ActionJob>) => {
        return await this.processJob(job);
      },
      {
        connection: redisConnectionOptions,
        concurrency: this.concurrency,
        limiter: {
          max: 10, // Max 10 jobs
          duration: 60000, // Per 60 seconds
        },
      }
    );

    this.setupEventHandlers();
    console.log(`[worker] Worker initialized with concurrency: ${this.concurrency}`);
  }

  private setupEventHandlers() {
    this.worker.on('completed', (job: Job<ActionJob>, result: any) => {
      console.log(`[worker] ✅ Job ${job.id} completed successfully`);
      console.log(`[worker] Result:`, JSON.stringify(result, null, 2));
    });

    this.worker.on('failed', (job: Job<ActionJob> | undefined, err: Error) => {
      if (job) {
        console.error(`[worker] ❌ Job ${job.id} failed:`, err.message);
        console.error(`[worker] Job data:`, JSON.stringify(job.data, null, 2));
        console.error(`[worker] Attempts made: ${job.attemptsMade}`);
      } else {
        console.error(`[worker] ❌ Job failed:`, err.message);
      }
    });

    this.worker.on('active', (job: Job<ActionJob>) => {
      console.log(`[worker] 🔄 Processing job ${job.id}: ${job.data.actionType} for account ${job.data.accountId}`);
    });

    this.worker.on('error', (err: Error) => {
      console.error('[worker] Worker error:', err);
    });

    this.worker.on('stalled', (jobId: string) => {
      console.warn(`[worker] ⚠️ Job ${jobId} stalled`);
    });
  }

  /**
   * Process individual job based on action type
   */
  private async processJob(job: Job<ActionJob>): Promise<any> {
    const { accountId, actionType, targetUrl, payload } = job.data;

    return behaviorContext.run({ accountId }, async () => {
      behaviorEventsService.setStatus(accountId, 'processing');
      try {
        return await this.runJob(job, accountId, actionType, targetUrl, payload);
      } finally {
        behaviorEventsService.setStatus(accountId, 'idle');
      }
    });
  }

  private async runJob(job: Job<ActionJob>, accountId: string, actionType: ActionJob['actionType'], targetUrl: string, payload: Record<string, any> | undefined): Promise<any> {

    await job.updateProgress({ step: 'initializing', progress: 0 });
    await job.log(`Starting ${actionType} action for account ${accountId}`);
    await job.log(`Target: ${targetUrl}`);

    console.log(`[worker] Starting ${actionType} action`);
    console.log(`[worker] Account: ${accountId}`);
    console.log(`[worker] Target: ${targetUrl}`);

    // STEP 1: Validate identity consistency (CRITICAL SECURITY CHECK)
    await job.updateProgress({ step: 'identity_validation', progress: 5 });
    await job.log('🔐 Validating identity consistency...');

    console.log(`[worker] 🔐 Performing identity validation for account ${accountId}`);

    const guardResult = await executionGuard.checkExecution(accountId);

    if (!guardResult.allowed) {
      const blockMessage = `Identity validation failed: ${(guardResult.reasons || []).join('; ')}`;
      await job.log(`⛔ ${blockMessage}`);

      console.log(`[worker] ⛔ Identity validation blocked execution`);
      console.log(`[worker] Reasons:`);
      (guardResult.reasons || []).forEach((r) => console.log(`  - ${r}`));

      // Critical: Block execution if identity validation fails
      throw new Error(blockMessage);
    }

    await job.log(`✅ Identity validation passed`);
    console.log(`[worker] ✅ Identity validation passed`);

    // Log proxy usage for tracking
    if (guardResult.identity?.proxyId) {
      await identityService.logProxyUsage(
        accountId,
        guardResult.identity.proxyId,
        guardResult.identity.proxy?.host
      );
      await job.log(`📡 Proxy logged: ${guardResult.identity.proxy?.host}:${guardResult.identity.proxy?.port}`);
    }

    // STEP 2: Perform risk control safety check
    await job.updateProgress({ step: 'safety_check', progress: 15 });
    await job.log('Performing risk control safety check...');

    const safetyCheck = await riskControl.performSafetyCheck(accountId, actionType);

    if (!safetyCheck.safe) {
      const blockMessage = `Action blocked by risk control: ${safetyCheck.recommendations.join('; ')}`;
      await job.log(`⛔ ${blockMessage}`);
      await job.log(`Risk level: ${safetyCheck.riskScore.level} (score: ${safetyCheck.riskScore.score})`);

      console.log(`[worker] ⛔ Action blocked by risk control`);
      console.log(`[worker] Risk level: ${safetyCheck.riskScore.level} (score: ${safetyCheck.riskScore.score})`);
      console.log(`[worker] Reasons:`);
      safetyCheck.recommendations.forEach((r) => console.log(`  - ${r}`));

      // Throw error to mark job as failed (will be retried later if retries configured)
      throw new Error(blockMessage);
    }

    await job.log(`✅ Safety check passed (risk: ${safetyCheck.riskScore.level})`);
    console.log(`[worker] ✅ Safety check passed (risk: ${safetyCheck.riskScore.level})`);

    // Check if cooldown wait is needed
    if (safetyCheck.cooldownCheck.shouldWait) {
      const waitSeconds = Math.ceil(safetyCheck.cooldownCheck.waitTime / 1000);
      await job.updateProgress({ step: 'cooldown', progress: 30 });
      await job.log(`⏳ Waiting ${waitSeconds}s cooldown before action...`);

      console.log(`[worker] ⏳ Waiting ${waitSeconds}s cooldown before action...`);
      await this.sleep(safetyCheck.cooldownCheck.waitTime);

      await job.log(`Cooldown complete, proceeding with action`);
    }

    try {
      let result;

      await job.updateProgress({ step: 'executing', progress: 50 });
      await job.log(`Executing ${actionType} action...`);

      switch (actionType) {
        case 'like':
          result = await likePost({ accountId, postUrl: targetUrl });
          break;

        case 'comment':
          result = await commentPost({
            accountId,
            postUrl: targetUrl,
            commentTemplate: payload?.commentTemplate,
          });
          break;

        case 'share':
          // TODO: Implement in future steps
          throw new Error('Share action not yet implemented');

        case 'follow':
          // TODO: Implement in future steps
          throw new Error('Follow action not yet implemented');

        default:
          throw new Error(`Unknown action type: ${actionType}`);
      }

      await job.updateProgress({ step: 'completed', progress: 100 });
      await job.log(`✅ ${actionType} action completed successfully`);

      console.log(`[worker] ${actionType} action completed successfully`);
      return result;
    } catch (error: any) {
      await job.log(`❌ Error: ${error.message}`);
      console.error(`[worker] Error processing ${actionType} action:`, error.message);
      throw error; // Re-throw to mark job as failed
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Gracefully close the worker
   */
  async close(): Promise<void> {
    console.log('[worker] Shutting down worker...');
    await this.worker.close();
    console.log('[worker] Worker shut down complete');
  }

  /**
   * Get worker instance
   */
  getWorker(): Worker<ActionJob> {
    return this.worker;
  }
}

export default WorkerService;
