import prisma from '../lib/prisma';
import { CookieStatus } from '@prisma/client';

export interface SessionValidation {
  isValid: boolean;
  reason?: string;
}

export interface SessionInfo {
  status: CookieStatus | 'NO_SESSION';
  lastValidatedAt: Date | null;
  isValid: boolean;
}

/**
 * Session Service
 * Manages account session validation and lifecycle
 * Sessions remain valid until:
 * - Manually logged out
 * - Detected as invalid by Facebook (checkpoint, login redirect)
 */
class SessionService {
  /**
   * Validates if account session is still active
   * No duration-based expiry - sessions stay valid until marked otherwise
   */
  async validateSession(accountId: string): Promise<SessionValidation> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        cookieSessions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!account) {
      return { isValid: false, reason: 'Account not found' };
    }

    // No active cookie session = not logged in
    if (!account.cookieSessions || account.cookieSessions.length === 0) {
      return { isValid: false, reason: 'No session cookie' };
    }

    const session = account.cookieSessions[0];

    // Check status
    if (session.status === 'EXPIRED') {
      return { isValid: false, reason: 'Session expired' };
    }

    if (session.status === 'CHECKPOINT') {
      return { isValid: false, reason: 'Account checkpoint - manual verification needed' };
    }

    // Session is ACTIVE = valid
    return { isValid: true };
  }

  /**
   * Mark session as expired in database
   */
  async markSessionExpired(sessionId: string): Promise<void> {
    await prisma.cookieSession.update({
      where: { id: sessionId },
      data: { status: 'EXPIRED' }
    });
    console.log(`[SessionService] Marked session ${sessionId} as expired`);
  }

  /**
   * Mark all active sessions for an account as expired
   */
  async markAccountSessionsExpired(accountId: string): Promise<void> {
    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: 'ACTIVE'
      },
      data: { status: 'EXPIRED' }
    });
    console.log(`[SessionService] Marked all sessions for account ${accountId} as expired`);
  }

  /**
   * Update account with new session from login
   */
  async updateSessionFromLogin(
    accountId: string,
    cookieString: string
  ): Promise<SessionInfo> {
    const account = await prisma.account.findUnique({
      where: { id: accountId }
    });

    if (!account) {
      throw new Error('Account not found');
    }

    const now = new Date();

    // Expire any existing active sessions
    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: 'ACTIVE'
      },
      data: {
        status: 'EXPIRED'
      }
    });

    // Create new cookie session
    await prisma.cookieSession.create({
      data: {
        accountId,
        cookies: { sessionCookie: cookieString },
        status: 'ACTIVE',
        lastValidatedAt: now
      }
    });

    console.log(`[SessionService] Session updated for account ${accountId}`);

    return {
      status: 'ACTIVE',
      lastValidatedAt: now,
      isValid: true
    };
  }

  /**
   * Clear session (logout)
   */
  async clearSession(accountId: string): Promise<void> {
    // Mark all active sessions as expired
    await prisma.cookieSession.updateMany({
      where: {
        accountId,
        status: 'ACTIVE'
      },
      data: {
        status: 'EXPIRED'
      }
    });
    console.log(`[SessionService] Cleared session for account ${accountId}`);
  }

  /**
   * Get session info for account
   */
  async getSessionInfo(accountId: string): Promise<SessionInfo> {
    const account = await prisma.account.findUnique({
      where: { id: accountId },
      include: {
        cookieSessions: {
          where: { status: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!account) {
      throw new Error('Account not found');
    }

    if (!account.cookieSessions || account.cookieSessions.length === 0) {
      return {
        status: 'NO_SESSION',
        lastValidatedAt: null,
        isValid: false
      };
    }

    const session = account.cookieSessions[0];
    const validation = await this.validateSession(accountId);

    return {
      status: session.status,
      lastValidatedAt: session.lastValidatedAt,
      isValid: validation.isValid
    };
  }
}

export default new SessionService();
