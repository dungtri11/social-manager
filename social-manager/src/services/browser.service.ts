import { chromium, Browser, BrowserContext, Page, Cookie } from 'playwright';
import prisma from '../lib/prisma';

function resolveHeadlessMode(): boolean {
  if (process.env.PLAYWRIGHT_HEADLESS === 'true') return true;
  if (process.env.PLAYWRIGHT_HEADED === 'true') return false;

  // In Linux containers there is usually no X server, so headed mode will crash.
  return process.platform === 'linux' && !process.env.DISPLAY;
}

/**
 * Browser Service
 * Handles browser launches for both manual login (headed) and automation (headless)
 */
class BrowserService {
  /**
   * Parse cookie string into Playwright cookie format
   */
  private parseCookieString(cookieString: string, domain: string = '.facebook.com'): Cookie[] {
    const cookies: Cookie[] = [];
    const pairs = cookieString.split(';').map(p => p.trim());

    for (const pair of pairs) {
      const [name, value] = pair.split('=');
      if (name && value) {
        cookies.push({
          name: name.trim(),
          value: value.trim(),
          domain,
          path: '/',
          expires: -1,
          httpOnly: false,
          secure: true,
          sameSite: 'Lax'
        });
      }
    }

    return cookies;
  }

  /**
   * Serialize cookies to string format
   */
  private serializeCookies(cookies: Cookie[]): string {
    return cookies
      .map(c => `${c.name}=${c.value}`)
      .join('; ');
  }

  /**
   * Launch HEADED browser for manual login
   * Tries to connect to real Chrome first, falls back to Playwright Chromium
   */
  async launchHeadedBrowser(
    accountId: string
  ): Promise<{ browser: Browser; cookieString: string | null }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { proxy: true }
    });

    if (!account) {
      throw new Error('Account not found');
    }

    console.log(`[BrowserService] Launching headed browser for account ${account.username}`);

    let browser: Browser;
    let useRealChrome = false;

    // Try to connect to real Chrome first (started with --remote-debugging-port=9222)
    try {
      console.log('[BrowserService] Attempting to connect to real Chrome on port 9222...');
      browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
      useRealChrome = true;
      console.log('[BrowserService] Connected to real Chrome browser!');
    } catch {
      console.log('[BrowserService] Real Chrome not available, using Playwright Chromium...');
      browser = await chromium.launch({
        headless: false,
        proxy: account.proxy ? {
          server: `http://${account.proxy.host}:${account.proxy.port}`,
          username: account.proxy.username || undefined,
          password: account.proxy.password || undefined
        } : undefined,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-infobars',
          '--no-first-run',
          '--no-default-browser-check',
          '--window-size=1280,720',
        ]
      });
    }

    let context: BrowserContext;

    if (useRealChrome) {
      // For real Chrome, use existing context or create new one
      const contexts = browser.contexts();
      if (contexts.length > 0) {
        context = contexts[0];
      } else {
        context = await browser.newContext();
      }
    } else {
      context = await browser.newContext({
        userAgent: account.userAgent,
        viewport: { width: 1280, height: 720 },
        locale: 'en-US',
        timezoneId: 'America/New_York',
        colorScheme: 'light',
      });

      // Anti-detection for Playwright Chromium
      await context.addInitScript(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
            { name: 'Native Client', filename: 'internal-nacl-plugin' },
          ],
        });
        Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
        (window as any).chrome = { runtime: {}, loadTimes: () => ({}), csi: () => ({}), app: {} };
      });
    }

    const page = await context.newPage();

    console.log('[BrowserService] Please login manually in the browser window...');

    await page.goto('https://www.facebook.com', { waitUntil: 'networkidle' });

    try {
      console.log('[BrowserService] Waiting for login completion...');

      // PHASE 1: Check if already logged in
      const initialCookies = await context.cookies();
      const alreadyLoggedIn = initialCookies.some(c => c.name === 'c_user');

      if (alreadyLoggedIn) {
        console.log('[BrowserService] Already logged in (c_user cookie found)');
        const cookieString = this.serializeCookies(initialCookies);
        return { browser, cookieString };
      }

      // PHASE 2: Wait for login form
      console.log('[BrowserService] Waiting for login form to appear...');
      try {
        await page.waitForSelector('input[name="email"], input[id="email"], #email', {
          timeout: 10000
        });
        console.log('[BrowserService] Login form detected, waiting for user to login...');
      } catch {
        console.log('[BrowserService] No login form found, checking current state...');
      }

      // PHASE 3: Poll for c_user cookie
      console.log('[BrowserService] Monitoring for login success (c_user cookie)...');

      const startTime = Date.now();
      const timeoutMs = 12 * 60 * 60 * 1000; // 12 hours

      let lastCookieCount = 0;
      while (Date.now() - startTime < timeoutMs) {
        const cookies = await context.cookies();
        const hasAuthCookie = cookies.some(c => c.name === 'c_user');

        if (cookies.length !== lastCookieCount) {
          console.log(`[BrowserService] Cookie count: ${cookies.length}`);
          lastCookieCount = cookies.length;
        }

        if (hasAuthCookie) {
          console.log('[BrowserService] Login successful! c_user cookie detected.');
          await page.waitForTimeout(2000);

          const finalCookies = await context.cookies();
          const cookieString = this.serializeCookies(finalCookies);

          console.log(`[BrowserService] Captured ${finalCookies.length} cookies`);
          return { browser, cookieString };
        }

        await page.waitForTimeout(1000);
      }

      console.log('[BrowserService] Login timeout');
      return { browser, cookieString: null };

    } catch (error) {
      console.error('[BrowserService] Login error:', error);
      return { browser, cookieString: null };
    }
  }

  /**
   * Launch HEADLESS browser with existing cookies for automation
   */
  async launchHeadlessBrowser(accountId: string): Promise<{ browser: Browser; context: BrowserContext; page: Page }> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { proxy: true }
    });

    if (!account) {
      throw new Error('Account not found');
    }

    // Get cookies from CookieSession (Identity Manager)
    const cookieSession = await prisma.cookieSession.findFirst({
      where: {
        accountId,
        status: 'ACTIVE',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!cookieSession) {
      throw new Error('No active session cookie available');
    }

    console.log(`[BrowserService] Launching headless browser for account ${account.username}`);

    const browser = await chromium.launch({
      headless: resolveHeadlessMode(),
      proxy: account.proxy ? {
        server: `http://${account.proxy.host}:${account.proxy.port}`,
        username: account.proxy.username || undefined,
        password: account.proxy.password || undefined
      } : undefined,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
      ]
   });

    console.log(`[BrowserService] Browser mode: ${resolveHeadlessMode() ? 'headless' : 'headed'}`);

    const context = await browser.newContext({
      userAgent: account.userAgent,
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
      timezoneId: 'America/New_York',
      colorScheme: 'light',
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      javaScriptEnabled: true,
      permissions: []
    });

    // Load cookies from CookieSession
    const cookies: Cookie[] = Array.isArray(cookieSession.cookies)
      ? (cookieSession.cookies as unknown as Cookie[])
      : this.parseCookieString(JSON.stringify(cookieSession.cookies));

    await context.addCookies(cookies);

    console.log(`[BrowserService] Loaded ${cookies.length} cookies from CookieSession`);

    const page = await context.newPage();

    return { browser, context, page };
  }

  /**
   * Validate session by attempting to load Facebook
   * Checks if cookies are valid by verifying we're not redirected to login
   */
  async validateSessionInBrowser(page: Page): Promise<boolean> {
    try {
      await page.goto('https://www.facebook.com', {
        waitUntil: 'networkidle',
        timeout: 30000
      });

      // Check if redirected to login page or checkpoint
      const url = page.url();
      const isLoggedIn = !url.includes('/login') && !url.includes('/checkpoint');

      console.log(`[BrowserService] Session validation: ${isLoggedIn ? 'VALID' : 'INVALID'} (URL: ${url})`);

      return isLoggedIn;

    } catch (error) {
      console.error('[BrowserService] Session validation failed:', error);
      return false;
    }
  }
}

export default new BrowserService();
