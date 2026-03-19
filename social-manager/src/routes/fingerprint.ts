import { Router, Request, Response } from 'express';
import fingerprintService from '../services/fingerprint.service';

const router = Router();

/**
 * GET /fingerprint/generate
 * Generate a random browser fingerprint
 */
router.get('/generate', (req: Request, res: Response) => {
  const fingerprint = fingerprintService.generateRealisticFingerprint();

  res.json({
    success: true,
    fingerprint,
  });
});

/**
 * POST /fingerprint/generate/platform
 * Generate a fingerprint for a specific platform
 */
router.post('/generate/platform', (req: Request, res: Response) => {
  const { platform } = req.body;

  if (!platform || !['windows', 'mac', 'linux'].includes(platform)) {
    return res.status(400).json({
      error: 'Platform must be one of: windows, mac, linux',
    });
  }

  const fingerprint = fingerprintService.generateFingerprintForPlatform(
    platform as 'windows' | 'mac' | 'linux'
  );

  res.json({
    success: true,
    platform,
    fingerprint,
  });
});

/**
 * GET /fingerprint/batch
 * Generate multiple fingerprints for testing
 */
router.get('/batch', (req: Request, res: Response) => {
  const { count } = req.query;
  const num = count ? parseInt(count as string) : 5;

  if (num < 1 || num > 50) {
    return res.status(400).json({
      error: 'Count must be between 1 and 50',
    });
  }

  const fingerprints = [];
  for (let i = 0; i < num; i++) {
    fingerprints.push(fingerprintService.generateRealisticFingerprint());
  }

  res.json({
    success: true,
    count: fingerprints.length,
    fingerprints,
  });
});

/**
 * GET /fingerprint/user-agent
 * Generate a random user agent only
 */
router.get('/user-agent', (req: Request, res: Response) => {
  const userAgent = fingerprintService.generateUserAgent();

  res.json({
    success: true,
    userAgent,
  });
});

/**
 * GET /fingerprint/viewport
 * Generate a random viewport
 */
router.get('/viewport', (req: Request, res: Response) => {
  const viewport = fingerprintService.getWeightedViewport();

  res.json({
    success: true,
    viewport,
  });
});

/**
 * GET /fingerprint/timezone
 * Generate a random timezone
 */
router.get('/timezone', (req: Request, res: Response) => {
  const timezone = fingerprintService.generateTimezone();

  res.json({
    success: true,
    timezone,
  });
});

/**
 * POST /fingerprint/check-user-agent
 * Check if a user agent is outdated
 */
router.post('/check-user-agent', (req: Request, res: Response) => {
  const { userAgent } = req.body;

  if (!userAgent) {
    return res.status(400).json({
      error: 'userAgent is required',
    });
  }

  const isOutdated = fingerprintService.isUserAgentOutdated(userAgent);
  const newUserAgent = fingerprintService.updateUserAgent(userAgent);

  res.json({
    success: true,
    currentUserAgent: userAgent,
    isOutdated,
    recommendedUpdate: isOutdated ? newUserAgent : null,
  });
});

export default router;
