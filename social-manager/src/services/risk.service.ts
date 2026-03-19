/**
 * Risk Control Service
 *
 * Manages action limits, cooldowns, and risk scoring to prevent account bans
 * Tracks all actions and enforces safety limits
 */

import prisma from '../lib/prisma';

export interface ActionLimits {
  like: {
    perHour: number;
    perDay: number;
  };
  comment: {
    perHour: number;
    perDay: number;
  };
  share: {
    perHour: number;
    perDay: number;
  };
  follow: {
    perHour: number;
    perDay: number;
  };
}

export interface RiskScore {
  accountId: string;
  score: number; // 0-100 (0 = safe, 100 = very risky)
  level: 'safe' | 'low' | 'medium' | 'high' | 'critical';
  reasons: string[];
  canPerformAction: boolean;
  recommendedWaitTime?: number; // milliseconds
}

export interface RateLimitCheckResult {
  allowed: boolean;
  reason?: string;
  hourlyCount?: number;
  dailyCount?: number;
  hourlyLimit?: number;
  dailyLimit?: number;
}

export interface CooldownCheckResult {
  shouldWait: boolean;
  waitTime: number; // milliseconds
  lastAction?: Date;
}

export interface SafetyCheckResult {
  safe: boolean;
  riskScore: RiskScore;
  rateLimitCheck: RateLimitCheckResult;
  cooldownCheck: CooldownCheckResult;
  recommendations: string[];
}

export interface ActionStats {
  accountId: string;
  period: 'hour' | 'day';
  like: number;
  comment: number;
  share: number;
  follow: number;
  total: number;
}

class RiskControlService {
  // Default action limits (conservative for safety)
  private readonly DEFAULT_LIMITS: ActionLimits = {
    like: {
      perHour: 20,
      perDay: 100,
    },
    comment: {
      perHour: 10,
      perDay: 50,
    },
    share: {
      perHour: 5,
      perDay: 20,
    },
    follow: {
      perHour: 10,
      perDay: 40,
    },
  };

  // Minimum cooldown between actions (seconds)
  private readonly MIN_COOLDOWN = 30; // 30 seconds
  private readonly MAX_COOLDOWN = 300; // 5 minutes

  /**
   * Log an action to the database
   */
  async logAction(
    accountId: string,
    actionType: 'like' | 'comment' | 'share' | 'follow',
    status: 'success' | 'failed',
    targetUrl?: string,
    errorMsg?: string
  ): Promise<void> {
    await prisma.actionLog.create({
      data: {
        accountId,
        actionType,
        status,
        targetUrl,
        errorMsg,
      },
    });

    console.log(`[risk] Logged ${actionType} action for account ${accountId}: ${status}`);
  }

  /**
   * Get action stats for a specific period
   */
  async getActionStats(
    accountId: string,
    period: 'hour' | 'day'
  ): Promise<ActionStats> {
    const now = new Date();
    const since = new Date(
      now.getTime() - (period === 'hour' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000)
    );

    const logs = await prisma.actionLog.findMany({
      where: {
        accountId,
        executedAt: {
          gte: since,
        },
        status: 'success', // Only count successful actions
      },
      select: {
        actionType: true,
      },
    });

    const stats: ActionStats = {
      accountId,
      period,
      like: 0,
      comment: 0,
      share: 0,
      follow: 0,
      total: logs.length,
    };

    logs.forEach((log: { actionType: string }) => {
      const type = log.actionType as 'like' | 'comment' | 'share' | 'follow';
      if (type in stats) {
        stats[type]++;
      }
    });

    return stats;
  }

  /**
   * Check if action is allowed based on rate limits
   */
  async canPerformAction(
    accountId: string,
    actionType: 'like' | 'comment' | 'share' | 'follow',
    limits: ActionLimits = this.DEFAULT_LIMITS
  ): Promise<RateLimitCheckResult> {
    // Get hourly and daily stats
    const hourlyStats = await this.getActionStats(accountId, 'hour');
    const dailyStats = await this.getActionStats(accountId, 'day');

    const hourlyCount = hourlyStats[actionType];
    const dailyCount = dailyStats[actionType];

    const hourlyLimit = limits[actionType].perHour;
    const dailyLimit = limits[actionType].perDay;

    // Check hourly limit
    if (hourlyCount >= hourlyLimit) {
      return {
        allowed: false,
        reason: `Hourly limit reached for ${actionType} (${hourlyCount}/${hourlyLimit})`,
        hourlyCount,
        dailyCount,
        hourlyLimit,
        dailyLimit,
      };
    }

    // Check daily limit
    if (dailyCount >= dailyLimit) {
      return {
        allowed: false,
        reason: `Daily limit reached for ${actionType} (${dailyCount}/${dailyLimit})`,
        hourlyCount,
        dailyCount,
        hourlyLimit,
        dailyLimit,
      };
    }

    return {
      allowed: true,
      hourlyCount,
      dailyCount,
      hourlyLimit,
      dailyLimit,
    };
  }

  /**
   * Calculate risk score for an account
   */
  async calculateRiskScore(accountId: string): Promise<RiskScore> {
    let score = 0;
    const reasons: string[] = [];

    // Get hourly and daily stats
    const hourlyStats = await this.getActionStats(accountId, 'hour');
    const dailyStats = await this.getActionStats(accountId, 'day');

    // Factor 1: Hourly action velocity (0-30 points)
    const hourlyVelocity = hourlyStats.total;
    if (hourlyVelocity > 30) {
      score += 30;
      reasons.push('Very high hourly action rate');
    } else if (hourlyVelocity > 20) {
      score += 20;
      reasons.push('High hourly action rate');
    } else if (hourlyVelocity > 10) {
      score += 10;
      reasons.push('Moderate hourly action rate');
    }

    // Factor 2: Daily action velocity (0-30 points)
    const dailyVelocity = dailyStats.total;
    if (dailyVelocity > 150) {
      score += 30;
      reasons.push('Very high daily action rate');
    } else if (dailyVelocity > 100) {
      score += 20;
      reasons.push('High daily action rate');
    } else if (dailyVelocity > 50) {
      score += 10;
      reasons.push('Moderate daily action rate');
    }

    // Factor 3: Recent failures (0-20 points)
    const recentLogs = await prisma.actionLog.findMany({
      where: {
        accountId,
        executedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
      orderBy: {
        executedAt: 'desc',
      },
      take: 20,
    });

    const failureRate = recentLogs.filter(log => log.status === 'failed').length / Math.max(recentLogs.length, 1);
    if (failureRate > 0.5) {
      score += 20;
      reasons.push('High failure rate (>50%)');
    } else if (failureRate > 0.3) {
      score += 10;
      reasons.push('Moderate failure rate (>30%)');
    }

    // Factor 4: Action burst detection (0-20 points)
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const recentBurst = await prisma.actionLog.count({
      where: {
        accountId,
        executedAt: {
          gte: last5Minutes,
        },
      },
    });

    if (recentBurst > 10) {
      score += 20;
      reasons.push('Action burst detected (>10 actions in 5 min)');
    } else if (recentBurst > 5) {
      score += 10;
      reasons.push('Moderate action burst (>5 actions in 5 min)');
    }

    // Determine risk level and recommendations
    let level: RiskScore['level'];
    let canPerformAction = true;
    let recommendedWaitTime: number | undefined;

    if (score >= 80) {
      level = 'critical';
      canPerformAction = false;
      recommendedWaitTime = 60 * 60 * 1000; // 1 hour
      reasons.push('Account needs 1 hour cooldown');
    } else if (score >= 60) {
      level = 'high';
      canPerformAction = false;
      recommendedWaitTime = 30 * 60 * 1000; // 30 minutes
      reasons.push('Account needs 30 min cooldown');
    } else if (score >= 40) {
      level = 'medium';
      recommendedWaitTime = 10 * 60 * 1000; // 10 minutes
      reasons.push('Recommended 10 min cooldown');
    } else if (score >= 20) {
      level = 'low';
      recommendedWaitTime = 5 * 60 * 1000; // 5 minutes
    } else {
      level = 'safe';
    }

    return {
      accountId,
      score,
      level,
      reasons,
      canPerformAction,
      recommendedWaitTime,
    };
  }

  /**
   * Get last action time for an account
   */
  async getLastActionTime(accountId: string): Promise<Date | null> {
    const lastAction = await prisma.actionLog.findFirst({
      where: {
        accountId,
      },
      orderBy: {
        executedAt: 'desc',
      },
      select: {
        executedAt: true,
      },
    });

    return lastAction?.executedAt || null;
  }

  /**
   * Calculate recommended cooldown time based on recent activity
   */
  async getRecommendedCooldown(accountId: string): Promise<number> {
    const lastActionTime = await this.getLastActionTime(accountId);

    if (!lastActionTime) {
      return this.MIN_COOLDOWN * 1000; // First action, minimum cooldown
    }

    const timeSinceLastAction = Date.now() - lastActionTime.getTime();

    // If enough time has passed, minimum cooldown
    if (timeSinceLastAction > this.MAX_COOLDOWN * 1000) {
      return this.MIN_COOLDOWN * 1000;
    }

    // Get recent action count
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000);
    const recentCount = await prisma.actionLog.count({
      where: {
        accountId,
        executedAt: {
          gte: last5Minutes,
        },
      },
    });

    // More recent actions = longer cooldown
    if (recentCount > 5) {
      return this.MAX_COOLDOWN * 1000; // 5 minutes
    } else if (recentCount > 3) {
      return 120 * 1000; // 2 minutes
    } else if (recentCount > 1) {
      return 60 * 1000; // 1 minute
    }

    return this.MIN_COOLDOWN * 1000; // 30 seconds
  }

  /**
   * Check if account should wait before next action
   */
  async shouldWaitBeforeAction(accountId: string): Promise<CooldownCheckResult> {
    const lastActionTime = await this.getLastActionTime(accountId);

    if (!lastActionTime) {
      return {
        shouldWait: false,
        waitTime: 0,
      };
    }

    const recommendedCooldown = await this.getRecommendedCooldown(accountId);
    const timeSinceLastAction = Date.now() - lastActionTime.getTime();

    if (timeSinceLastAction < recommendedCooldown) {
      return {
        shouldWait: true,
        waitTime: recommendedCooldown - timeSinceLastAction,
        lastAction: lastActionTime,
      };
    }

    return {
      shouldWait: false,
      waitTime: 0,
      lastAction: lastActionTime,
    };
  }

  /**
   * Get comprehensive safety check for an account
   */
  async performSafetyCheck(
    accountId: string,
    actionType: 'like' | 'comment' | 'share' | 'follow',
    limits: ActionLimits = this.DEFAULT_LIMITS
  ): Promise<SafetyCheckResult> {
    // Run all checks in parallel
    const [riskScore, rateLimitCheck, cooldownCheck] = await Promise.all([
      this.calculateRiskScore(accountId),
      this.canPerformAction(accountId, actionType, limits),
      this.shouldWaitBeforeAction(accountId),
    ]);

    const recommendations: string[] = [];

    // Analyze results
    let safe = true;

    if (!riskScore.canPerformAction) {
      safe = false;
      recommendations.push(`Account risk too high (${riskScore.level})`);
    }

    if (!rateLimitCheck.allowed) {
      safe = false;
      recommendations.push(rateLimitCheck.reason!);
    }

    if (cooldownCheck.shouldWait) {
      safe = false;
      const waitMinutes = Math.ceil(cooldownCheck.waitTime / 1000 / 60);
      recommendations.push(`Wait ${waitMinutes} minute(s) before next action`);
    }

    if (safe) {
      recommendations.push('All checks passed - safe to proceed');
    }

    return {
      safe,
      riskScore,
      rateLimitCheck,
      cooldownCheck,
      recommendations,
    };
  }

  /**
   * Get default action limits
   */
  getDefaultLimits(): ActionLimits {
    return { ...this.DEFAULT_LIMITS };
  }

  /**
   * Clean up old action logs (older than N days)
   */
  async cleanupOldLogs(daysToKeep: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);

    const result = await prisma.actionLog.deleteMany({
      where: {
        executedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`[risk] Cleaned up ${result.count} old action logs`);
    return result.count;
  }
}

export const riskControl = new RiskControlService();
export default riskControl;
