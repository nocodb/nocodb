import { Injectable } from '@nestjs/common';
import debug from 'debug';
import type {
  CreateSnapshotJobData,
  RestoreSnapshotJobData,
} from '~/interface/Jobs';
import type { Job } from 'bull';
import { JobTypes } from '~/interface/Jobs';
import { elapsedTime, initTime } from '~/modules/jobs/helpers';
import { Base, Source } from '~/models';
import { ExportService } from '~/modules/jobs/jobs/export-import/export.service';
import { ImportService } from '~/modules/jobs/jobs/export-import/import.service';
import { BasesService } from '~/services/bases.service';
import Snapshot from '~/models/Snapshot';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';

@Injectable()
export class SnapshotProcessor {
  private readonly debugLog = debug('nc:jobs:snapshot');

  constructor(
    private readonly duplicateProcessorService: DuplicateProcessor,
    private readonly exportService: ExportService,
    private readonly importService: ImportService,
    private readonly projectsService: BasesService,
  ) {}

  async createSnapshot(job: Job<CreateSnapshotJobData>) {
    this.debugLog(`Job started for ${job.id} (${JobTypes.CreateSnapshot})`);

    const hrTime = initTime();

    const { context, snapshot, snapshotBaseId, sourceId, req, user } = job.data;

    const baseId = context.base_id;

    const base = await Base.get(context, baseId);
    const snapshotBase = await Base.get(context, snapshotBaseId);
    const source = await Source.get(context, sourceId);

    const targetContext = {
      workspace_id: snapshotBase.fk_workspace_id,
      base_id: snapshotBase.id,
    };

    try {
      if (!base || !snapshotBase || !source) {
        throw new Error(`Base or source not found!`);
      }

      const user = (req as any).user;

      const models = (await source.getModels(context)).filter(
        // TODO revert this when issue with cache is fixed
        (m) => m.source_id === source.id && !m.mm && m.type === 'table',
      );

      const exportedModels = await this.exportService.serializeModels(context, {
        modelIds: models.map((m) => m.id),
      });

      elapsedTime(
        hrTime,
        `serialize models schema for ${source.base_id}::${source.id}`,
        'duplicateBase',
      );

      if (!exportedModels) {
        throw new Error(`Export failed for source '${source.id}'`);
      }

      await snapshotBase.getSources();

      const dupBase = snapshotBase.sources[0];

      const idMap = await this.importService.importModels(targetContext, {
        user,
        baseId: snapshotBase.id,
        sourceId: dupBase.id,
        data: exportedModels,
        req: req,
      });

      elapsedTime(hrTime, `import models schema`, 'duplicateBase');

      if (!idMap) {
        throw new Error(`Import failed for source '${source.id}'`);
      }

      await this.duplicateProcessorService.importModelsData(
        targetContext,
        context,
        {
          idMap,
          sourceProject: base,
          sourceModels: models,
          destProject: snapshotBase,
          destBase: dupBase,
          hrTime,
          req,
        },
      );

      await this.projectsService.baseUpdate(targetContext, {
        baseId: snapshotBase.id,
        base: {
          status: null,
        },
        user: req.user,
        req,
      });

      await Snapshot.update(context, snapshot.id, {
        status: 'success',
      });
    } catch (e) {
      if (snapshotBase?.id) {
        await this.projectsService.baseSoftDelete(targetContext, {
          baseId: snapshotBase.id,
          user: req.user,
          req,
        });

        await Snapshot.update(context, snapshot.id, {
          status: 'failed',
        });
      }
      throw e;
    }

    this.debugLog(`job completed for ${job.id} (${JobTypes.DuplicateBase})`);
    return { id: snapshotBase.id };
  }

  async restoreSnapshot(job: Job<RestoreSnapshotJobData>) {
    this.debugLog(`Job started for ${job.id} (${JobTypes.RestoreSnapshot})`);
    const hrTime = initTime();

    const { context, snapshot, targetBaseId, req, user } = job.data;

    const baseId = context.base_id;

    const sourceBase = await Base.get(context, baseId);

    await sourceBase.getSources(true)

    const targetBase = await Base.get(context, targetBaseId);

    const source = await Source.get(context, sourceBase.sources[0].id);

    const targetContext = {
      workspace_id: targetBase.fk_workspace_id,
      base_id: targetBase.id,
    };

    try {
      if (!sourceBase || !targetBase || !source) {
        throw new Error(`Base or source not found!`);
      }

      const user = (req as any).user;

      const models = (await source.getModels(context)).filter(
        // TODO revert this when issue with cache is fixed
        (m) => m.source_id === source.id && !m.mm && m.type === 'table',
      );

      const exportedModels = await this.exportService.serializeModels(context, {
        modelIds: models.map((m) => m.id),
      });

      elapsedTime(
        hrTime,
        `serialize models schema for ${source.base_id}::${source.id}`,
        'duplicateBase',
      );

      if (!exportedModels) {
        throw new Error(`Export failed for source '${source.id}'`);
      }

      await targetBase.getSources();

      const dupBase = targetBase.sources[0];

      const idMap = await this.importService.importModels(targetContext, {
        user,
        baseId: targetBase.id,
        sourceId: dupBase.id,
        data: exportedModels,
        req: req,
      });

      elapsedTime(hrTime, `import models schema`, 'duplicateBase');

      if (!idMap) {
        throw new Error(`Import failed for source '${source.id}'`);
      }

      await this.duplicateProcessorService.importModelsData(
        targetContext,
        context,
        {
          idMap,
          sourceProject: sourceBase,
          sourceModels: models,
          destProject: targetBase,
          destBase: dupBase,
          hrTime,
          req,
        },
      );

      await this.projectsService.baseUpdate(targetContext, {
        baseId: targetBase.id,
        base: {
          status: null,
        },
        user: req.user,
        req,
      });

      await Snapshot.update(context, snapshot.id, {
        status: 'success',
      });
    } catch (e) {
      if (targetBase?.id) {
        await this.projectsService.baseSoftDelete(targetContext, {
          baseId: targetBase.id,
          user: req.user,
          req,
        });
      }

      await Snapshot.update(context, snapshot.id, {
        status: 'failed',
      });
    }

    this.debugLog(`job completed for ${job.id} (${JobTypes.RestoreSnapshot})`);
    return { id: targetBaseId };
  }
}
