import { Router, Request, Response } from 'express';
import { launchBrowser, closeBrowser, likePost, commentPost } from '../services/automation.service';

const router = Router();

// POST /automation/launch
// Launch browser for an account
router.post('/launch', async (req: Request, res: Response) => {
  const { accountId } = req.body;

  if (!accountId || typeof accountId !== 'string') {
    res.status(400).json({ error: 'accountId is required' });
    return;
  }

  try {
    const session = await launchBrowser({ accountId });

    // Browser is now open and ready
    // In a real scenario, you would store the session or return a session ID
    // For now, we'll just confirm it launched

    res.json({
      message: 'Browser launched successfully',
      accountId,
      note: 'Browser window is open. Close it manually or call the close endpoint.',
    });

    // Keep browser open for manual testing
    // In production, you'd manage sessions properly
  } catch (err: any) {
    console.error('[automation] Launch error:', err);

    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: 'Failed to launch browser' });
  }
});

// POST /automation/like
// Like a Facebook post
router.post('/like', async (req: Request, res: Response) => {
  const { accountId, postUrl } = req.body;

  if (!accountId || typeof accountId !== 'string') {
    res.status(400).json({ error: 'accountId is required' });
    return;
  }

  if (!postUrl || typeof postUrl !== 'string') {
    res.status(400).json({ error: 'postUrl is required' });
    return;
  }

  // Validate URL format
  if (!postUrl.includes('facebook.com')) {
    res.status(400).json({ error: 'postUrl must be a valid Facebook URL' });
    return;
  }

  try {
    const result = await likePost({ accountId, postUrl });
    res.json(result);
  } catch (err: any) {
    console.error('[automation] Like error:', err);

    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: err.message || 'Failed to like post' });
  }
});

// POST /automation/comment
// Comment on a Facebook post with randomized content
router.post('/comment', async (req: Request, res: Response) => {
  const { accountId, postUrl, commentTemplate } = req.body;

  if (!accountId || typeof accountId !== 'string') {
    res.status(400).json({ error: 'accountId is required' });
    return;
  }

  if (!postUrl || typeof postUrl !== 'string') {
    res.status(400).json({ error: 'postUrl is required' });
    return;
  }

  // Validate URL format
  if (!postUrl.includes('facebook.com')) {
    res.status(400).json({ error: 'postUrl must be a valid Facebook URL' });
    return;
  }

  try {
    const result = await commentPost({ accountId, postUrl, commentTemplate });
    res.json(result);
  } catch (err: any) {
    console.error('[automation] Comment error:', err);

    if (err.message.includes('not found')) {
      res.status(404).json({ error: err.message });
      return;
    }

    res.status(500).json({ error: err.message || 'Failed to comment on post' });
  }
});

export default router;
