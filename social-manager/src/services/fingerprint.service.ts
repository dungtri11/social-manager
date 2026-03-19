/**
 * Fingerprint Service
 *
 * Generates unique browser fingerprints to reduce detection
 * Each account gets a unique combination of:
 * - User-Agent
 * - Viewport size
 * - Timezone
 * - Locale
 */

export interface BrowserFingerprint {
  userAgent: string;
  viewport: {
    width: number;
    height: number;
  };
  timezone: string;
  locale: string;
  platform: string;
}

class FingerprintService {
  // Common screen resolutions (realistic distributions)
  private readonly VIEWPORTS = [
    { width: 1920, height: 1080 }, // Full HD - most common
    { width: 1366, height: 768 },  // 2nd most common
    { width: 1536, height: 864 },  // HD+
    { width: 1440, height: 900 },  // MacBook Pro 13"
    { width: 1280, height: 720 },  // HD
    { width: 1600, height: 900 },  // HD+
    { width: 2560, height: 1440 }, // 2K
    { width: 1680, height: 1050 }, // WSXGA+
    { width: 1280, height: 800 },  // WXGA
    { width: 1920, height: 1200 }, // WUXGA
  ];

  // Common timezones
  private readonly TIMEZONES = [
    'America/New_York',
    'America/Chicago',
    'America/Los_Angeles',
    'America/Denver',
    'America/Phoenix',
    'America/Toronto',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Singapore',
    'Asia/Dubai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  // Common locales
  private readonly LOCALES = [
    'en-US',
    'en-GB',
    'en-CA',
    'en-AU',
    'es-ES',
    'es-MX',
    'fr-FR',
    'de-DE',
    'it-IT',
    'ja-JP',
    'zh-CN',
    'pt-BR',
  ];

  // Browser versions (Chrome)
  private readonly CHROME_VERSIONS = [
    '120.0.0.0',
    '119.0.0.0',
    '118.0.0.0',
    '117.0.0.0',
    '116.0.0.0',
  ];

  // Operating Systems
  private readonly PLATFORMS = [
    { name: 'Windows NT 10.0; Win64; x64', platform: 'Win32' },
    { name: 'Windows NT 11.0; Win64; x64', platform: 'Win32' },
    { name: 'Macintosh; Intel Mac OS X 10_15_7', platform: 'MacIntel' },
    { name: 'Macintosh; Intel Mac OS X 13_0_0', platform: 'MacIntel' },
    { name: 'X11; Linux x86_64', platform: 'Linux x86_64' },
  ];

  /**
   * Generate a random user agent
   */
  generateUserAgent(): string {
    const chromeVersion = this.randomChoice(this.CHROME_VERSIONS);
    const platform = this.randomChoice(this.PLATFORMS);

    // Format: Mozilla/5.0 (Platform) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/Version Safari/537.36
    return `Mozilla/5.0 (${platform.name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;
  }

  /**
   * Generate a random viewport size
   */
  generateViewport(): { width: number; height: number } {
    return this.randomChoice(this.VIEWPORTS);
  }

  /**
   * Generate a random timezone
   */
  generateTimezone(): string {
    return this.randomChoice(this.TIMEZONES);
  }

  /**
   * Generate a random locale
   */
  generateLocale(): string {
    return this.randomChoice(this.LOCALES);
  }

  /**
   * Generate a random platform
   */
  generatePlatform(): string {
    return this.randomChoice(this.PLATFORMS).platform;
  }

  /**
   * Generate a complete browser fingerprint
   * All values are randomized but realistic
   */
  generateFingerprint(): BrowserFingerprint {
    const platform = this.randomChoice(this.PLATFORMS);
    const chromeVersion = this.randomChoice(this.CHROME_VERSIONS);

    return {
      userAgent: `Mozilla/5.0 (${platform.name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      viewport: this.randomChoice(this.VIEWPORTS),
      timezone: this.randomChoice(this.TIMEZONES),
      locale: this.randomChoice(this.LOCALES),
      platform: platform.platform,
    };
  }

  /**
   * Generate a fingerprint compatible with a specific platform
   * Ensures timezone/locale match the platform for more realism
   */
  generateFingerprintForPlatform(platformType: 'windows' | 'mac' | 'linux'): BrowserFingerprint {
    let platform;
    let timezone;
    let locale;

    switch (platformType) {
      case 'windows':
        platform = this.randomChoice(
          this.PLATFORMS.filter(p => p.name.includes('Windows'))
        );
        timezone = this.randomChoice([
          'America/New_York',
          'America/Chicago',
          'America/Los_Angeles',
          'Europe/London',
        ]);
        locale = this.randomChoice(['en-US', 'en-GB']);
        break;

      case 'mac':
        platform = this.randomChoice(
          this.PLATFORMS.filter(p => p.name.includes('Macintosh'))
        );
        timezone = this.randomChoice([
          'America/New_York',
          'America/Los_Angeles',
          'America/Chicago',
        ]);
        locale = 'en-US';
        break;

      case 'linux':
        platform = this.randomChoice(
          this.PLATFORMS.filter(p => p.name.includes('Linux'))
        );
        timezone = this.randomChoice([
          'America/New_York',
          'Europe/London',
          'Asia/Tokyo',
        ]);
        locale = this.randomChoice(['en-US', 'en-GB']);
        break;

      default:
        return this.generateFingerprint();
    }

    const chromeVersion = this.randomChoice(this.CHROME_VERSIONS);

    return {
      userAgent: `Mozilla/5.0 (${platform.name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      viewport: this.randomChoice(this.VIEWPORTS),
      timezone,
      locale,
      platform: platform.platform,
    };
  }

  /**
   * Update an existing user agent to a new version
   * Maintains the platform but changes version
   */
  updateUserAgent(currentUserAgent: string): string {
    const newVersion = this.randomChoice(this.CHROME_VERSIONS);
    return currentUserAgent.replace(
      /Chrome\/[\d.]+/,
      `Chrome/${newVersion}`
    );
  }

  /**
   * Check if a user agent is outdated (older than 3 versions)
   */
  isUserAgentOutdated(userAgent: string): boolean {
    const versionMatch = userAgent.match(/Chrome\/([\d]+)/);
    if (!versionMatch) return true;

    const currentVersion = parseInt(versionMatch[1]);
    const latestVersion = parseInt(this.CHROME_VERSIONS[0].split('.')[0]);

    return (latestVersion - currentVersion) > 3;
  }

  /**
   * Random choice helper
   */
  private randomChoice<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)];
  }

  /**
   * Get a weighted random viewport (more common resolutions appear more often)
   */
  getWeightedViewport(): { width: number; height: number } {
    const weights = [
      0.35, // 1920x1080 - 35%
      0.20, // 1366x768 - 20%
      0.10, // 1536x864 - 10%
      0.08, // 1440x900 - 8%
      0.07, // 1280x720 - 7%
      0.06, // 1600x900 - 6%
      0.05, // 2560x1440 - 5%
      0.04, // 1680x1050 - 4%
      0.03, // 1280x800 - 3%
      0.02, // 1920x1200 - 2%
    ];

    const random = Math.random();
    let sum = 0;

    for (let i = 0; i < weights.length; i++) {
      sum += weights[i];
      if (random <= sum) {
        return this.VIEWPORTS[i];
      }
    }

    return this.VIEWPORTS[0]; // Fallback
  }

  /**
   * Generate fingerprint with realistic geographic correlation
   * Timezone and locale are correlated for more realism
   */
  generateRealisticFingerprint(): BrowserFingerprint {
    // Group timezones with their typical locales
    const regions = [
      {
        timezones: ['America/New_York', 'America/Chicago', 'America/Los_Angeles'],
        locales: ['en-US'],
        weight: 0.40, // 40% US
      },
      {
        timezones: ['Europe/London'],
        locales: ['en-GB'],
        weight: 0.15, // 15% UK
      },
      {
        timezones: ['Europe/Paris', 'Europe/Berlin', 'Europe/Rome'],
        locales: ['fr-FR', 'de-DE', 'it-IT'],
        weight: 0.15, // 15% EU
      },
      {
        timezones: ['Asia/Tokyo', 'Asia/Shanghai', 'Asia/Singapore'],
        locales: ['ja-JP', 'zh-CN', 'en-US'],
        weight: 0.15, // 15% Asia
      },
      {
        timezones: ['America/Toronto'],
        locales: ['en-CA', 'fr-FR'],
        weight: 0.10, // 10% Canada
      },
      {
        timezones: ['Australia/Sydney'],
        locales: ['en-AU'],
        weight: 0.05, // 5% Australia
      },
    ];

    // Select region based on weights
    const random = Math.random();
    let sum = 0;
    let selectedRegion = regions[0];

    for (const region of regions) {
      sum += region.weight;
      if (random <= sum) {
        selectedRegion = region;
        break;
      }
    }

    const timezone = this.randomChoice(selectedRegion.timezones);
    const locale = this.randomChoice(selectedRegion.locales);
    const platform = this.randomChoice(this.PLATFORMS);
    const chromeVersion = this.randomChoice(this.CHROME_VERSIONS);

    return {
      userAgent: `Mozilla/5.0 (${platform.name}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`,
      viewport: this.getWeightedViewport(),
      timezone,
      locale,
      platform: platform.platform,
    };
  }
}

export const fingerprintService = new FingerprintService();
export default fingerprintService;
