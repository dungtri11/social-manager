import { api } from './client';

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

export const identityApi = {
  create: (accountId: string) =>
    api.post<{ success: boolean; data: IdentityBundle; message: string }>(
      `/identity/${accountId}/create`
    ),

  get: (accountId: string) =>
    api.get<{ success: boolean; data: IdentityBundle }>(
      `/identity/${accountId}`
    ),

  validate: (accountId: string) =>
    api.post<{ success: boolean; data: ValidationResult }>(
      `/identity/${accountId}/validate`
    ),

  checkRules: (accountId: string) =>
    api.get<{ success: boolean; data: RuleResult[] }>(
      `/identity/${accountId}/rules`
    ),

  getRisk: (accountId: string) =>
    api.get<{
      success: boolean;
      data: {
        riskScore: number;
        isSafe: boolean;
        recentEvents: RiskEvent[];
      };
    }>(`/identity/${accountId}/risk`),

  getEvents: (accountId: string, limit = 20) =>
    api.get<{ success: boolean; data: RiskEvent[] }>(
      `/identity/${accountId}/events?limit=${limit}`
    ),

  storeCookies: (accountId: string, cookies: any) =>
    api.post<{ success: boolean; message: string }>(
      `/identity/${accountId}/cookies`,
      { cookies }
    ),

  expireCookies: (accountId: string) =>
    api.post<{ success: boolean; message: string }>(
      `/identity/${accountId}/cookies/expire`,
      {}
    ),

  markCheckpoint: (accountId: string) =>
    api.post<{ success: boolean; message: string }>(
      `/identity/${accountId}/cookies/checkpoint`,
      {}
    ),

  checkExecution: (accountId: string) =>
    api.post<{ success: boolean; data: ExecutionGuardResult }>(
      `/identity/${accountId}/check-execution`,
      {}
    ),

  getLogs: (params?: { accountId?: string; type?: string; level?: string; limit?: number }) =>
    api.get<{ success: boolean; data: any[] }>(
      `/identity/logs${params ? '?' + new URLSearchParams(params as any).toString() : ''}`
    ),
};
