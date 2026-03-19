import { Queue } from 'bullmq';
import { redisConnectionOptions } from '../lib/redis';

export interface ActionJob {
  accountId: string;
  actionType: 'like' | 'comment' | 'share' | 'follow';
  targetUrl: string;
  payload?: Record<string, any>;
}

class QueueService {
  private actionQueue: Queue<ActionJob>;

  constructor() {
    this.actionQueue = new Queue<ActionJob>('action_queue', {
      connection: redisConnectionOptions,
    });

    console.log('[queue] Action queue initialized');
  }

  async addActionJob(data: ActionJob) {
    const job = await this.actionQueue.add('execute-action', data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        age: 3600, // Keep completed jobs for 1 hour
        count: 100,
      },
      removeOnFail: {
        age: 86400, // Keep failed jobs for 24 hours
      },
    });

    console.log(`[queue] Job added: ${job.id} - ${data.actionType} for account ${data.accountId}`);
    return job;
  }

  async getJobCounts() {
    const counts = await this.actionQueue.getJobCounts();
    return counts;
  }

  async getJobs(status: 'waiting' | 'active' | 'completed' | 'failed' = 'waiting') {
    const jobs = await this.actionQueue.getJobs([status]);
    return jobs;
  }

  async getJobDetails(jobId: string) {
    const job = await this.actionQueue.getJob(jobId);
    return job;
  }

  async getJobLogs(jobId: string): Promise<{ logs: string[]; count: number }> {
    const result = await this.actionQueue.getJobLogs(jobId);
    return result;
  }

  getQueue() {
    return this.actionQueue;
  }
}

export const queueService = new QueueService();
