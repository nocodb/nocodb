import { Injectable } from '@nestjs/common';
import { QueueService as QueueServiceCE } from 'src/modules/jobs/fallback/fallback-queue.service';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';
import { AtImportProcessor } from '~/modules/jobs/jobs/at-import/at-import.processor';
import { MetaSyncProcessor } from '~/modules/jobs/jobs/meta-sync/meta-sync.processor';
import { SourceCreateProcessor } from '~/modules/jobs/jobs/source-create/source-create.processor';
import { SourceDeleteProcessor } from '~/modules/jobs/jobs/source-delete/source-delete.processor';
import { UpdateStatsProcessor } from '~/modules/jobs/jobs/update-stats/update-stats.processor';
import { JobsEventService } from '~/modules/jobs/fallback/jobs-event.service';
import { JobTypes } from '~/interface/Jobs';

export interface Job {
  id: string;
  name: string;
  status: string;
  data: any;
}

@Injectable()
export class QueueService extends QueueServiceCE {
  constructor(
    protected readonly jobsEventService: JobsEventService,
    protected readonly duplicateProcessor: DuplicateProcessor,
    protected readonly atImportProcessor: AtImportProcessor,
    protected readonly metaSyncProcessor: MetaSyncProcessor,
    protected readonly sourceCreateProcessor: SourceCreateProcessor,
    protected readonly sourceDeleteProcessor: SourceDeleteProcessor,
    protected readonly updateStatsProcessor: UpdateStatsProcessor,
  ) {
    super(
      jobsEventService,
      duplicateProcessor,
      atImportProcessor,
      metaSyncProcessor,
      sourceCreateProcessor,
      sourceDeleteProcessor,
    );
  }

  jobMap = {
    ...this.jobMap,
    [JobTypes.UpdateModelStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.updateModelStat,
    },
    [JobTypes.UpdateWsStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.updateWorkspaceStat,
    },
    [JobTypes.UpdateSrcStat]: {
      this: this.updateStatsProcessor,
      fn: this.updateStatsProcessor.UpdateSrcStat,
    },
  };
}
