import { Router, Request, Response } from 'express';
import identityService from '../services/identity.service';
import ruleEngineService from '../services/rule-engine.service';
import executionGuard from '../guards/execution.guard';
import identityLogger from '../utils/identity-logger';

const router = Router();

/**
 * POST /identity/:accountId/create
 * Create identity profile for an account
 */
router.post('/:accountId/create', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const identity = await identityService.createIdentity(accountId);

    res.json({
      success: true,
      data: identity,
      message: 'Identity profile created successfully',
    });
  } catch (error: any) {
    console.error('[identity-routes] Error creating identity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/:accountId
 * Get identity bundle for an account
 */
router.get('/:accountId', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const identity = await identityService.getIdentity(accountId);

    if (!identity) {
      return res.status(404).json({
        success: false,
        error: 'Identity profile not found',
      });
    }

    res.json({
      success: true,
      data: identity,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error getting identity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /identity/:accountId/validate
 * Validate identity consistency for an account
 */
router.post('/:accountId/validate', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const validationResult = await identityService.validateIdentity(accountId);

    res.json({
      success: true,
      data: validationResult,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error validating identity:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/:accountId/rules
 * Check all rule engine rules for an account
 */
router.get('/:accountId/rules', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const ruleResults = await ruleEngineService.checkAllRules(accountId);

    res.json({
      success: true,
      data: ruleResults,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error checking rules:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/:accountId/risk
 * Get risk score and assessment for an account
 */
router.get('/:accountId/risk', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const riskScore = await ruleEngineService.calculateRiskScore(accountId);
    const isSafe = await ruleEngineService.isAccountSafe(accountId);
    const recentEvents = await ruleEngineService.getRecentRiskEvents(accountId, 10);

    res.json({
      success: true,
      data: {
        riskScore,
        isSafe,
        recentEvents,
      },
    });
  } catch (error: any) {
    console.error('[identity-routes] Error getting risk score:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/:accountId/events
 * Get risk events for an account
 */
router.get('/:accountId/events', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const limit = parseInt(req.query.limit as string) || 20;

    const events = await ruleEngineService.getRecentRiskEvents(accountId, limit);

    res.json({
      success: true,
      data: events,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error getting risk events:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /identity/:accountId/cookies
 * Store cookie session for an account
 */
router.post('/:accountId/cookies', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;
    const { cookies } = req.body;

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: 'Cookies are required',
      });
    }

    const session = await identityService.storeCookieSession(accountId, cookies);

    res.json({
      success: true,
      data: session,
      message: 'Cookie session stored successfully',
    });
  } catch (error: any) {
    console.error('[identity-routes] Error storing cookies:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /identity/:accountId/cookies/expire
 * Mark cookie session as expired
 */
router.post('/:accountId/cookies/expire', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    await identityService.expireCookieSession(accountId);

    res.json({
      success: true,
      message: 'Cookie session marked as expired',
    });
  } catch (error: any) {
    console.error('[identity-routes] Error expiring cookies:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /identity/:accountId/cookies/checkpoint
 * Mark cookie session as checkpoint
 */
router.post('/:accountId/cookies/checkpoint', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    await identityService.markCookieAsCheckpoint(accountId);

    res.json({
      success: true,
      message: 'Cookie session marked as checkpoint',
    });
  } catch (error: any) {
    console.error('[identity-routes] Error marking checkpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /identity/:accountId/check-execution
 * Check if execution is allowed for an account (uses Execution Guard)
 */
router.post('/:accountId/check-execution', async (req: Request, res: Response) => {
  try {
    const { accountId } = req.params;

    const guardResult = await executionGuard.checkExecution(accountId);

    res.json({
      success: true,
      data: guardResult,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error checking execution:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/logs
 * Get identity-related logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { accountId, type, level, limit } = req.query;
    const limitNum = limit ? parseInt(limit as string) : undefined;

    let logs;
    if (accountId) {
      logs = identityLogger.getLogsForAccount(accountId as string, limitNum);
    } else if (type) {
      logs = identityLogger.getLogsByType(type as any, limitNum);
    } else if (level) {
      logs = identityLogger.getLogsByLevel(level as any, limitNum);
    } else {
      logs = identityLogger.getAllLogs(limitNum);
    }

    res.json({
      success: true,
      data: logs,
    });
  } catch (error: any) {
    console.error('[identity-routes] Error getting logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /identity/logs/export
 * Export logs as JSON file
 */
router.get('/logs/export', async (req: Request, res: Response) => {
  try {
    const exportData = identityLogger.exportLogsToJSON();

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="identity-logs-${Date.now()}.json"`);
    res.send(exportData);
  } catch (error: any) {
    console.error('[identity-routes] Error exporting logs:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
