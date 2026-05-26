import { Injectable, Logger } from '@nestjs/common';
import { MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { TableSync, TableSyncMapping } from '~/models';
import { NocoJobsService } from '~/services/noco-jobs.service';
import { scheduleReactiveResync } from '~/services/meta-dependency/handler/table-sync-handler.helpers';

/** Filter changes on a sync's source view bump no rows' `LastModifiedTime`,
 *  so the incremental cursor path can't catch them — only a full-fetch +
 *  tombstone sweep can. Debounced via the shared resync helper so a
 *  flurry of filter edits coalesces into one job (also dedupes against
 *  concurrent column-add / column-change reactions).
 *
 *  Error isolation: handler returns immediately; work runs detached in a
 *  `void doWork().catch(log)` so a failure here never propagates back to
 *  the source-side filter operation that triggered us. */
@Injectable()
export class FilterChangeTableSyncHandler implements MetaEventHandler {
  private logger = new Logger(FilterChangeTableSyncHandler.name);

  triggerMetaEvents: MetaEventType[] = [
    MetaEventType.FILTER_CREATED,
    MetaEventType.FILTER_UPDATED,
    MetaEventType.FILTER_DELETED,
  ];

  constructor(protected readonly nocoJobsService: NocoJobsService) {}

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<AffectedDependencyResult | undefined> {
    const filter = param.newEntity ?? param.oldEntity;
    const viewId = filter?.fk_view_id;
    if (!viewId) return undefined;

    const mappings = await TableSyncMapping.listBySourceView(
      context.workspace_id,
      context.base_id,
      viewId,
    );
    if (!mappings.length) return undefined;

    return { filters: [filter] };
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
  ): Promise<void> {
    void this.doWork(context, param).catch((e) => {
      this.logger.error(
        `filter → table-sync reaction failed: ${(e as Error).message}`,
        (e as Error).stack,
      );
    });
  }

  private async doWork(
    context: NcContext,
    param: MetaDependencyEventRequest,
  ): Promise<void> {
    const filter = param.newEntity ?? param.oldEntity;
    const viewId = filter?.fk_view_id;
    if (!viewId) return;

    const mappings = await TableSyncMapping.listBySourceView(
      context.workspace_id,
      context.base_id,
      viewId,
    );
    if (!mappings.length) return;

    const seen = new Set<string>();
    for (const mapping of mappings) {
      if (seen.has(mapping.fk_table_sync_id)) continue;
      seen.add(mapping.fk_table_sync_id);

      const destContext: NcContext = {
        workspace_id: mapping.fk_workspace_id,
        base_id: mapping.dest_base_id,
      };

      const sync = await TableSync.get(destContext, mapping.fk_table_sync_id);
      if (!sync) continue;

      await scheduleReactiveResync(
        this.nocoJobsService,
        destContext,
        sync,
      ).catch((e) => {
        this.logger.warn(
          `filter-resync enqueue failed for sync=${sync.id}: ${
            (e as Error).message
          }`,
        );
      });
    }
  }
}
