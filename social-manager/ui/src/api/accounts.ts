import { api } from './client';
import type { Account, CreateAccountPayload, SessionInfo } from '../types';

export const accountsApi = {
  getAll: () => api.get<Account[]>('/accounts'),

  create: (data: CreateAccountPayload) => api.post<Account>('/accounts', data),

  delete: (accountId: string) =>
    api.delete<{ success: boolean; message: string; account: Account }>(
      `/accounts/${accountId}`
    ),

  deleteExpired: () =>
    api.delete<{
      success: boolean;
      message: string;
      deletedCount: number;
      deletedAccounts: Account[]
    }>('/accounts/bulk/expired'),

  // Session management
  login: (accountId: string, sessionDuration?: number) =>
    api.post<{ success: boolean; sessionInfo: SessionInfo; message?: string }>(
      `/accounts/${accountId}/login`,
      { sessionDuration }
    ),

  logout: (accountId: string) =>
    api.post<{ success: boolean; message: string }>(
      `/accounts/${accountId}/logout`,
      {}
    ),

  getSessionStatus: (accountId: string) =>
    api.get<{ accountId: string; sessionInfo: SessionInfo }>(
      `/accounts/${accountId}/session-status`
    ),

  updateSessionDuration: (accountId: string, sessionDuration: number) =>
    api.patch<{ success: boolean; account: Account }>(
      `/accounts/${accountId}/session-duration`,
      { sessionDuration }
    ),
};
