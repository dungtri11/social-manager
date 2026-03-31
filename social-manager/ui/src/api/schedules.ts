import { api } from './client';
import type { ScheduledAction, CreateSchedulePayload } from '../types';

export const schedulesApi = {
  getAll: (status?: string) => {
    const params = status ? `?status=${status}` : '';
    return api.get<ScheduledAction[]>(`/schedules${params}`);
  },

  getById: (id: string) => api.get<ScheduledAction>(`/schedules/${id}`),

  create: (data: CreateSchedulePayload) => api.post<ScheduledAction>('/schedules', data),

  update: (id: string, data: Partial<CreateSchedulePayload> & { status?: string }) =>
    api.put<ScheduledAction>(`/schedules/${id}`, data),

  remove: (id: string) => api.delete<{ success: boolean }>(`/schedules/${id}`),

  toggle: (id: string) => api.post<ScheduledAction>(`/schedules/${id}/toggle`, {}),
};
