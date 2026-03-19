import identityService, { IdentityValidationStatus } from '../services/identity.service';
import ruleEngineService from '../services/rule-engine.service';
import identityLogger from '../utils/identity-logger';
import prisma from '../lib/prisma';

export interface ExecutionGuardResult {
  allowed: boolean;
  identity?: any;
  reasons?: string[];
}

/**
 * Execution Guard
 * Critical layer that validates identity before ANY automation task
 *
 * Steps:
 * 1. Load identity
 * 2. Validate identity
 * 3. Check all rules
 * 4. IF status != VALID → STOP
 */
class ExecutionGuard {
  /**
   * Check if account can proceed with automation
   */
  async checkExecution(accountId: string): Promise<ExecutionGuardResult> {
    console.log(`[ExecutionGuard] Checking execution permission for account: ${accountId}`);

    try {
      // Step 1: Load identity
      const identity = await identityService.getIdentity(accountId);
      if (!identity) {
        console.error(`[ExecutionGuard] No identity found for account: ${accountId}`);
        identityLogger.logExecutionBlocked(accountId, ['No identity profile']);
        return {
          allowed: false,
          reasons: ['No identity profile found'],
        };
      }

      console.log(`[ExecutionGuard] Identity loaded for account: ${accountId}`);

      // Step 2: Validate identity
      const validationResult = await identityService.validateIdentity(accountId);

      if (validationResult.status === IdentityValidationStatus.INVALID) {
        console.error(`[ExecutionGuard] Identity validation failed for account: ${accountId}`);
        identityLogger.logExecutionBlocked(accountId, validationResult.reasons);
        return {
          allowed: false,
          identity,
          reasons: validationResult.reasons,
        };
      }

      console.log(`[ExecutionGuard] Identity validation status: ${validationResult.status}`);

      // Step 3: Run all rule checks
      const ruleCheckResult = await ruleEngineService.checkAllRules(accountId);

      if (!ruleCheckResult.passed) {
        const blockingReasons = ruleCheckResult.violations
          .filter((v) => v.shouldBlock)
          .map((v) => v.message);

        console.error(`[ExecutionGuard] Rule checks failed for account: ${accountId}`, blockingReasons);
        identityLogger.logExecutionBlocked(accountId, blockingReasons);

        return {
          allowed: false,
          identity,
          reasons: blockingReasons,
        };
      }

      console.log(`[ExecutionGuard] All checks passed for account: ${accountId}`);
      identityLogger.logExecutionAllowed(accountId);

      // Step 4: Return ALLOWED
      return {
        allowed: true,
        identity,
      };
    } catch (error) {
      console.error(`[ExecutionGuard] Error during execution check for account: ${accountId}`, error);
      identityLogger.logExecutionBlocked(accountId, [`Error: ${error}`]);
      return {
        allowed: false,
        reasons: [`Internal error: ${error}`],
      };
    }
  }

  /**
   * Validate and prepare identity bundle for browser automation
   */
  async prepareIdentityForExecution(accountId: string): Promise<{
    success: boolean;
    data?: {
      userAgent: string;
      proxy?: { host: string; port: number; username?: string; password?: string };
      cookies?: any;
      timezone: string;
    };
    error?: string;
  }> {
    console.log(`[ExecutionGuard] Preparing identity for execution: ${accountId}`);

    // Check execution permission
    const guardResult = await this.checkExecution(accountId);

    if (!guardResult.allowed) {
      return {
        success: false,
        error: guardResult.reasons?.join(', ') || 'Execution not allowed',
      };
    }

    const identity = guardResult.identity;

    // Get proxy details if assigned
    let proxyData;
    if (identity.proxyId) {
      const proxy = await prisma.proxy.findUnique({
        where: { id: identity.proxyId },
      });

      if (proxy) {
        proxyData = {
          host: proxy.host,
          port: proxy.port,
          username: proxy.username || undefined,
          password: proxy.password || undefined,
        };

        // Log proxy usage
        await identityService.logProxyUsage(accountId, identity.proxyId);
      }
    }

    return {
      success: true,
      data: {
        userAgent: identity.userAgent,
        proxy: proxyData,
        cookies: identity.cookies,
        timezone: identity.timezone,
      },
    };
  }
}

export default new ExecutionGuard();
