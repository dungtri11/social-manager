// Session types
export const SessionStatus = {
  LOGGED_OUT: 'logged_out',
  LOGGED_IN: 'logged_in',
  EXPIRED: 'expired',
} as const;

export type SessionStatus = (typeof SessionStatus)[keyof typeof SessionStatus];

export interface SessionInfo {
  status: SessionStatus;
  expiresAt: string | null;
  lastLoginAt: string | null;
  timeRemaining: number | null;
  isValid: boolean;
}

// Account types
export interface Account {
  id: string;
  username: string;
  cookie: string | null;
  userAgent: string;
  proxyId: string | null;
  proxy?: Proxy | null;

  // Session fields
  sessionStatus: SessionStatus;
  cookieExpiry: string | null;
  lastLoginAt: string | null;
  sessionDuration: number;

  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountPayload {
  username: string;
  cookie?: string; // Optional now
  userAgent: string;
  proxyId?: string;
  sessionDuration?: number;
}

// Proxy types
export interface Proxy {
  id: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  createdAt: string;
}

export interface CreateProxyPayload {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

// Job types
export type ActionType = 'like' | 'comment' | 'share' | 'follow';
export type JobStatus = 'waiting' | 'active' | 'completed' | 'failed';

export interface JobProgress {
  step: string;
  progress: number;
}

export interface JobLog {
  logs: string[];
  count: number;
}

export interface Job {
  id: string;
  name: string;
  data: {
    accountId: string;
    actionType: ActionType;
    targetUrl: string;
    payload?: Record<string, unknown>;
  };
  timestamp: number;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  failedReason?: string;
  progress?: JobProgress;
  logs?: JobLog;
}

export interface JobDetail extends Job {
  logs: JobLog;
  returnvalue?: any;
}

export interface JobStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

export interface CreateJobPayload {
  accountId: string;
  actionType: ActionType;
  targetUrl: string;
  payload?: Record<string, unknown>;
}

// Batch types
export interface BatchActionPayload {
  accountIds: string[];
  actionType: ActionType;
  targetUrl: string;
  payload?: Record<string, unknown>;
  delayBetweenAccounts?: {
    min: number;
    max: number;
  };
  skipRiskCheck?: boolean;
}

export interface BatchAllPayload {
  actionType: ActionType;
  targetUrl: string;
  payload?: Record<string, unknown>;
  delayBetweenAccounts?: {
    min: number;
    max: number;
  };
  limit?: number;
}

export interface BatchResult {
  success: boolean;
  totalAccounts: number;
  jobsEnqueued: number;
  skipped: number;
  skippedAccounts: Array<{
    accountId: string;
    reason: string;
  }>;
  jobs: Array<{
    accountId: string;
    jobId: string;
    scheduledDelay: number;
  }>;
}

// Risk types
export interface RiskScore {
  accountId: string;
  score: number;
  level: 'low' | 'medium' | 'high' | 'critical';
  factors: {
    actionsPerHour: number;
    actionsPerDay: number;
    failureRate: number;
    recentFailures: number;
  };
  recommendations: string[];
}

export interface ActionStats {
  total: number;
  successful: number;
  failed: number;
  byType: Record<ActionType, number>;
}

export interface SafetyCheck {
  allowed: boolean;
  reason?: string;
  riskScore: RiskScore;
  cooldownRequired: boolean;
  cooldownSeconds?: number;
}

export interface ActionLimits {
  hourly: Record<ActionType, number>;
  daily: Record<ActionType, number>;
  riskThresholds: {
    warning: number;
    stop: number;
  };
}

// Identity Manager types
export interface IdentityProfile {
  id: string;
  accountId: string;
  userAgent: string;
  proxyId: string | null;
  timezone: string;
  fingerprintHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface IdentityBundle {
  profile: IdentityProfile;
  proxy: any | null;
  cookies: any | null;
}

export interface ValidationResult {
  status: 'VALID' | 'RISKY' | 'INVALID';
  issues: string[];
  warnings: string[];
}

export interface RuleResult {
  rule: string;
  passed: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  message: string;
}

export interface RiskEvent {
  id: string;
  accountId: string;
  type: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  metadata: any;
  createdAt: string;
}

export interface ExecutionGuardResult {
  allowed: boolean;
  reasons: string[];
  identity: any | null;
}
