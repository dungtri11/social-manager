import { api } from './client';
import type { Job, JobDetail, JobStats, JobStatus, CreateJobPayload } from '../types';

interface JobsResponse {
  success: boolean;
  count: number;
  jobs: Job[];
}

interface JobStatsResponse {
  success: boolean;
  stats: JobStats;
}

interface JobDetailResponse {
  success: boolean;
  job: JobDetail;
}

interface CreateJobResponse {
  success: boolean;
  jobId: string;
  data: CreateJobPayload;
}

export const jobsApi = {
  getStats: () => api.get<JobStatsResponse>('/jobs/stats'),

  getByStatus: (status: JobStatus) => api.get<JobsResponse>(`/jobs/${status}`),

  getDetails: (jobId: string) => api.get<JobDetailResponse>(`/jobs/detail/${jobId}`),

  create: (data: CreateJobPayload) => api.post<CreateJobResponse>('/jobs', data),
};
