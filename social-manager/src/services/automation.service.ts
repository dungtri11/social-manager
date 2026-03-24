import { chromium, Browser, BrowserContext, Page } from 'playwright';
import prisma from '../lib/prisma';
import behaviorEngine from './behavior.service';
import contentService from './content.service';
import fingerprintService, { BrowserFingerprint } from './fingerprint.service';
import riskControl from './risk.service';
import sessionService from './session.service';
import browserService from './browser.service';
import executionGuard from '../guards/execution.guard';

function resolveHeadlessMode(): boolean {
  if (process.env.PLAYWRIGHT_HEADLESS === 'true') return true;
  if (process.env.PLAYWRIGHT_HEADED === 'true') return false;

  // In Linux containers there is usually no X server, so headed mode will crash.
  return process.platform === 'linux' && !process.env.DISPLAY;
}

export interface LaunchBrowserOptions {
  accountId: string;
  fingerprint?: BrowserFingerprint; // Optional custom fingerprint
}

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

/**
 * Parse cookie string into Playwright cookie format
 * Example: "c_user=123;xs=xyz" -> [{name: "c_user", value: "123", ...}, ...]
 */
function parseCookieString(cookieString: string, domain: string = '.facebook.com'): any[] {
  const cookies = cookieString.split(';').map(cookie => {
    const [name, value] = cookie.trim().split('=');
    return {
      name: name.trim(),
      value: value?.trim() || '',
      domain,
      path: '/',
    };
  });
  return cookies;
}

/**
 * Launch browser with account session
 * - Validates session before launch
 * - Loads cookies
 * - Sets user agent (from fingerprint)
 * - Sets viewport (from fingerprint)
 * - Sets timezone and locale (from fingerprint)
 * - Configures proxy if available
 * - Opens Facebook homepage
 * - Validates session in browser
 */
export async function launchBrowser(options: LaunchBrowserOptions): Promise<BrowserSession> {
  const { accountId, fingerprint } = options;

  // STEP 1: VALIDATE IDENTITY CONSISTENCY (CRITICAL SECURITY CHECK)
  console.log(`[automation] 🔐 Validating identity consistency for account ${accountId}...`);

  const guardResult = await executionGuard.checkExecution(accountId);

  if (!guardResult.allowed) {
    const blockMessage = `Identity validation failed: ${(guardResult.reasons || []).join('; ')}`;
    console.error(`[automation] ⛔ ${blockMessage}`);
    throw new Error(blockMessage);
  }

  console.log(`[automation] ✅ Identity validation passed`);

  // STEP 2: VALIDATE SESSION
  const validation = await sessionService.validateSession(accountId);
  if (!validation.isValid) {
    throw new Error(`SESSION_INVALID: ${validation.reason}`);
  }

  // Fetch account with active cookie session
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      proxy: true,
      cookieSessions: {
        where: { status: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  // Get cookie from CookieSession table
  const activeSession = account.cookieSessions?.[0];
  if (!activeSession) {
    throw new Error('SESSION_INVALID: No active session cookie available');
  }

  // Extract cookie string from JSON
  const cookieData = activeSession.cookies as { sessionCookie?: string };
  const cookieString = cookieData?.sessionCookie;
  if (!cookieString) {
    throw new Error('SESSION_INVALID: Cookie data is missing');
  }

  console.log(`[automation] Launching browser for account: ${account.username}`);

  // Generate or use provided fingerprint
  const fp = fingerprint || fingerprintService.generateRealisticFingerprint();

  console.log(`[automation] Using fingerprint:`);
  console.log(`  - User Agent: ${fp.userAgent.substring(0, 60)}...`);
  console.log(`  - Viewport: ${fp.viewport.width}x${fp.viewport.height}`);
  console.log(`  - Timezone: ${fp.timezone}`);
  console.log(`  - Locale: ${fp.locale}`);

  // FIX: Add proxy configuration (was missing!)
  const browserOptions: any = {
    headless: resolveHeadlessMode(),
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
    ],
  };

  console.log(`[automation] Browser mode: ${browserOptions.headless ? 'headless' : 'headed'}`);

  if (account.proxy) {
    browserOptions.proxy = {
      server: `http://${account.proxy.host}:${account.proxy.port}`,
      username: account.proxy.username || undefined,
      password: account.proxy.password || undefined,
    };
    console.log(`[automation] Using proxy: http://${account.proxy.host}:${account.proxy.port}`);
  }

  // Launch browser
  const browser = await chromium.launch(browserOptions);

  // Create context with fingerprint settings
  const context = await browser.newContext({
    userAgent: fp.userAgent,
    viewport: fp.viewport,
    locale: fp.locale,
    timezoneId: fp.timezone,
    // Additional fingerprint settings
    colorScheme: 'light',
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    javaScriptEnabled: true,
    // Permissions
    permissions: [],
  });

  // Parse and add cookies
  const cookies = parseCookieString(cookieString, '.facebook.com');
  await context.addCookies(cookies);

  console.log(`[automation] Cookies loaded: ${cookies.length} cookies`);

  // Create new page
  const page = await context.newPage();

  // Navigate to Facebook
  console.log('[automation] Navigating to Facebook...');
  await page.goto('https://www.facebook.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

  // Wait for page to stabilize
  await page.waitForTimeout(2000);

  // VALIDATE SESSION IN BROWSER
  const isLoggedIn = await page.evaluate(
    // This runs in browser context
    `!window.location.href.includes('/login') && !window.location.href.includes('/checkpoint')`
  );

  if (!isLoggedIn) {
    await browser.close();
    await sessionService.markAccountSessionsExpired(accountId);
    throw new Error('SESSION_EXPIRED: Cookies are invalid or session has expired');
  }

  console.log('[automation] Browser session ready and validated');

  return { browser, context, page };
}

/**
 * Close browser session
 */
export async function closeBrowser(session: BrowserSession): Promise<void> {
  await session.browser.close();
  console.log('[automation] Browser closed');
}

/**
 * Random delay helper (human-like behavior)
 */
function randomDelay(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export interface LikePostOptions {
  accountId: string;
  postUrl: string;
}

export interface LikePostResult {
  success: boolean;
  message: string;
  postUrl: string;
  accountUsername: string;
}

/**
 * Like a Facebook post
 * - Launches browser with account session
 * - Adds delay before action
 * - Navigates to post URL
 * - Clicks like button
 * - Adds delay after action
 * - Closes browser
 */
export async function likePost(options: LikePostOptions): Promise<LikePostResult> {
  const { accountId, postUrl } = options;

  // Get account info
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  console.log(`[like-action] Starting like action for account: ${account.username}`);
  console.log(`[like-action] Target URL: ${postUrl}`);

  // Launch browser
  const session = await launchBrowser({ accountId });
  const { page, browser } = session;

  try {
    // Navigate to post URL
    console.log(`[like-action] Navigating to post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to load with variance
    await behaviorEngine.waitWithVariance(2000, 0.3);

    // Pre-action behavior (scroll, mouse movement, reading simulation)
    await behaviorEngine.preActionBehavior(page);

    // Wait for reactions section to load
    await page.waitForTimeout(2000);

    // Check if post is in a popup/modal (Facebook opens posts in dialog)
    let container = page;
    const dialogSelector = 'div[role="dialog"]';
    const dialogCount = await page.locator(dialogSelector).count();

    if (dialogCount > 0) {
      console.log(`[like-action] Post is in a popup/dialog - scoping to dialog`);
      container = page.locator(dialogSelector).first() as any;
    } else {
      console.log(`[like-action] No dialog found - using full page`);
    }

    // Find and click like button WITHIN the container (popup or page)
    // Facebook like button selectors (updated for current FB structure)
    const likeSelectors = [
      '[aria-label="Like"]',
      '[aria-label="Thích"]', // Vietnamese
      'div[role="button"][aria-label="Like"]',
      'div[role="button"][aria-label="Thích"]',
    ];

    let clicked = false;

    for (const selector of likeSelectors) {
      try {
        console.log(`[like-action] Trying selector: ${selector}`);
        const element = container.locator(selector).first();
        const count = await container.locator(selector).count();
        console.log(`[like-action] Found ${count} elements in container for: ${selector}`);

        if (count > 0 && await element.isVisible({ timeout: 3000 })) {
          console.log(`[like-action] Found visible like button using selector: ${selector}`);
          await element.click();
          clicked = true;
          console.log('[like-action] ✅ Like button clicked');
          break;
        }
      } catch (err: any) {
        console.log(`[like-action] Selector failed: ${selector} - ${err.message}`);
        continue;
      }
    }

    // Fallback 1: Try clicking by exact text match within container
    if (!clicked) {
      console.log('[like-action] ⚠️ Trying fallback: exact text match in container');
      try {
        const likeSpan = container.locator('span').filter({ hasText: /^(Like|Thích)$/ }).first();
        if (await likeSpan.isVisible({ timeout: 2000 })) {
          await likeSpan.click();
          clicked = true;
          console.log('[like-action] ✅ Like button clicked (text fallback)');
        }
      } catch (err) {
        console.log('[like-action] Text fallback failed');
      }
    }

    // Fallback 2: Try getByText within dialog
    if (!clicked && dialogCount > 0) {
      console.log('[like-action] ⚠️ Trying fallback: getByText in dialog');
      try {
        const dialog = page.locator(dialogSelector).first();
        const likeText = dialog.getByText('Like', { exact: true }).first();
        if (await likeText.isVisible({ timeout: 2000 })) {
          await likeText.click();
          clicked = true;
          console.log('[like-action] ✅ Like button clicked (dialog getByText fallback)');
        }
      } catch (err) {
        console.log('[like-action] ❌ All fallbacks failed to click like button');
      }
    }

    // Post-action behavior (pause, optional scroll)
    await behaviorEngine.postActionBehavior(page);

    // Close browser
    await closeBrowser(session);

    // Log action to risk control
    await riskControl.logAction(
      accountId,
      'like',
      clicked ? 'success' : 'failed',
      postUrl,
      clicked ? undefined : 'Could not find like button'
    );

    return {
      success: clicked,
      message: clicked ? 'Post liked successfully' : 'Could not find like button',
      postUrl,
      accountUsername: account.username,
    };
  } catch (err: any) {
    console.error('[like-action] Error:', err.message);

    // Log failed action
    await riskControl.logAction(
      accountId,
      'like',
      'failed',
      postUrl,
      err.message
    );

    // Ensure browser is closed even on error
    try {
      await closeBrowser(session);
    } catch (closeErr) {
      console.error('[like-action] Error closing browser:', closeErr);
    }

    throw new Error(`Like action failed: ${err.message}`);
  }
}

export interface CommentPostOptions {
  accountId: string;
  postUrl: string;
  commentTemplate?: string; // Optional custom template, uses random if not provided
}

export interface CommentPostResult {
  success: boolean;
  message: string;
  postUrl: string;
  accountUsername: string;
  commentText: string;
  template?: string;
}

/**
 * Comment on a Facebook post with randomized content
 * - Launches browser with account session
 * - Generates unique comment using spin syntax
 * - Adds human-like delays and behaviors
 * - Navigates to post URL
 * - Types and submits comment
 * - Closes browser
 */
export async function commentPost(options: CommentPostOptions): Promise<CommentPostResult> {
  const { accountId, postUrl, commentTemplate } = options;

  // Get account info
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  // Generate unique comment
  let commentText: string;
  let templateUsed: string;

  if (commentTemplate) {
    const spinResult = contentService.testSpin(commentTemplate, 1);
    commentText = spinResult.variations[0];
    templateUsed = spinResult.template;
  } else {
    const generated = contentService.generateComment();
    commentText = generated.output;
    templateUsed = generated.original;
  }

  console.log(`[comment-action] Starting comment action for account: ${account.username}`);
  console.log(`[comment-action] Target URL: ${postUrl}`);
  console.log(`[comment-action] Comment: "${commentText}"`);
  console.log(`[comment-action] Template: "${templateUsed}"`);

  // Launch browser
  const session = await launchBrowser({ accountId });
  const { page, browser } = session;

  try {
    // Navigate to post URL
    console.log(`[comment-action] Navigating to post: ${postUrl}`);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Wait for page to load with variance
    await behaviorEngine.waitWithVariance(2000, 0.3);

    // Pre-action behavior (scroll, mouse movement, reading simulation)
    await behaviorEngine.preActionBehavior(page);

    // Find comment input box
    // Facebook comment box selectors (multiple attempts for reliability)
    // Enhanced with multi-language support including Vietnamese
    const commentSelectors = [
      // Primary selectors - English
      'div[aria-label="Write a comment"]',
      'div[aria-label="Write a comment..."]',
      'textarea[aria-label*="Write"]',
      
      // Multi-language aria-labels (Vietnamese, Spanish, French, etc.)
      'div[aria-label*="Viết"]',  // Vietnamese: "Viết bình luận"
      'div[aria-label*="bình luận"]',  // Vietnamese: "Viết bình luận"
      'div[aria-label*="Escribir"]',  // Spanish: "Escribe un comentario"
      'div[aria-label*="Écrire"]',  // French: "Écrire un commentaire"
      'div[aria-label*="commentar"]',  // Portuguese/Spanish variants
      'div[aria-label*="Schreib"]',  // German: "Schreib etwas..."
      'div[aria-label*="komment"]',  // German/Dutch variants
      
      // Secondary selectors - contenteditable divs
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"][data-key*="comment"]',
      
      // Test ID and placeholder selectors (language-agnostic)
      'div[data-testid="comment-input"]',
      'input[placeholder*="Write a comment"]',
      '[placeholder*="Write a comment"]',
      'input[placeholder*="Viết"]',  // Vietnamese placeholder
      'input[placeholder*="Escribir"]',  // Spanish placeholder
      
      // Alternative contenteditable selectors
      'div[role="presentation"] div[contenteditable="true"]',
      '[contenteditable="true"][role="textbox"]',
    ];

    let commentBox = null;
    for (const selector of commentSelectors) {
      try {
        const element = page.locator(selector).first();
        // Wait for element to be attached to DOM
        await element.waitFor({ state: 'attached', timeout: 5000 }).catch(() => null);
        
        if (await element.isVisible({ timeout: 3000 })) {
          console.log(`[comment-action] Found comment box using selector: ${selector}`);
          
          // Ensure element is scrolled into view
          await element.scrollIntoViewIfNeeded();
          await behaviorEngine.waitWithVariance(500, 0.2);
          
          commentBox = element;
          break;
        }
      } catch (err) {
        // Try next selector
        console.debug(`[comment-action] Selector not found/visible: ${selector}`);
        continue;
      }
    }

    if (!commentBox) {
      // Log diagnostic information for debugging
      console.error('[comment-action] Could not find comment input box');
      console.error('[comment-action] Current page URL:', postUrl);
      console.error('[comment-action] Attempting fallback: searching for any contenteditable element...');
      
      // Fallback: Find ANY contenteditable element in the page
      try {
        const fallbackElement = page.locator('div[contenteditable="true"]').first();
        await fallbackElement.waitFor({ state: 'attached', timeout: 3000 });
        if (await fallbackElement.isVisible({ timeout: 2000 })) {
          console.log('[comment-action] Found contenteditable element via fallback');
          commentBox = fallbackElement;
        }
      } catch (err) {
        // Still no luck
      }
      
      if (!commentBox) {
        throw new Error('Could not find comment input box');
      }
    }

    // Click on comment box to focus
    await commentBox.click();
    await behaviorEngine.waitWithVariance(1000, 0.2);
    
    // Ensure focus is set by clicking again if needed
    const isFocused = await page.evaluate(() => document.activeElement?.getAttribute('contenteditable') === 'true');
    if (!isFocused) {
      console.log('[comment-action] Ensuring focus on comment box...');
      await commentBox.click({ force: true });
      await behaviorEngine.waitWithVariance(500, 0.2);
    }

    // Type comment with human-like typing
    console.log(`[comment-action] Typing comment...`);
    await commentBox.pressSequentially(commentText, {
      delay: behaviorEngine.randomDelay(50, 150), // Random delay between keystrokes
    });

    // Wait after typing (user reviewing what they wrote)
    await behaviorEngine.waitWithVariance(1500, 0.3);

    // Find and click submit button
    const submitSelectors = [
      // Primary selectors - English
      'div[aria-label="Comment"]:not([aria-label="Write a comment"])',
      'button[aria-label="Post"]',
      'button[aria-label="Comment"]',
      
      // Multi-language selectors
      'button[aria-label*="Bình luận"]',  // Vietnamese: "Bình luận"
      'button[aria-label*="Viết bình luận"]',  // Vietnamese alternative
      'div[aria-label*="Bình luận"]',  // Vietnamese as div button
      'button[aria-label*="Comentar"]',  // Spanish: "Comentar"
      'button[aria-label*="Commenter"]',  // French: "Commenter"
      'button[aria-label*="Kommentieren"]',  // German: "Kommentieren"
      
      // Secondary selectors
      'button[type="submit"]',
      'div[role="button"]:has-text("Comment")',
      'div[role="button"]:has-text("Post")',
      'div[role="button"]:has-text("Bình luận")',  // Vietnamese
      'div[role="button"]:has-text("Comentar")',  // Spanish
      
      // Alternative selectors
      '[data-testid="comment-submit"]',
      'button:has-text("Post")',
      'button:has-text("Comment")',
      'button:has-text("Bình luận")',  // Vietnamese
      'button:has-text("Comentar")',  // Spanish
      
      // Fallback: look for button near the comment box
      'button[data-testid="comment_submit_button"]',
    ];

    let submitted = false;
    for (const selector of submitSelectors) {
      try {
        const submitBtn = page.locator(selector).first();
        await submitBtn.waitFor({ state: 'attached', timeout: 2000 }).catch(() => null);
        
        if (await submitBtn.isVisible({ timeout: 1500 })) {
          console.log(`[comment-action] Found submit button using selector: ${selector}`);
          await submitBtn.scrollIntoViewIfNeeded();
          await behaviorEngine.waitWithVariance(300, 0.2);
          await submitBtn.click();
          submitted = true;
          console.log('[comment-action] ✅ Comment submitted');
          break;
        }
      } catch (err) {
        // Try next selector
        console.debug(`[comment-action] Submit button selector not found: ${selector}`);
        continue;
      }
    }

    // Fallback: Press Enter to submit
    if (!submitted) {
      console.log('[comment-action] Attempting to submit with Enter key...');
      try {
        await commentBox.press('Enter');
        submitted = true;
        console.log('[comment-action] ✅ Comment submitted (Enter key)');
      } catch (err) {
        console.error('[comment-action] Failed to submit with Enter key:', err);
      }
    }

    // Post-action behavior (pause, optional scroll)
    await behaviorEngine.postActionBehavior(page);

    // Close browser
    await closeBrowser(session);

    // Log action to risk control
    await riskControl.logAction(
      accountId,
      'comment',
      'success',
      postUrl
    );

    return {
      success: true,
      message: 'Comment posted successfully',
      postUrl,
      accountUsername: account.username,
      commentText,
      template: templateUsed,
    };
  } catch (err: any) {
    console.error('[comment-action] Error:', err.message);

    // Log failed action
    await riskControl.logAction(
      accountId,
      'comment',
      'failed',
      postUrl,
      err.message
    );

    // Ensure browser is closed even on error
    try {
      await closeBrowser(session);
    } catch (closeErr) {
      console.error('[comment-action] Error closing browser:', closeErr);
    }

    throw new Error(`Comment action failed: ${err.message}`);
  }
}
