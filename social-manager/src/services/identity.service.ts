import { CookieStatus } from '@prisma/client';
import crypto from 'crypto';
import identityLogger from '../utils/identity-logger';
import prisma from '../lib/prisma';

export interface IdentityBundle {
  accountId: string;
  userAgent: string;
  proxyId: string | null;
  timezone: string;
  fingerprintHash: string;
  cookies?: any;
}

export enum IdentityValidationStatus {
  VALID = 'VALID',
  RISKY = 'RISKY',
  INVALID = 'INVALID',
}

export interface ValidationResult {
  status: IdentityValidationStatus;
  reasons: string[];
}

class IdentityService {
  /**
   * Create a new identity profile for an account
   */
  async createIdentity(accountId: string): Promise<IdentityBundle> {
    console.log(`[IdentityService] Creating identity for account: ${accountId}`);

    // Get account details
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: { proxy: true },
    });

    if (!account) {
      throw new Error(`Account ${accountId} not found`);
    }

    // Assign user agent (use existing or generate new)
    const userAgent = account.userAgent || this.generateUserAgent();

    // Get timezone (default to a random timezone)
    const timezone = this.getRandomTimezone();

    // Generate fingerprint hash
    const fingerprintHash = this.generateFingerprintHash({
      accountId,
      userAgent,
      proxyId: account.proxyId,
      timezone,
    });

    // Check if identity profile already exists
    const existing = await prisma.identityProfile.findUnique({
      where: { accountId },
    });

    let identityProfile;
    if (existing) {
      // Update existing profile
      identityProfile = await prisma.identityProfile.update({
        where: { accountId },
        data: {
          userAgent,
          proxyId: account.proxyId,
          timezone,
          fingerprintHash,
        },
      });
      console.log(`[IdentityService] Updated identity profile for account: ${accountId}`);
      identityLogger.logIdentityUpdated(accountId, { userAgent, proxyId: account.proxyId, timezone });
    } else {
      // Create new profile
      identityProfile = await prisma.identityProfile.create({
        data: {
          accountId,
          userAgent,
          proxyId: account.proxyId,
          timezone,
          fingerprintHash,
        },
      });
      console.log(`[IdentityService] Created new identity profile for account: ${accountId}`);
      identityLogger.logIdentityCreated(accountId, { userAgent, proxyId: account.proxyId, timezone });
    }

    return {
      accountId: identityProfile.accountId,
      userAgent: identityProfile.userAgent,
      proxyId: identityProfile.proxyId,
      timezone: identityProfile.timezone,
      fingerprintHash: identityProfile.fingerprintHash,
    };
  }

  /**
   * Get identity bundle for an account
   */
  async getIdentity(accountId: string): Promise<IdentityBundle | null> {
    console.log(`[IdentityService] Getting identity for account: ${accountId}`);

    const identityProfile = await prisma.identityProfile.findUnique({
      where: { accountId },
    });

    if (!identityProfile) {
      console.log(`[IdentityService] No identity profile found for account: ${accountId}`);
      return null;
    }

    // Get latest active cookie session
    const cookieSession = await prisma.cookieSession.findFirst({
      where: {
        accountId,
        status: CookieStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      accountId: identityProfile.accountId,
      userAgent: identityProfile.userAgent,
      proxyId: identityProfile.proxyId,
      timezone: identityProfile.timezone,
      fingerprintHash: identityProfile.fingerprintHash,
      cookies: cookieSession?.cookies,
    };
  }

  /**
   * Validate identity consistency before execution
   */
  async validateIdentity(accountId: string): Promise<ValidationResult> {
    console.log(`[IdentityService] Validating identity for account: ${accountId}`);

    const reasons: string[] = [];

    // Get identity profile
    const identityProfile = await prisma.identityProfile.findUnique({
      where: { accountId },
    });

    if (!identityProfile) {
      return {
        status: IdentityValidationStatus.INVALID,
        reasons: ['No identity profile found'],
      };
    }

    // Get account
    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return {
        status: IdentityValidationStatus.INVALID,
        reasons: ['Account not found'],
      };
    }

    // Check 1: Proxy consistency
    if (identityProfile.proxyId !== account.proxyId) {
      reasons.push('Proxy mismatch detected');
    }

    // Check 2: User-Agent consistency
    if (identityProfile.userAgent !== account.userAgent) {
      reasons.push('User-Agent changed');
    }

    // Check 3: Cookie session status
    const activeCookieSession = await prisma.cookieSession.findFirst({
      where: {
        accountId,
        status: CookieStatus.ACTIVE,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!activeCookieSession) {
      reasons.push('No active cookie session');
    }

    // Check 4: Recent proxy usage (check if proxy changed recently)
    const recentProxyUsage = await prisma.proxyUsageLog.findMany({
      where: { accountId },
      orderBy: { usedAt: 'desc' },
      take: 2,
    });

    if (recentProxyUsage.length >= 2) {
      const [latest, previous] = recentProxyUsage;
      if (latest.proxyId !== previous.proxyId) {
        reasons.push('Proxy changed recently');
      }

      // Check for rapid IP change (within 1 hour)
      const timeDiff = latest.usedAt.getTime() - previous.usedAt.getTime();
      if (timeDiff < 3600000 && latest.ipAddress !== previous.ipAddress) {
        reasons.push('Rapid IP change detected');
      }
    }

    // Determine validation status
    if (reasons.length === 0) {
      console.log(`[IdentityService] Identity validation PASSED for account: ${accountId}`);
      identityLogger.logIdentityValidated(accountId, IdentityValidationStatus.VALID, []);
      return {
        status: IdentityValidationStatus.VALID,
        reasons: [],
      };
    } else if (reasons.includes('Proxy changed recently') || reasons.includes('Rapid IP change detected')) {
      console.log(`[IdentityService] Identity validation RISKY for account: ${accountId}`, reasons);
      identityLogger.logIdentityValidated(accountId, IdentityValidationStatus.RISKY, reasons);
      return {
        status: IdentityValidationStatus.RISKY,
        reasons,
      };
    } else {
      console.log(`[IdentityService] Identity validation FAILED for account: ${accountId}`, reasons);
      identityLogger.logIdentityValidated(accountId, IdentityValidationStatus.INVALID, reasons);
      return {
        status: IdentityValidationStatus.INVALID,
        reasons,
      };
    }
  }

  /**
   * Generate a fingerprint hash from identity data
   */
  private generateFingerprintHash(data: {
    accountId: string;
    userAgent: string;
    proxyId: string | null;
    timezone: string;
  }): string {
    const hashInput = `${data.accountId}:${data.userAgent}:${data.proxyId}:${data.timezone}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  /**
   * Generate a random user agent
   */
  private generateUserAgent(): string {
    const userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
  }

  /**
   * Get a random timezone
   */
  private getRandomTimezone(): string {
    const timezones = [
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ];
    return timezones[Math.floor(Math.random() * timezones.length)];
  }

  /**
   * Store cookie session
   */
  async storeCookieSession(accountId: string, cookies: any): Promise<void> {
    console.log(`[IdentityService] Storing cookie session for account: ${accountId}`);

    // Mark all previous sessions as expired
    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: CookieStatus.ACTIVE,
      },
      data: {
        status: CookieStatus.EXPIRED,
      },
    });

    // Create new session
    await prisma.cookieSession.create({
      data: {
        accountId,
        cookies,
        status: CookieStatus.ACTIVE,
        lastValidatedAt: new Date(),
      },
    });

    console.log(`[IdentityService] Cookie session stored for account: ${accountId}`);
    identityLogger.logCookieStored(accountId);
  }

  /**
   * Mark cookie session as expired
   */
  async expireCookieSession(accountId: string): Promise<void> {
    console.log(`[IdentityService] Expiring cookie session for account: ${accountId}`);

    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: CookieStatus.ACTIVE,
      },
      data: {
        status: CookieStatus.EXPIRED,
      },
    });

    identityLogger.logCookieExpired(accountId);
  }

  /**
   * Mark cookie session as checkpoint
   */
  async markCookieAsCheckpoint(accountId: string): Promise<void> {
    console.log(`[IdentityService] Marking cookie as checkpoint for account: ${accountId}`);

    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: CookieStatus.ACTIVE,
      },
      data: {
        status: CookieStatus.CHECKPOINT,
      },
    });

    identityLogger.logCookieCheckpoint(accountId);
  }

  /**
   * Log proxy usage
   */
  async logProxyUsage(accountId: string, proxyId: string, ipAddress?: string): Promise<void> {
    console.log(`[IdentityService] Logging proxy usage for account: ${accountId}, proxy: ${proxyId}`);

    await prisma.proxyUsageLog.create({
      data: {
        accountId,
        proxyId,
        ipAddress: ipAddress || null,
      },
    });

    identityLogger.logProxyUsage(accountId, proxyId, ipAddress);
  }
}

export default new IdentityService();
