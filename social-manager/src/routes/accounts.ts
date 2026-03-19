import { Router, Request, Response } from 'express';
import { createAccount, getAccounts, deleteAccount, deleteExpiredAccounts } from '../services/account.service';
import sessionService from '../services/session.service';
import browserService from '../services/browser.service';

const router = Router();

// POST /accounts
router.post('/', async (req: Request, res: Response) => {
  const { username, cookie, userAgent, proxyId } = req.body;

  if (!username || typeof username !== 'string') {
    res.status(400).json({ error: 'username is required' });
    return;
  }
  // Cookie is now optional - users can login later via POST /:id/login
  if (cookie && typeof cookie !== 'string') {
    res.status(400).json({ error: 'cookie must be a string if provided' });
    return;
  }
  if (!userAgent || typeof userAgent !== 'string') {
    res.status(400).json({ error: 'userAgent is required' });
    return;
  }

  try {
    const account = await createAccount({ username, cookie: cookie || null, userAgent, proxyId });
    res.status(201).json(account);
  } catch (err: any) {
    if (err?.code === 'P2002') {
      res.status(409).json({ error: 'Account with this username already exists' });
      return;
    }
    console.error('[accounts] POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /accounts
router.get('/', async (_req: Request, res: Response) => {
  try {
    const accounts = await getAccounts();
    res.json(accounts);
  } catch (err) {
    console.error('[accounts] GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /accounts/:id/login
 * Launch headed browser for manual login and capture cookies
 */
router.post('/:id/login', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    console.log(`[accounts] Starting headed browser login for account ${id}`);

    // Launch headed browser and wait for login
    const { browser, cookieString } = await browserService.launchHeadedBrowser(id);

    // Close browser after login attempt
    await browser.close();

    if (!cookieString) {
      res.status(400).json({
        error: 'Login timeout',
        message: 'Please complete login within the timeout period'
      });
      return;
    }

    // Update session with captured cookies
    const sessionInfo = await sessionService.updateSessionFromLogin(id, cookieString);

    console.log(`[accounts] Login successful for account ${id}`);

    res.json({
      success: true,
      message: 'Login successful',
      sessionInfo
    });

  } catch (error: any) {
    console.error('[accounts] Login error:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
});

/**
 * POST /accounts/:id/logout
 * Clear session for account
 */
router.post('/:id/logout', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    await sessionService.clearSession(id);

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error: any) {
    console.error('[accounts] Logout error:', error);
    res.status(500).json({ error: error.message || 'Logout failed' });
  }
});

/**
 * GET /accounts/:id/session-status
 * Get current session status and info
 */
router.get('/:id/session-status', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const sessionInfo = await sessionService.getSessionInfo(id);

    res.json({
      accountId: id,
      sessionInfo
    });

  } catch (error: any) {
    console.error('[accounts] Session status error:', error);
    res.status(500).json({ error: error.message || 'Failed to get session status' });
  }
});

/**
 * DELETE /accounts/:id
 * Delete a specific account and its cookie sessions
 */
router.delete('/:id', async (req: Request, res: Response) => {
  const { id } = req.params;

  try {
    const deletedAccount = await deleteAccount(id);

    res.json({
      success: true,
      message: 'Account deleted successfully',
      account: deletedAccount
    });

  } catch (error: any) {
    if (error?.code === 'P2025') {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    console.error('[accounts] Delete error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete account' });
  }
});

/**
 * DELETE /accounts/expired
 * Delete all accounts with expired cookie sessions
 */
router.delete('/bulk/expired', async (req: Request, res: Response) => {
  try {
    const result = await deleteExpiredAccounts();

    res.json({
      success: true,
      message: `Successfully deleted ${result.deletedCount} expired accounts`,
      deletedCount: result.deletedCount,
      deletedAccounts: result.deletedAccounts
    });

  } catch (error: any) {
    console.error('[accounts] Delete expired accounts error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete expired accounts' });
  }
});

export default router;
