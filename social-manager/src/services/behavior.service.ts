import { Page } from 'playwright';
import { behaviorContext } from '../lib/behavior-context';
import { behaviorEventsService } from './behavior-events.service';

/**
 * Behavior Engine - Simulates human-like behavior patterns
 * This reduces detection risk by making automation look more natural
 */

interface DelayRange {
  min: number;
  max: number;
}

class BehaviorEngine {
  private log(message: string): void {
    console.log(message);
    const ctx = behaviorContext.getStore();
    if (ctx?.accountId) {
      // Strip the '[behavior] ' prefix for cleaner UI display
      const display = message.replace(/^\[behavior\] /, '');
      behaviorEventsService.emitBehavior(ctx.accountId, display);
    }
  }

  /**
   * Generate random delay with normal distribution (more realistic than uniform)
   * Most delays will be near the middle of the range
   */
  randomDelay(min: number, max: number): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

    // Map to range with mean at center and stddev of 1/6 of range
    const mean = (min + max) / 2;
    const stdDev = (max - min) / 6;
    const value = z0 * stdDev + mean;

    // Clamp to min/max
    return Math.floor(Math.max(min, Math.min(max, value)));
  }

  /**
   * Sleep utility
   */
  async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Simulate random scroll behavior (mimics reading content)
   */
  async randomScroll(page: Page, options?: {
    scrolls?: number;
    delayBetweenScrolls?: DelayRange;
  }): Promise<void> {
    const scrolls = options?.scrolls || this.randomDelay(2, 5);
    const delayRange = options?.delayBetweenScrolls || { min: 800, max: 2000 };

    this.log(`[behavior] Performing ${scrolls} random scrolls...`);

    for (let i = 0; i < scrolls; i++) {
      // Random scroll amount (200-800 pixels)
      const scrollAmount = this.randomDelay(200, 800);

      await page.evaluate((amount) => {
        window.scrollBy(0, amount);
      }, scrollAmount);

      // Wait between scrolls
      const delay = this.randomDelay(delayRange.min, delayRange.max);
      await this.sleep(delay);
    }

    this.log(`[behavior] Scroll complete`);
  }

  /**
   * Simulate mouse movement (creates realistic cursor path)
   */
  async randomMouseMovement(page: Page, options?: {
    movements?: number;
    delayBetweenMoves?: DelayRange;
  }): Promise<void> {
    const movements = options?.movements || this.randomDelay(3, 6);
    const delayRange = options?.delayBetweenMoves || { min: 300, max: 800 };

    this.log(`[behavior] Performing ${movements} random mouse movements...`);

    const viewport = page.viewportSize();
    if (!viewport) return;

    for (let i = 0; i < movements; i++) {
      const x = this.randomDelay(100, viewport.width - 100);
      const y = this.randomDelay(100, viewport.height - 100);

      // Move with smooth steps (more human-like than instant jump)
      await page.mouse.move(x, y, { steps: this.randomDelay(5, 15) });

      const delay = this.randomDelay(delayRange.min, delayRange.max);
      await this.sleep(delay);
    }

    this.log(`[behavior] Mouse movement complete`);
  }

  /**
   * Simulate reading time (pause as if user is reading content)
   */
  async simulateReading(options?: {
    wordsCount?: number;
    readingSpeedWPM?: number;
  }): Promise<void> {
    // Assume 200-400 WPM reading speed
    const wpm = options?.readingSpeedWPM || this.randomDelay(200, 400);
    const words = options?.wordsCount || this.randomDelay(50, 150);

    // Calculate reading time in milliseconds
    const readingTimeMs = (words / wpm) * 60 * 1000;

    // Add variance (±30%)
    const variance = readingTimeMs * 0.3;
    const actualTime = this.randomDelay(
      readingTimeMs - variance,
      readingTimeMs + variance
    );

    this.log(`[behavior] Simulating reading ${words} words (~${Math.round(actualTime / 1000)}s)...`);
    await this.sleep(actualTime);
  }

  /**
   * Idle time (pause as if user is distracted or thinking)
   */
  async idlePause(options?: DelayRange): Promise<void> {
    const range = options || { min: 2000, max: 8000 };
    const delay = this.randomDelay(range.min, range.max);

    this.log(`[behavior] Idle pause (${Math.round(delay / 1000)}s)...`);
    await this.sleep(delay);
  }

  /**
   * Pre-action behavior - Executes before performing an action
   * Combines multiple behaviors to appear human-like
   */
  async preActionBehavior(page: Page, options?: {
    skipScroll?: boolean;
    skipMouseMove?: boolean;
    skipReading?: boolean;
  }): Promise<void> {
    this.log(`[behavior] Starting pre-action behavior sequence...`);

    // Random scroll (unless skipped)
    if (!options?.skipScroll && Math.random() > 0.3) {
      await this.randomScroll(page, {
        scrolls: this.randomDelay(1, 3),
        delayBetweenScrolls: { min: 500, max: 1500 },
      });
    }

    // Mouse movement (unless skipped)
    if (!options?.skipMouseMove && Math.random() > 0.4) {
      await this.randomMouseMovement(page, {
        movements: this.randomDelay(2, 4),
        delayBetweenMoves: { min: 200, max: 600 },
      });
    }

    // Reading simulation (unless skipped)
    if (!options?.skipReading && Math.random() > 0.5) {
      await this.simulateReading({
        wordsCount: this.randomDelay(30, 80),
      });
    }

    // Small pause before action
    await this.idlePause({ min: 1000, max: 3000 });

    this.log(`[behavior] Pre-action behavior complete`);
  }

  /**
   * Post-action behavior - Executes after performing an action
   */
  async postActionBehavior(page: Page): Promise<void> {
    this.log(`[behavior] Starting post-action behavior sequence...`);

    // Small pause after action (user observing result)
    await this.idlePause({ min: 1500, max: 4000 });

    // Occasionally scroll after action (viewing updated content)
    if (Math.random() > 0.6) {
      await this.randomScroll(page, {
        scrolls: this.randomDelay(1, 2),
        delayBetweenScrolls: { min: 800, max: 1500 },
      });
    }

    this.log(`[behavior] Post-action behavior complete`);
  }

  /**
   * Random page interaction (hover, click background, etc.)
   */
  async randomInteraction(page: Page): Promise<void> {
    this.log(`[behavior] Performing random interaction...`);

    const actions = [
      // Hover over random element
      async () => {
        const viewport = page.viewportSize();
        if (!viewport) return;
        const x = this.randomDelay(100, viewport.width - 100);
        const y = this.randomDelay(100, viewport.height - 100);
        await page.mouse.move(x, y, { steps: 10 });
        await this.sleep(this.randomDelay(500, 1500));
      },

      // Scroll up
      async () => {
        await page.evaluate(() => window.scrollBy(0, -300));
        await this.sleep(this.randomDelay(800, 1500));
      },

      // Pause (do nothing)
      async () => {
        await this.sleep(this.randomDelay(2000, 5000));
      },
    ];

    // Pick random action
    const action = actions[Math.floor(Math.random() * actions.length)];
    await action();

    this.log(`[behavior] Random interaction complete`);
  }

  /**
   * Wait with variance - Adds randomness to any fixed delay
   */
  async waitWithVariance(baseDelay: number, variance: number = 0.3): Promise<void> {
    const varianceAmount = baseDelay * variance;
    const delay = this.randomDelay(
      baseDelay - varianceAmount,
      baseDelay + varianceAmount
    );
    await this.sleep(delay);
  }

  /**
   * Check if should perform optional behavior (random chance)
   */
  shouldPerform(probability: number = 0.5): boolean {
    return Math.random() < probability;
  }
}

export const behaviorEngine = new BehaviorEngine();
export default behaviorEngine;
