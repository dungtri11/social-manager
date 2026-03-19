import { Router, Request, Response } from 'express';
import { queueService, ActionJob } from '../services/queue.service';

const router = Router();

// POST /jobs - Enqueue a new action job
router.post('/', async (req: Request, res: Response) => {
  try {
    const { accountId, actionType, targetUrl, payload } = req.body;

    // Validate required fields
    if (!accountId || !actionType || !targetUrl) {
      return res.status(400).json({
        error: 'Missing required fields: accountId, actionType, targetUrl',
      });
    }

    // Validate actionType
    const validActionTypes = ['like', 'comment', 'share', 'follow'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
      });
    }

    const jobData: ActionJob = {
      accountId,
      actionType,
      targetUrl,
      payload: payload || {},
    };

    const job = await queueService.addActionJob(jobData);

    res.status(201).json({
      success: true,
      jobId: job.id,
      data: jobData,
    });
  } catch (error) {
    console.error('[jobs] Error adding job:', error);
    res.status(500).json({
      error: 'Failed to enqueue job',
    });
  }
});

// GET /jobs/stats - Get queue statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const counts = await queueService.getJobCounts();
    res.json({
      success: true,
      stats: counts,
    });
  } catch (error) {
    console.error('[jobs] Error getting stats:', error);
    res.status(500).json({
      error: 'Failed to get queue stats',
    });
  }
});

// GET /jobs/detail/:jobId - Get detailed job information including logs
router.get('/detail/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await queueService.getJobDetails(jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
      });
    }

    // Safely get logs
    let logs: { logs: string[]; count: number } = { logs: [], count: 0 };
    try {
      const state = await job.getState();
      if (state !== 'unknown' && job.id) {
        logs = await queueService.getJobLogs(job.id);
      }
    } catch (logError) {
      console.error('[jobs] Error fetching logs for job:', jobId, logError);
    }

    res.json({
      success: true,
      job: {
        id: job.id,
        name: job.name,
        data: job.data,
        timestamp: job.timestamp,
        attemptsMade: job.attemptsMade,
        processedOn: job.processedOn,
        finishedOn: job.finishedOn,
        failedReason: job.failedReason,
        progress: job.progress,
        returnvalue: job.returnvalue,
        logs,
      },
    });
  } catch (error) {
    console.error('[jobs] Error getting job details:', error);
    res.status(500).json({
      error: 'Failed to get job details',
    });
  }
});

// GET /jobs/:status - Get jobs by status
router.get('/:status', async (req: Request, res: Response) => {
  try {
    const { status } = req.params;
    const validStatuses = ['waiting', 'active', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const jobs = await queueService.getJobs(status as any);

    // Add logs to each job
    const jobsWithLogs = await Promise.all(
      jobs.map(async (job) => {
        let logs: { logs: string[]; count: number } = { logs: [], count: 0 };
        try {
          const state = await job.getState();
          if (state !== 'unknown' && job.id) {
            logs = await queueService.getJobLogs(job.id);
          }
        } catch (logError) {
          console.error('[jobs] Error fetching logs for job:', job.id, logError);
        }

        return {
          id: job.id,
          name: job.name,
          data: job.data,
          timestamp: job.timestamp,
          attemptsMade: job.attemptsMade,
          processedOn: job.processedOn,
          finishedOn: job.finishedOn,
          failedReason: job.failedReason,
          progress: job.progress,
          logs,
        };
      })
    );

    res.json({
      success: true,
      count: jobsWithLogs.length,
      jobs: jobsWithLogs,
    });
  } catch (error) {
    console.error('[jobs] Error getting jobs:', error);
    res.status(500).json({
      error: 'Failed to get jobs',
    });
  }
});

export default router;
