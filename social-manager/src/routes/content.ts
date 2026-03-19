import { Router, Request, Response } from 'express';
import contentService from '../services/content.service';

const router = Router();

/**
 * POST /content/spin
 * Test spin syntax with custom template
 */
router.post('/spin', (req: Request, res: Response) => {
  const { template, count } = req.body;

  if (!template) {
    return res.status(400).json({
      error: 'Template is required',
      example: { template: '{Hello|Hi|Hey} {world|friend}!', count: 5 },
    });
  }

  const result = contentService.testSpin(template, count || 5);

  res.json({
    success: true,
    result,
  });
});

/**
 * GET /content/comment
 * Generate a random unique comment
 */
router.get('/comment', (req: Request, res: Response) => {
  const { count } = req.query;
  const num = count ? parseInt(count as string) : 1;

  if (num === 1) {
    const comment = contentService.generateComment();
    return res.json({
      success: true,
      comment,
    });
  }

  // Generate multiple comments
  const comments = [];
  for (let i = 0; i < Math.min(num, 20); i++) {
    comments.push(contentService.generateComment());
  }

  res.json({
    success: true,
    count: comments.length,
    comments,
  });
});

/**
 * GET /content/caption
 * Generate a random unique caption
 */
router.get('/caption', (req: Request, res: Response) => {
  const { count } = req.query;
  const num = count ? parseInt(count as string) : 1;

  if (num === 1) {
    const caption = contentService.generateCaption();
    return res.json({
      success: true,
      caption,
    });
  }

  // Generate multiple captions
  const captions = [];
  for (let i = 0; i < Math.min(num, 20); i++) {
    captions.push(contentService.generateCaption());
  }

  res.json({
    success: true,
    count: captions.length,
    captions,
  });
});

/**
 * POST /content/variations
 * Get all variations from a template
 */
router.post('/variations', (req: Request, res: Response) => {
  const { template, count } = req.body;

  if (!template) {
    return res.status(400).json({
      error: 'Template is required',
    });
  }

  const variations = contentService.generateVariations(
    template,
    count || 10
  );

  const totalPossible = contentService.countVariations(template);

  res.json({
    success: true,
    template,
    variations,
    generated: variations.length,
    totalPossible,
  });
});

export default router;
