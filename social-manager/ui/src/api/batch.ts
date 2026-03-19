import { api } from './client';
import type { BatchActionPayload, BatchAllPayload, BatchResult } from '../types';

export const batchApi = {
  execute: (data: BatchActionPayload) => api.post<BatchResult>('/batch', data),

  executeAll: (data: BatchAllPayload) => api.post<BatchResult>('/batch/all', data),
};
