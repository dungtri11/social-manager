import { RiskEventType, RiskSeverity } from '@prisma/client';

export enum IdentityEventType {
  IDENTITY_CREATED = 'IDENTITY_CREATED',
  IDENTITY_UPDATED = 'IDENTITY_UPDATED',
  IDENTITY_VALIDATED = 'IDENTITY_VALIDATED',
  COOKIE_STORED = 'COOKIE_STORED',
  COOKIE_EXPIRED = 'COOKIE_EXPIRED',
  COOKIE_CHECKPOINT = 'COOKIE_CHECKPOINT',
  PROXY_USAGE_LOGGED = 'PROXY_USAGE_LOGGED',
  RULE_VIOLATION = 'RULE_VIOLATION',
  EXECUTION_BLOCKED = 'EXECUTION_BLOCKED',
  EXECUTION_ALLOWED = 'EXECUTION_ALLOWED',
}

export interface IdentityLogEntry {
  timestamp: string;
  accountId: string;
  eventType: IdentityEventType;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: any;
}

class IdentityLogger {
  private logs: IdentityLogEntry[] = [];
  private maxLogs: number = 1000;

  /**
   * Log identity event
   */
  log(
    accountId: string,
    eventType: IdentityEventType,
    level: 'info' | 'warn' | 'error',
    message: string,
    metadata?: any
  ): void {
    const logEntry: IdentityLogEntry = {
      timestamp: new Date().toISOString(),
      accountId,
      eventType,
      level,
      message,
      metadata,
    };

    // Add to in-memory logs
    this.logs.push(logEntry);

    // Trim if exceeds max
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console log
    const prefix = `[IdentityLogger][${eventType}][${accountId}]`;
    switch (level) {
      case 'info':
        console.log(prefix, message, metadata || '');
        break;
      case 'warn':
        console.warn(prefix, message, metadata || '');
        break;
      case 'error':
        console.error(prefix, message, metadata || '');
        break;
    }
  }

  /**
   * Log identity creation
   */
  logIdentityCreated(accountId: string, metadata?: any): void {
    this.log(
      accountId,
      IdentityEventType.IDENTITY_CREATED,
      'info',
      'Identity profile created',
      metadata
    );
  }

  /**
   * Log identity update
   */
  logIdentityUpdated(accountId: string, metadata?: any): void {
    this.log(
      accountId,
      IdentityEventType.IDENTITY_UPDATED,
      'info',
      'Identity profile updated',
      metadata
    );
  }

  /**
   * Log identity validation
   */
  logIdentityValidated(accountId: string, status: string, reasons: string[]): void {
    const level = status === 'VALID' ? 'info' : status === 'RISKY' ? 'warn' : 'error';
    this.log(
      accountId,
      IdentityEventType.IDENTITY_VALIDATED,
      level,
      `Identity validation: ${status}`,
      { reasons }
    );
  }

  /**
   * Log cookie stored
   */
  logCookieStored(accountId: string): void {
    this.log(
      accountId,
      IdentityEventType.COOKIE_STORED,
      'info',
      'Cookie session stored'
    );
  }

  /**
   * Log cookie expired
   */
  logCookieExpired(accountId: string): void {
    this.log(
      accountId,
      IdentityEventType.COOKIE_EXPIRED,
      'warn',
      'Cookie session expired'
    );
  }

  /**
   * Log cookie checkpoint
   */
  logCookieCheckpoint(accountId: string): void {
    this.log(
      accountId,
      IdentityEventType.COOKIE_CHECKPOINT,
      'error',
      'Cookie session marked as checkpoint'
    );
  }

  /**
   * Log proxy usage
   */
  logProxyUsage(accountId: string, proxyId: string, ipAddress?: string): void {
    this.log(
      accountId,
      IdentityEventType.PROXY_USAGE_LOGGED,
      'info',
      'Proxy usage logged',
      { proxyId, ipAddress }
    );
  }

  /**
   * Log rule violation
   */
  logRuleViolation(
    accountId: string,
    rule: string,
    severity: RiskSeverity,
    message: string,
    shouldBlock: boolean
  ): void {
    const level = shouldBlock ? 'error' : 'warn';
    this.log(
      accountId,
      IdentityEventType.RULE_VIOLATION,
      level,
      `Rule violation: ${rule}`,
      { severity, message, shouldBlock }
    );
  }

  /**
   * Log execution blocked
   */
  logExecutionBlocked(accountId: string, reasons: string[]): void {
    this.log(
      accountId,
      IdentityEventType.EXECUTION_BLOCKED,
      'error',
      'Execution blocked due to rule violations',
      { reasons }
    );
  }

  /**
   * Log execution allowed
   */
  logExecutionAllowed(accountId: string): void {
    this.log(
      accountId,
      IdentityEventType.EXECUTION_ALLOWED,
      'info',
      'Execution allowed - all rules passed'
    );
  }

  /**
   * Get logs for specific account
   */
  getLogsForAccount(accountId: string, limit?: number): IdentityLogEntry[] {
    const accountLogs = this.logs.filter((log) => log.accountId === accountId);
    return limit ? accountLogs.slice(-limit) : accountLogs;
  }

  /**
   * Get all logs
   */
  getAllLogs(limit?: number): IdentityLogEntry[] {
    return limit ? this.logs.slice(-limit) : this.logs;
  }

  /**
   * Get logs by event type
   */
  getLogsByType(eventType: IdentityEventType, limit?: number): IdentityLogEntry[] {
    const filteredLogs = this.logs.filter((log) => log.eventType === eventType);
    return limit ? filteredLogs.slice(-limit) : filteredLogs;
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: 'info' | 'warn' | 'error', limit?: number): IdentityLogEntry[] {
    const filteredLogs = this.logs.filter((log) => log.level === level);
    return limit ? filteredLogs.slice(-limit) : filteredLogs;
  }

  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
    console.log('[IdentityLogger] Logs cleared');
  }

  /**
   * Export logs to JSON
   */
  exportLogsToJSON(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

export default new IdentityLogger();
