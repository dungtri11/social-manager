import { api } from './client';
import type { RiskScore, ActionStats, SafetyCheck, ActionLimits, ActionType } from '../types';

interface RiskScoreResponse {
  success: boolean;
  riskScore: RiskScore;
}

interface ActionStatsResponse {
  success: boolean;
  stats: ActionStats;
}

interface SafetyCheckResponse {
  success: boolean;
  safetyCheck: SafetyCheck;
}

interface LimitsResponse {
  success: boolean;
  limits: ActionLimits;
}

interface CooldownResponse {
  success: boolean;
  cooldownCheck: {
    shouldWait: boolean;
    reason?: string;
  };
  recommendedCooldown: {
    milliseconds: number;
    seconds: number;
    minutes: number;
  };
}

export const riskApi = {
  getScore: (accountId: string) =>
    api.get<RiskScoreResponse>(`/risk/score/${accountId}`),

  getStats: (accountId: string, period: 'hour' | 'day') =>
    api.get<ActionStatsResponse>(`/risk/stats/${accountId}?period=${period}`),

  check: (accountId: string, actionType: ActionType) =>
    api.post<SafetyCheckResponse>('/risk/check', { accountId, actionType }),

  getCooldown: (accountId: string) =>
    api.get<CooldownResponse>(`/risk/cooldown/${accountId}`),

  getLimits: () => api.get<LimitsResponse>('/risk/limits'),
};
