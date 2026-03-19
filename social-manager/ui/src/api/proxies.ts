import { api } from './client';
import type { Proxy, CreateProxyPayload } from '../types';

export const proxiesApi = {
  getAll: () => api.get<Proxy[]>('/proxies'),

  create: (data: CreateProxyPayload) => api.post<Proxy>('/proxies', data),
};
