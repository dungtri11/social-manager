/**
 * Identity Manager - Example Usage
 *
 * This file demonstrates how to use the Identity Manager module
 * in your automation workflow.
 */

import identityService from '../services/identity.service';
import ruleEngineService from '../services/rule-engine.service';
import executionGuard from '../guards/execution.guard';
import identityLogger, { IdentityLogEntry } from '../utils/identity-logger';

/**
 * Example 1: Initialize identity for a new account
 */
async function initializeAccountIdentity(accountId: string) {
  console.log('=== Example 1: Initialize Identity ===');

  try {
    // Create identity profile
    const identity = await identityService.createIdentity(accountId);
    console.log('✅ Identity created:', identity);

    // Simulate storing cookies after login
    const mockCookies = [
      { name: 'sessionid', value: 'xyz123', domain: '.facebook.com' },
      { name: 'c_user', value: '100001234567890', domain: '.facebook.com' },
    ];

    await identityService.storeCookieSession(accountId, mockCookies);
    console.log('✅ Cookies stored');

    return identity;
  } catch (error) {
    console.error('❌ Failed to initialize identity:', error);
    throw error;
  }
}

/**
 * Example 2: Validate identity before automation
 */
async function validateBeforeExecution(accountId: string) {
  console.log('\n=== Example 2: Validate Identity ===');

  try {
    // Validate identity
    const validation = await identityService.validateIdentity(accountId);
    console.log('Validation status:', validation.status);

    if (validation.reasons.length > 0) {
      console.log('⚠️ Validation issues:', validation.reasons);
    } else {
      console.log('✅ Identity is valid');
    }

    return validation;
  } catch (error) {
    console.error('❌ Validation failed:', error);
    throw error;
  }
}

/**
 * Example 3: Run rule checks
 */
async function checkRules(accountId: string) {
  console.log('\n=== Example 3: Rule Checks ===');

  try {
    const ruleCheck = await ruleEngineService.checkAllRules(accountId);

    if (ruleCheck.passed) {
      console.log('✅ All rules passed');
    } else {
      console.log('❌ Rule violations detected:');
      ruleCheck.violations.forEach((violation: { severity: string; rule: string; message: string; shouldBlock: boolean }) => {
        console.log(`  - [${violation.severity}] ${violation.rule}: ${violation.message}`);
        if (violation.shouldBlock) {
          console.log('    ⛔ This violation will BLOCK execution');
        }
      });
    }

    return ruleCheck;
  } catch (error) {
    console.error('❌ Rule check failed:', error);
    throw error;
  }
}

/**
 * Example 4: Use Execution Guard (RECOMMENDED)
 */
async function safeExecutionCheck(accountId: string) {
  console.log('\n=== Example 4: Execution Guard (Recommended) ===');

  try {
    // Single function that validates everything
    const guardResult = await executionGuard.checkExecution(accountId);

    if (guardResult.allowed) {
      console.log('✅ Execution ALLOWED');
      console.log('Identity bundle:', guardResult.identity);
      return true;
    } else {
      console.log('⛔ Execution BLOCKED');
      console.log('Reasons:', guardResult.reasons);
      return false;
    }
  } catch (error) {
    console.error('❌ Guard check failed:', error);
    return false;
  }
}

/**
 * Example 5: Prepare identity for browser automation
 */
async function prepareForBrowserAutomation(accountId: string) {
  console.log('\n=== Example 5: Prepare for Browser ===');

  try {
    const prepared = await executionGuard.prepareIdentityForExecution(accountId);

    if (prepared.success) {
      console.log('✅ Identity prepared for browser');
      console.log('User-Agent:', prepared.data?.userAgent);
      console.log('Proxy:', prepared.data?.proxy);
      console.log('Timezone:', prepared.data?.timezone);
      console.log('Has cookies:', !!prepared.data?.cookies);

      return prepared.data;
    } else {
      console.log('❌ Cannot prepare identity:', prepared.error);
      return null;
    }
  } catch (error) {
    console.error('❌ Preparation failed:', error);
    return null;
  }
}

/**
 * Example 6: Calculate risk score
 */
async function checkRiskScore(accountId: string) {
  console.log('\n=== Example 6: Risk Score ===');

  try {
    const riskScore = await ruleEngineService.calculateRiskScore(accountId);
    const isSafe = await ruleEngineService.isAccountSafe(accountId);

    console.log(`Risk Score: ${riskScore}`);
    console.log(`Account Safe: ${isSafe ? '✅ Yes' : '❌ No'}`);

    // Get recent risk events
    const recentEvents = await ruleEngineService.getRecentRiskEvents(accountId, 5);
    if (recentEvents.length > 0) {
      console.log('\nRecent risk events:');
      recentEvents.forEach((event) => {
        console.log(`  - [${event.severity}] ${event.type} at ${event.createdAt}`);
      });
    }

    return { riskScore, isSafe };
  } catch (error) {
    console.error('❌ Risk check failed:', error);
    throw error;
  }
}

/**
 * Example 7: View identity logs
 */
async function viewIdentityLogs(accountId: string) {
  console.log('\n=== Example 7: Identity Logs ===');

  try {
    // Get last 10 logs for this account
    const logs = identityLogger.getLogsForAccount(accountId, 10);

    console.log(`Found ${logs.length} log entries for account ${accountId}`);

    logs.forEach((log: IdentityLogEntry) => {
      const icon = log.level === 'info' ? 'ℹ️' : log.level === 'warn' ? '⚠️' : '❌';
      console.log(`${icon} [${log.eventType}] ${log.message}`);
      if (log.metadata) {
        console.log(`   ${JSON.stringify(log.metadata)}`);
      }
    });

    // Get error logs only
    const errorLogs = identityLogger.getLogsByLevel('error', 5);
    console.log(`\nRecent errors: ${errorLogs.length}`);

    return logs;
  } catch (error) {
    console.error('❌ Failed to get logs:', error);
    throw error;
  }
}

/**
 * Example 8: Complete workflow (Production-ready)
 */
async function completeWorkflow(accountId: string) {
  console.log('\n=== Example 8: Complete Workflow ===');
  console.log('This is how you should use Identity Manager in production\n');

  try {
    // Step 1: Prepare identity (validates everything)
    console.log('Step 1: Preparing identity...');
    const identityData = await executionGuard.prepareIdentityForExecution(accountId);

    if (!identityData.success) {
      console.error('⛔ BLOCKED:', identityData.error);
      return { success: false, reason: identityData.error };
    }

    console.log('✅ Identity prepared successfully');

    // Step 2: Use identity data for browser automation
    console.log('\nStep 2: Identity data ready for browser:');
    const { userAgent, proxy, cookies, timezone } = identityData.data!;

    console.log('  - User-Agent:', userAgent.substring(0, 50) + '...');
    console.log('  - Timezone:', timezone);
    console.log('  - Proxy:', proxy ? `${proxy.host}:${proxy.port}` : 'None');
    console.log('  - Cookies:', cookies ? 'Loaded' : 'None');

    // Step 3: Log proxy usage (if using proxy)
    if (proxy) {
      console.log('\nStep 3: Logging proxy usage...');
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      const account = await prisma.account.findUnique({ where: { id: accountId } });
      if (account?.proxyId) {
        await identityService.logProxyUsage(accountId, account.proxyId, '1.2.3.4');
        console.log('✅ Proxy usage logged');
      }
    }

    // Step 4: Execute automation (placeholder)
    console.log('\nStep 4: Ready to execute automation');
    console.log('  📌 Launch browser with identity data');
    console.log('  📌 Perform actions');
    console.log('  📌 Close browser');

    return { success: true, data: identityData.data };
  } catch (error) {
    console.error('❌ Workflow failed:', error);
    return { success: false, reason: `Error: ${error}` };
  }
}

/**
 * Main execution
 */
async function main() {
  // Replace with actual account ID from your database
  const TEST_ACCOUNT_ID = 'cm9abc123xyz';

  console.log('╔════════════════════════════════════════════╗');
  console.log('║   Identity Manager - Usage Examples       ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Example 1: Initialize
    await initializeAccountIdentity(TEST_ACCOUNT_ID);

    // Example 2: Validate
    await validateBeforeExecution(TEST_ACCOUNT_ID);

    // Example 3: Rule checks
    await checkRules(TEST_ACCOUNT_ID);

    // Example 4: Execution guard
    await safeExecutionCheck(TEST_ACCOUNT_ID);

    // Example 5: Prepare for browser
    await prepareForBrowserAutomation(TEST_ACCOUNT_ID);

    // Example 6: Risk score
    await checkRiskScore(TEST_ACCOUNT_ID);

    // Example 7: View logs
    await viewIdentityLogs(TEST_ACCOUNT_ID);

    // Example 8: Complete workflow (THIS IS WHAT YOU SHOULD USE)
    await completeWorkflow(TEST_ACCOUNT_ID);

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('\n❌ Examples failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => {
      console.log('\n✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Error:', error);
      process.exit(1);
    });
}

export {
  initializeAccountIdentity,
  validateBeforeExecution,
  checkRules,
  safeExecutionCheck,
  prepareForBrowserAutomation,
  checkRiskScore,
  viewIdentityLogs,
  completeWorkflow,
};
