import { RiskEventType, RiskSeverity, CookieStatus } from '@prisma/client';
import identityLogger from '../utils/identity-logger';
import prisma from '../lib/prisma';

export interface RuleViolation {
  rule: string;
  severity: RiskSeverity;
  message: string;
  shouldBlock: boolean;
}

export interface RuleCheckResult {
  passed: boolean;
  violations: RuleViolation[];
}

class RuleEngineService {
  /**
   * Execute all rules for an account before automation
   */
  async checkAllRules(accountId: string): Promise<RuleCheckResult> {
    console.log(`[RuleEngine] Checking all rules for account: ${accountId}`);

    const violations: RuleViolation[] = [];

    // Run all rules in parallel
    const [
      proxyConsistency,
      userAgentChange,
      multipleAccountsPerProxy,
      cookieInvalid,
      rapidIpChange,
    ] = await Promise.all([
      this.checkProxyConsistency(accountId),
      this.checkUserAgentChange(accountId),
      this.checkMultipleAccountsPerProxy(accountId),
      this.checkCookieInvalid(accountId),
      this.checkRapidIpChange(accountId),
    ]);

    // Collect violations
    if (proxyConsistency) violations.push(proxyConsistency);
    if (userAgentChange) violations.push(userAgentChange);
    if (multipleAccountsPerProxy) violations.push(multipleAccountsPerProxy);
    if (cookieInvalid) violations.push(cookieInvalid);
    if (rapidIpChange) violations.push(rapidIpChange);

    // Check if any violation should block execution
    const shouldBlock = violations.some((v) => v.shouldBlock);

    if (violations.length > 0) {
      console.log(`[RuleEngine] Rule violations detected for account: ${accountId}`, violations);

      // Log all violations as risk events
      await this.logRuleViolations(accountId, violations);

      // Log individual rule violations
      violations.forEach((violation) => {
        identityLogger.logRuleViolation(
          accountId,
          violation.rule,
          violation.severity,
          violation.message,
          violation.shouldBlock
        );
      });

      // Log execution status
      if (shouldBlock) {
        const blockReasons = violations.filter((v) => v.shouldBlock).map((v) => v.message);
        identityLogger.logExecutionBlocked(accountId, blockReasons);
      }
    } else {
      console.log(`[RuleEngine] All rules passed for account: ${accountId}`);
      identityLogger.logExecutionAllowed(accountId);
    }

    return {
      passed: !shouldBlock,
      violations,
    };
  }

  /**
   * Rule 1: Proxy Consistency
   * IF account uses new proxy THEN log risk_event (HIGH) AND block execution
   */
  private async checkProxyConsistency(accountId: string): Promise<RuleViolation | null> {
    console.log(`[RuleEngine] Checking proxy consistency for account: ${accountId}`);

    const identityProfile = await prisma.identityProfile.findUnique({
      where: { accountId },
    });

    if (!identityProfile) {
      return null; // No identity profile yet, skip this check
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return null;
    }

    // Check if proxy has changed
    if (identityProfile.proxyId !== account.proxyId) {
      return {
        rule: 'PROXY_CONSISTENCY',
        severity: RiskSeverity.HIGH,
        message: `Proxy mismatch: Identity profile has proxy ${identityProfile.proxyId}, but account has proxy ${account.proxyId}`,
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Rule 2: User-Agent Change
   * IF user_agent != stored user_agent THEN log risk_event (HIGH) AND block execution
   */
  private async checkUserAgentChange(accountId: string): Promise<RuleViolation | null> {
    console.log(`[RuleEngine] Checking user-agent change for account: ${accountId}`);

    const identityProfile = await prisma.identityProfile.findUnique({
      where: { accountId },
    });

    if (!identityProfile) {
      return null; // No identity profile yet, skip this check
    }

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return null;
    }

    // Check if user-agent has changed
    if (identityProfile.userAgent !== account.userAgent) {
      return {
        rule: 'USER_AGENT_CHANGE',
        severity: RiskSeverity.HIGH,
        message: `User-Agent mismatch: Identity profile has "${identityProfile.userAgent}", but account has "${account.userAgent}"`,
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Rule 3: Multiple Accounts per Proxy
   * IF proxy_id used by > 1 active account THEN log risk_event (MEDIUM)
   */
  private async checkMultipleAccountsPerProxy(accountId: string): Promise<RuleViolation | null> {
    console.log(`[RuleEngine] Checking multiple accounts per proxy for account: ${accountId}`);

    const account = await prisma.account.findUnique({
      where: { id: accountId },
    });

    if (!account || !account.proxyId) {
      return null; // No proxy assigned
    }

    // Count how many accounts are using this proxy
    const accountsUsingProxy = await prisma.account.count({
      where: {
        proxyId: account.proxyId,
      },
    });

    if (accountsUsingProxy > 1) {
      return {
        rule: 'MULTIPLE_ACCOUNTS_PER_PROXY',
        severity: RiskSeverity.MEDIUM,
        message: `Proxy ${account.proxyId} is being used by ${accountsUsingProxy} accounts`,
        shouldBlock: false, // Don't block, just warn
      };
    }

    return null;
  }

  /**
   * Rule 4: Cookie Invalid
   * IF session invalid THEN mark cookie status = EXPIRED AND stop automation
   */
  private async checkCookieInvalid(accountId: string): Promise<RuleViolation | null> {
    console.log(`[RuleEngine] Checking cookie validity for account: ${accountId}`);

    // Check for active cookie session
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
      return {
        rule: 'COOKIE_INVALID',
        severity: RiskSeverity.HIGH,
        message: 'No active cookie session found',
        shouldBlock: true,
      };
    }

    // Check if cookie session is too old (e.g., > 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    if (activeCookieSession.createdAt < thirtyDaysAgo) {
      // Mark as expired
      await prisma.cookieSession.update({
        where: { id: activeCookieSession.id },
        data: { status: CookieStatus.EXPIRED },
      });

      return {
        rule: 'COOKIE_INVALID',
        severity: RiskSeverity.HIGH,
        message: 'Cookie session expired (older than 30 days)',
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Rule 5: Rapid IP Change
   * IF IP changes within short time window THEN mark HIGH risk
   */
  private async checkRapidIpChange(accountId: string): Promise<RuleViolation | null> {
    console.log(`[RuleEngine] Checking rapid IP change for account: ${accountId}`);

    // Get last 2 proxy usage logs
    const recentUsages = await prisma.proxyUsageLog.findMany({
      where: { accountId },
      orderBy: { usedAt: 'desc' },
      take: 2,
    });

    if (recentUsages.length < 2) {
      return null; // Not enough history
    }

    const [latest, previous] = recentUsages;

    // Check if IPs are different
    if (!latest.ipAddress || !previous.ipAddress) {
      return null; // No IP data
    }

    if (latest.ipAddress === previous.ipAddress) {
      return null; // Same IP, no issue
    }

    // Check time difference (1 hour threshold)
    const timeDiffMs = latest.usedAt.getTime() - previous.usedAt.getTime();
    const oneHourMs = 60 * 60 * 1000;

    if (timeDiffMs < oneHourMs) {
      return {
        rule: 'RAPID_IP_CHANGE',
        severity: RiskSeverity.HIGH,
        message: `IP changed from ${previous.ipAddress} to ${latest.ipAddress} within ${Math.round(timeDiffMs / 1000 / 60)} minutes`,
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Log rule violations as risk events
   */
  private async logRuleViolations(accountId: string, violations: RuleViolation[]): Promise<void> {
    console.log(`[RuleEngine] Logging ${violations.length} rule violations for account: ${accountId}`);

    const riskEvents = violations.map((violation) => {
      let eventType: RiskEventType;

      switch (violation.rule) {
        case 'PROXY_CONSISTENCY':
        case 'RAPID_IP_CHANGE':
          eventType = RiskEventType.IP_CHANGE;
          break;
        case 'USER_AGENT_CHANGE':
          eventType = RiskEventType.UA_CHANGE;
          break;
        case 'COOKIE_INVALID':
          eventType = RiskEventType.CHECKPOINT;
          break;
        default:
          eventType = RiskEventType.CHECKPOINT;
      }

      return {
        accountId,
        type: eventType,
        severity: violation.severity,
        metadata: {
          rule: violation.rule,
          message: violation.message,
          shouldBlock: violation.shouldBlock,
        },
      };
    });

    await prisma.riskEvent.createMany({
      data: riskEvents,
    });

    console.log(`[RuleEngine] Logged ${riskEvents.length} risk events`);
  }

  /**
   * Get recent risk events for an account
   */
  async getRecentRiskEvents(accountId: string, limit: number = 10) {
    console.log(`[RuleEngine] Getting recent risk events for account: ${accountId}`);

    return await prisma.riskEvent.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Calculate risk score for an account based on recent events
   */
  async calculateRiskScore(accountId: string): Promise<number> {
    console.log(`[RuleEngine] Calculating risk score for account: ${accountId}`);

    // Get risk events from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentEvents = await prisma.riskEvent.findMany({
      where: {
        accountId,
        createdAt: {
          gte: sevenDaysAgo,
        },
      },
    });

    // Calculate score based on severity
    let score = 0;
    for (const event of recentEvents) {
      switch (event.severity) {
        case RiskSeverity.LOW:
          score += 1;
          break;
        case RiskSeverity.MEDIUM:
          score += 5;
          break;
        case RiskSeverity.HIGH:
          score += 10;
          break;
      }
    }

    console.log(`[RuleEngine] Risk score for account ${accountId}: ${score}`);
    return score;
  }

  /**
   * Check if account is safe to use based on risk score
   */
  async isAccountSafe(accountId: string): Promise<boolean> {
    const riskScore = await this.calculateRiskScore(accountId);
    const threshold = 20; // Configurable threshold

    return riskScore < threshold;
  }
}

export default new RuleEngineService();
