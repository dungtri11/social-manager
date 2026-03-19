import { Router, Request, Response } from 'express';
import { batchService, BatchActionOptions } from '../services/batch.service';

const router = Router();

// POST /batch - Execute action across multiple accounts
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      accountIds,
      actionType,
      targetUrl,
      payload,
      delayBetweenAccounts,
      skipRiskCheck,
    } = req.body;

    // Validate required fields
    if (!accountIds || !Array.isArray(accountIds) || accountIds.length === 0) {
      return res.status(400).json({
        error: 'accountIds must be a non-empty array',
      });
    }

    if (!actionType) {
      return res.status(400).json({
        error: 'actionType is required',
      });
    }

    if (!targetUrl) {
      return res.status(400).json({
        error: 'targetUrl is required',
      });
    }

    // Validate actionType
    const validActionTypes = ['like', 'comment', 'share', 'follow'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
      });
    }

    // Validate delay configuration
    if (delayBetweenAccounts) {
      if (
        typeof delayBetweenAccounts.min !== 'number' ||
        typeof delayBetweenAccounts.max !== 'number'
      ) {
        return res.status(400).json({
          error: 'delayBetweenAccounts must have numeric min and max values',
        });
      }

      if (delayBetweenAccounts.min > delayBetweenAccounts.max) {
        return res.status(400).json({
          error: 'delayBetweenAccounts.min must be less than or equal to max',
        });
      }
    }

    const options: BatchActionOptions = {
      accountIds,
      actionType,
      targetUrl,
      payload,
      delayBetweenAccounts,
      skipRiskCheck: Boolean(skipRiskCheck),
    };

    const result = await batchService.executeBatchAction(options);

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[batch] Error executing batch action:', error);
    res.status(500).json({
      error: 'Failed to execute batch action',
      message: error.message,
    });
  }
});

// POST /batch/all - Execute action for all accounts
router.post('/all', async (req: Request, res: Response) => {
  try {
    const { actionType, targetUrl, payload, delayBetweenAccounts, limit } = req.body;

    // Validate required fields
    if (!actionType) {
      return res.status(400).json({
        error: 'actionType is required',
      });
    }

    if (!targetUrl) {
      return res.status(400).json({
        error: 'targetUrl is required',
      });
    }

    // Validate actionType
    const validActionTypes = ['like', 'comment', 'share', 'follow'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({
        error: `Invalid actionType. Must be one of: ${validActionTypes.join(', ')}`,
      });
    }

    const result = await batchService.executeAllAccounts(actionType, targetUrl, {
      payload,
      delayBetweenAccounts,
      limit,
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[batch] Error executing batch action for all accounts:', error);
    res.status(500).json({
      error: 'Failed to execute batch action for all accounts',
      message: error.message,
    });
  }
});

export default router;
