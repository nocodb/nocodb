import debug from 'debug';
import { WorkspacePlan } from 'nocodb-sdk';
import { Injectable } from '@nestjs/common';
import type { Job } from 'bull';
import { SourcesService } from '~/services/sources.service';
import { JobsLogService } from '~/modules/jobs/jobs/jobs-log.service';
import { Base, Model, Workspace } from '~/models';
import { WorkspacesService } from '~/services/workspaces.service';
import { TelemetryService } from '~/services/telemetry.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class SourceCreateProcessor {
  private readonly debugLog = debug('nc:jobs:source-create');

  constructor(
    private readonly sourcesService: SourcesService,
    private readonly workspacesService: WorkspacesService,
    private readonly jobsLogService: JobsLogService,
    private readonly telemetryService: TelemetryService,
  ) {}

  async job(job: Job) {
    this.debugLog(`job started for ${job.id}`);

    const { context, source, user } = job.data;

    const workspaceId = context.workspace_id;
    const baseId = context.base_id;

    const workspace = await Workspace.get(workspaceId);

    const base = await Base.get(context, baseId);

    let needUpgrade = false;

    if (workspace.plan !== WorkspacePlan.BUSINESS) {
      needUpgrade = true;
    }

    const logBasic = (log) => {
      this.jobsLogService.sendLog(job, { message: log });
      this.debugLog(log);
    };

    const { source: createdSource, error } =
      await this.sourcesService.baseCreate(context, {
        baseId,
        source,
        logger: logBasic,
        req: {},
      });

    if (error) {
      await this.sourcesService.baseDelete(context, {
        sourceId: createdSource.id,
        req: {},
      });
      throw error;
    }

    if (createdSource.isMeta()) {
      delete createdSource.config;
    }

    logBasic('🚀 Your data source schema is loaded successfully!');

    if (process.env.TEST !== 'true') {
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

        await NcConnectionMgrv2.deleteAwait(createdSource);

        await this.workspacesService.upgrade({
          workspaceId,
          user,
        });
      }
    } else {
      needUpgrade = false;
    }

    const models = await Model.list(context, {
      base_id: baseId,
      source_id: createdSource.id,
    });

    const promises = [];

    for (const model of models) {
      promises.push(model.getColumns(context));
    }

    await Promise.all(promises);

    await this.telemetryService.sendSystemEvent({
      event_type: 'source_create',
      user: {
        id: user.id,
        email: user.email,
      },
      source,
      base,
      workspace,
      stats: {
        models: models.length,
        columns: models.reduce((acc, m) => acc + m.columns.length, 0),
      },
    });

    this.debugLog(`job completed for ${job.id}`);

    return {
      base: createdSource,
      needUpgrade,
    };
  }
}
