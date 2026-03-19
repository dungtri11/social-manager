import { Router, Request, Response } from 'express';
import behaviorEngine from '../services/behavior.service';

const router = Router();

// GET /behavior/test - Test behavior engine
router.get('/test', async (req: Request, res: Response) => {
  try {
    const behaviors: any[] = [];

    // Test random delay
    const delay1 = behaviorEngine.randomDelay(1000, 5000);
    const delay2 = behaviorEngine.randomDelay(1000, 5000);
    const delay3 = behaviorEngine.randomDelay(1000, 5000);

    behaviors.push({
      name: 'Random Delay (Normal Distribution)',
      samples: [delay1, delay2, delay3],
      range: '1000-5000ms',
      note: 'Most values cluster near center (3000ms)',
    });

    // Test should perform
    const shouldPerformResults = [];
    for (let i = 0; i < 10; i++) {
      shouldPerformResults.push(behaviorEngine.shouldPerform(0.5));
    }

    behaviors.push({
      name: 'Should Perform (50% probability)',
      results: shouldPerformResults,
      trueCount: shouldPerformResults.filter(r => r).length,
      falseCount: shouldPerformResults.filter(r => !r).length,
    });

    // Test reading time calculation
    const readingTime1 = (50 / 300) * 60 * 1000; // 50 words at 300 WPM
    const readingTime2 = (100 / 250) * 60 * 1000; // 100 words at 250 WPM

    behaviors.push({
      name: 'Reading Time Simulation',
      examples: [
        {
          words: 50,
          wpm: 300,
          estimatedTime: `${Math.round(readingTime1 / 1000)}s`,
        },
        {
          words: 100,
          wpm: 250,
          estimatedTime: `${Math.round(readingTime2 / 1000)}s`,
        },
      ],
      note: 'Actual time includes ±30% variance',
    });

    res.json({
      success: true,
      message: 'Behavior engine test results',
      behaviors,
      info: {
        normalDistribution: 'Delays use normal distribution for more realistic randomness',
        preActionBehavior: 'Includes scroll, mouse movement, and reading simulation',
        postActionBehavior: 'Includes pause and optional scroll after action',
        variance: 'All delays have built-in variance for unpredictability',
      },
    });
  } catch (error: any) {
    console.error('[behavior] Error testing behavior engine:', error);
    res.status(500).json({
      error: 'Failed to test behavior engine',
      message: error.message,
    });
  }
});

// POST /behavior/demo - Demonstrate behavior sequence
router.post('/demo', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const log: string[] = [];

    log.push('Starting behavior demo sequence...');

    // Simulate idle pause
    log.push('1. Idle pause...');
    await behaviorEngine.idlePause({ min: 500, max: 1000 });
    log.push(`   Completed after ${Date.now() - startTime}ms`);

    // Simulate wait with variance
    log.push('2. Wait with variance (base: 1000ms, variance: 30%)...');
    const beforeVariance = Date.now();
    await behaviorEngine.waitWithVariance(1000, 0.3);
    log.push(`   Waited ${Date.now() - beforeVariance}ms (expected 700-1300ms)`);

    // Check should perform
    const shouldScroll = behaviorEngine.shouldPerform(0.7);
    log.push(`3. Should scroll? (70% chance) = ${shouldScroll}`);

    log.push(`Demo completed in ${Date.now() - startTime}ms`);

    res.json({
      success: true,
      totalTime: Date.now() - startTime,
      log,
    });
  } catch (error: any) {
    console.error('[behavior] Error in behavior demo:', error);
    res.status(500).json({
      error: 'Failed to run behavior demo',
      message: error.message,
    });
  }
});

// GET /behavior/info - Get behavior engine capabilities
router.get('/info', (req: Request, res: Response) => {
  res.json({
    success: true,
    capabilities: {
      randomDelay: {
        description: 'Generate delays with normal distribution',
        usage: 'randomDelay(min, max)',
        note: 'More realistic than uniform random',
      },
      randomScroll: {
        description: 'Simulate scrolling behavior',
        parameters: ['scrolls', 'delayBetweenScrolls'],
        note: 'Mimics reading content',
      },
      randomMouseMovement: {
        description: 'Move mouse in realistic patterns',
        parameters: ['movements', 'delayBetweenMoves'],
        note: 'Creates smooth cursor paths',
      },
      simulateReading: {
        description: 'Pause as if reading content',
        parameters: ['wordsCount', 'readingSpeedWPM'],
        note: 'Based on average reading speed (200-400 WPM)',
      },
      idlePause: {
        description: 'Random pause (thinking/distraction)',
        parameters: ['min', 'max'],
        note: 'Adds unpredictability',
      },
      preActionBehavior: {
        description: 'Execute before action (scroll, mouse, read)',
        parameters: ['skipScroll', 'skipMouseMove', 'skipReading'],
        note: 'Comprehensive human-like behavior',
      },
      postActionBehavior: {
        description: 'Execute after action (pause, optional scroll)',
        note: 'Simulates observing result',
      },
      randomInteraction: {
        description: 'Random page interaction',
        note: 'Hover, scroll, or pause',
      },
    },
    integration: {
      automationService: 'Integrated into likePost function',
      usage: 'Automatically applied to all automation actions',
      customization: 'Can skip specific behaviors via options',
    },
  });
});

export default router;
