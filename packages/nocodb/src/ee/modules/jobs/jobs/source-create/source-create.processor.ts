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
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

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

    if (workspace.plan !== WorkspacePlan.BUSINESS) {
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

    if (process.env.NC_TEST_EE !== 'true') {
      if (needUpgrade) {
        logBasic(' ');
        logBasic(
          '***************************************************************************',
        );
        logBasic(
          '🌟 Setting up a dedicated instance for your first datasource.',
        );
        logBasic(
          '⏳ This may take 3-5 minutes, so perfect time to grab a cup of coffee and we would be all set.',
        );
        logBasic('Thank you for your patience 🙏');
        logBasic(
          'For next data sources in your workspace this will be instant.',
        );
        logBasic(
          '***************************************************************************',
        );
        logBasic(' ');

        await NcConnectionMgrv2.deleteAwait(createdBase);

        await this.workspacesService.upgrade({
          workspaceId,
          user,
        });
      }
    } else {
      needUpgrade = false;
    }

    this.debugLog(`job completed for ${job.id}`);

    return {
      base: createdBase,
      needUpgrade,
    };
  }
}
