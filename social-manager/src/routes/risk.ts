import { Router, Request, Response } from 'express';
import riskControl from '../services/risk.service';

const router = Router();

/**
 * GET /risk/stats/:accountId
 * Get action statistics for an account
 */
router.get('/stats/:accountId', async (req: Request, res: Response) => {
  const { accountId } = req.params;
  const { period } = req.query;

  if (!period || (period !== 'hour' && period !== 'day')) {
    return res.status(400).json({
      error: 'Period parameter required (hour or day)',
    });
  }

  try {
    const stats = await riskControl.getActionStats(
      accountId,
      period as 'hour' | 'day'
    );

    res.json({
      success: true,
      stats,
    });
  } catch (err: any) {
    console.error('[risk] Error getting stats:', err);
    res.status(500).json({ error: 'Failed to get action stats' });
  }
});

/**
 * GET /risk/score/:accountId
 * Calculate risk score for an account
 */
router.get('/score/:accountId', async (req: Request, res: Response) => {
  const { accountId } = req.params;

  try {
    const riskScore = await riskControl.calculateRiskScore(accountId);

    res.json({
      success: true,
      riskScore,
    });
  } catch (err: any) {
    console.error('[risk] Error calculating risk score:', err);
    res.status(500).json({ error: 'Failed to calculate risk score' });
  }
});

/**
 * POST /risk/check
 * Perform comprehensive safety check before action
 */
router.post('/check', async (req: Request, res: Response) => {
  const { accountId, actionType } = req.body;

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({ error: 'accountId is required' });
  }

  if (!actionType || !['like', 'comment', 'share', 'follow'].includes(actionType)) {
    return res.status(400).json({
      error: 'actionType must be one of: like, comment, share, follow',
    });
  }

  try {
    const safetyCheck = await riskControl.performSafetyCheck(
      accountId,
      actionType as 'like' | 'comment' | 'share' | 'follow'
    );

    res.json({
      success: true,
      safetyCheck,
    });
  } catch (err: any) {
    console.error('[risk] Error performing safety check:', err);
    res.status(500).json({ error: 'Failed to perform safety check' });
  }
});

/**
 * GET /risk/cooldown/:accountId
 * Get recommended cooldown time
 */
router.get('/cooldown/:accountId', async (req: Request, res: Response) => {
  const { accountId } = req.params;

  try {
    const cooldownCheck = await riskControl.shouldWaitBeforeAction(accountId);
    const recommendedCooldown = await riskControl.getRecommendedCooldown(accountId);

    res.json({
      success: true,
      cooldownCheck,
      recommendedCooldown: {
        milliseconds: recommendedCooldown,
        seconds: Math.ceil(recommendedCooldown / 1000),
        minutes: Math.ceil(recommendedCooldown / 1000 / 60),
      },
    });
  } catch (err: any) {
    console.error('[risk] Error checking cooldown:', err);
    res.status(500).json({ error: 'Failed to check cooldown' });
  }
});

/**
 * GET /risk/limits
 * Get default action limits
 */
router.get('/limits', (req: Request, res: Response) => {
  const limits = riskControl.getDefaultLimits();

  res.json({
    success: true,
    limits,
  });
});

/**
 * POST /risk/can-perform
 * Check if specific action is allowed
 */
router.post('/can-perform', async (req: Request, res: Response) => {
  const { accountId, actionType } = req.body;

  if (!accountId || typeof accountId !== 'string') {
    return res.status(400).json({ error: 'accountId is required' });
  }

  if (!actionType || !['like', 'comment', 'share', 'follow'].includes(actionType)) {
    return res.status(400).json({
      error: 'actionType must be one of: like, comment, share, follow',
    });
  }

  try {
    const result = await riskControl.canPerformAction(
      accountId,
      actionType as 'like' | 'comment' | 'share' | 'follow'
    );

    res.json({
      success: true,
      result,
    });
  } catch (err: any) {
    console.error('[risk] Error checking if action allowed:', err);
    res.status(500).json({ error: 'Failed to check action permission' });
  }
});

/**
 * DELETE /risk/cleanup
 * Clean up old action logs
 */
router.delete('/cleanup', async (req: Request, res: Response) => {
  const { daysToKeep } = req.query;
  const days = daysToKeep ? parseInt(daysToKeep as string) : 30;

  if (days < 1 || days > 365) {
    return res.status(400).json({
      error: 'daysToKeep must be between 1 and 365',
    });
  }

  try {
    const deletedCount = await riskControl.cleanupOldLogs(days);

    res.json({
      success: true,
      deletedCount,
      message: `Deleted ${deletedCount} logs older than ${days} days`,
    });
  } catch (err: any) {
    console.error('[risk] Error cleaning up logs:', err);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

export default router;
