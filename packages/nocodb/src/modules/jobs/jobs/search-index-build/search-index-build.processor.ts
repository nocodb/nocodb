import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import type {
  SearchIndexBuildJobData,
  SearchIndexFieldSyncJobData,
  SearchIndexFlushJobData,
} from '~/interface/Jobs';
import {
  runSearchIndexBuildJob,
  runSearchIndexFieldSyncJob,
  runSearchIndexReconcileJob,
} from '~/db/search/searchIndexSync';
import { searchIndexQueue } from '~/db/search/searchIndexQueue';

@Injectable()
export class SearchIndexBuildProcessor {
  async job(job: Job<SearchIndexBuildJobData>) {
    // Only a Bull job has a queue. The in-process queue runs few jobs at once,
    // and a backfill would hold one of them for its whole run for nothing.
    await runSearchIndexBuildJob(job.data, { wait: !!job.queue });
  }

  async flush(job: Job<SearchIndexFlushJobData>) {
    await searchIndexQueue.runJob(job.data);
  }

  async fieldSync(job: Job<SearchIndexFieldSyncJobData>) {
    await runSearchIndexFieldSyncJob(job.data);
  }

  async reconcile() {
    await runSearchIndexReconcileJob();
  }
}
