import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType, SqlUiFactory } from 'nocodb-sdk';
import type { NcContext, UITypes } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Source, View } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { FiltersService } from '~/services/filters.service';

/**
 * When a column changes type, every filter that targets the column may have
 * an operator that no longer makes sense for the new type (e.g. `>=` on a
 * column that just became a checkbox). `FiltersService.transformFiltersForColumnTypeChange`
 * walks them and rewrites or drops as appropriate.
 *
 * Errors are logged and swallowed — same behaviour as the inline call in
 * `columns.service.columnUpdate`. A botched filter rewrite shouldn't abort
 * the column update that already committed.
 */
@Injectable()
export class ColumnUpdateFilterOperatorDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateFilterOperatorDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_UPDATED];

  constructor(private readonly filtersService: FiltersService) {}

  async getAffectedDependency(
    _context: NcContext,
    param: MetaDependencyEventRequest,
    _ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return undefined;

    if (oldCol.uidt === newCol.uidt) return undefined;
    return {};
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const oldCol = param.oldEntity;
    const newCol = param.newEntity;
    if (!oldCol?.id || !newCol?.id) return;

    // Snapshot view IDs whose filters may be rewritten so we can broadcast.
    const affectedViewIds = new Set<string>(
      (
        await ncMeta.metaList2(
          context.workspace_id,
          context.base_id,
          MetaTable.FILTER_EXP,
          { condition: { fk_column_id: oldCol.id } },
        )
      )
        .map((f: any) => f.fk_view_id)
        .filter(Boolean),
    );

    try {
      const source = await Source.get(context, oldCol.source_id, false, ncMeta);
      const sqlUi = source
        ? SqlUiFactory.create(await source.getConnectionConfig())
        : null;

      await this.filtersService.transformFiltersForColumnTypeChange(
        context,
        {
          columnId: oldCol.id,
          newColumnType: newCol.uidt as UITypes,
          oldColumnType: oldCol.uidt as UITypes,
          sqlUi,
        },
        ncMeta,
      );
    } catch (error) {
      this.logger.error(
        `Failed to transform filters for column type change: ${error.message}`,
        error.stack,
      );
    }

    this.broadcastViewUpdates(context, affectedViewIds).catch((e) =>
      this.logger.error(
        `Failed to broadcast view_update events: ${e?.message}`,
        e?.stack,
      ),
    );
  }

  private async broadcastViewUpdates(
    context: NcContext,
    viewIds: Set<string>,
  ): Promise<void> {
    for (const viewId of viewIds) {
      const view = await View.get(context, viewId, false, Noco.ncMeta);
      if (!view) continue;
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.META_EVENT,
          payload: { action: 'view_update', payload: view },
        },
        context.socket_id,
      );
    }
  }
}
