import type Bull from 'bull';
import type { JobStatus } from '~/interface/Jobs';

export interface IJobsService {
  jobsQueue: Bull.Queue;
  toggleQueue(): Promise<void>;
  add(name: string, data: any): Promise<Bull.Job<any>>;
  jobStatus(jobId: string): Promise<JobStatus>;
  jobList(): Promise<Bull.Job<any>[]>;
  resumeQueue(): Promise<void>;
  pauseQueue(): Promise<void>;
}
