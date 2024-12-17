import { Injectable } from '@nestjs/common';
import debug from 'debug';
import type {
  CreateSnapshotJobData,
  RestoreSnapshotJobData,
} from '~/interface/Jobs';
import type { Job } from 'bull';
import { JobTypes } from '~/interface/Jobs';
import { Base, Source } from '~/models';
import Snapshot from '~/models/Snapshot';
import { DuplicateProcessor } from '~/modules/jobs/jobs/export-import/duplicate.processor';

@Injectable()
export class SnapshotProcessor {
  private readonly debugLog = debug('nc:jobs:snapshot');

  constructor(private readonly duplicateProcessorService: DuplicateProcessor) {}

  async createSnapshot(job: Job<CreateSnapshotJobData>) {
    this.debugLog(`Job started for ${job.id} (${JobTypes.CreateSnapshot})`);

    const { context, snapshot, snapshotBaseId, sourceId, req } = job.data;

    const baseId = context.base_id;

    const base = await Base.get(context, baseId);
    const snapshotBase = await Base.get(context, snapshotBaseId);
    const source = await Source.get(context, sourceId);

    try {
      await this.duplicateProcessorService.duplicateBaseJob({
        sourceBase: base,
        targetBase: snapshotBase,
        dataSource: source,
        req,
        context,
        options: {},
        operation: JobTypes.CreateSnapshot,
      });

      await Snapshot.update(context, snapshot.id, {
        status: 'success',
      });
    } catch (err) {
      await Snapshot.delete(context, snapshot.id);
      throw err;
    }

    this.debugLog(`job completed for ${job.id} (${JobTypes.CreateSnapshot})`);
    return { id: snapshotBase.id };
  }

  async restoreSnapshot(job: Job<RestoreSnapshotJobData>) {
    this.debugLog(`Job started for ${job.id} (${JobTypes.RestoreSnapshot})`);

    const { context, targetBaseId, req, targetContext } = job.data;

    const baseId = context.base_id;

    const sourceBase = await Base.get(context, baseId);

    await sourceBase.getSources(true);

    const targetBase = await Base.get(context, targetBaseId);

    const source = await Source.get(context, sourceBase.sources[0].id);

    await this.duplicateProcessorService.duplicateBaseJob({
      sourceBase,
      targetBase,
      dataSource: source,
      req,
      context,
      options: {},
      operation: JobTypes.RestoreSnapshot,
      targetContext,
    });

    this.debugLog(`job completed for ${job.id} (${JobTypes.RestoreSnapshot})`);
    return { id: targetBaseId };
  }
}
