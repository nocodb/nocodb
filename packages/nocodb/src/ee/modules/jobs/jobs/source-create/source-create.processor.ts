import debug from 'debug';
import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bull';
import { WorkspacePlan } from 'nocodb-sdk';
import { JOBS_QUEUE, JobTypes } from '~/interface/Jobs';
import { SourcesService } from '~/services/sources.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import getWorkspaceForBase from '~/utils/getWorkspaceForBase';
import { Workspace } from '~/models';
import { WorkspacesService } from '~/modules/workspaces/workspaces.service';

@Processor(JOBS_QUEUE)
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:jobs:source-create');

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly workspacesService: WorkspacesService,
    private readonly jobsLogService: JobsLogService,
  ) {}

  @Process(JobTypes.BaseCreate)
  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { baseId, source, user } = job.data;

    const workspaceId = await getWorkspaceForBase(baseId);

    const workspace = await Workspace.get(workspaceId);

    let needUpgrade = false;

    if (workspace.plan !== WorkspacePlan.BUSINESS_PRO) {
      needUpgrade = true;
    }

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const createdBase = await this.sourcesService.baseCreate({
      baseId,
      source,
      logger: logBasic,
    });

    if (createdBase.isMeta()) {
      delete createdBase.config;
    }

    logBasic('🚀 Your data source schema is loaded successfully!');

    if (needUpgrade) {
      logBasic(' ');
      logBasic('Upgrading workspace to Business Pro plan');
      logBasic('We are upgrading your infrastructure');
      logBasic(
        '⏳ Please wait 1-3 minutes as we set up an instance for you. Go grab a coffee!',
      );

      await this.workspacesService.upgrade({
        workspaceId,
        user,
      });
    }

    this.debugLog(`job completed for ${job.id}`);

    return {
      base: createdBase,
      needUpgrade,
    };
  }
}
