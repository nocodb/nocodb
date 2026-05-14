import { Injectable, Logger } from '@nestjs/common';
import { EventType, MetaEventType } from 'nocodb-sdk';
import type { NcContext } from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import { Filter, Sort } from '~/models';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';

/**
 * Sort + filter cleanup for a deleted column.
 *
 * Sweeps:
 *  - `nc_sorts` rows where `fk_column_id = colId`
 *  - `nc_filter_exp` rows where `fk_column_id = colId` OR `fk_value_col_id = colId`
 *  - filter-group children parented by this column (recursive cache-aware)
 *
 * Broadcasts `sort_delete` per removed sort and `filter_delete` per
 * removed filter (including the parent-column tree) so subscribers
 * can update without a full reload.
 */
@Injectable()
export class ColumnDeleteFilterDependencyHandler implements MetaEventHandler {
  private readonly logger = new Logger(
    ColumnDeleteFilterDependencyHandler.name,
  );

  triggerMetaEvents: MetaEventType[] = [MetaEventType.COLUMN_DELETED];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const id = param.oldEntity?.id;
    if (!id) return undefined;

    for (const table of [MetaTable.SORT, MetaTable.FILTER_EXP]) {
      const rows = await ncMeta.metaList2(
        context.workspace_id,
        context.base_id,
        table,
        { condition: { fk_column_id: id }, limit: 1 },
      );
      if (rows.length) return {};
    }
    return undefined;
  }

  async handle(
    context: NcContext,
    param: MetaDependencyEventRequest & {
      affectedDependencyResult: AffectedDependencyResult;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<void> {
    const id = param.oldEntity?.id;
    if (!id) return;

    const deletedSorts: any[] = [];
    const deletedFilters: any[] = [];

    for (const sort of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.SORT,
      { condition: { fk_column_id: id } },
    )) {
      await Sort.delete(context, sort.id, ncMeta);
      deletedSorts.push(sort);
    }

    for (const filter of await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: {
          _or: [{ fk_column_id: { eq: id } }, { fk_value_col_id: { eq: id } }],
        },
      },
    )) {
      await Filter.delete(context, filter.id, ncMeta);
      deletedFilters.push(filter);
    }

    // Snapshot only the ROOT filters parented by this column. The frontend
    // `filter_delete` handler cascades to descendants via
    // `deleteFilterGroupFromAllFilters` (matches by fk_parent_id), so
    // broadcasting nested children would just be redundant traffic.
    const parentColumnTree = await Filter.getFilterObject(
      context,
      { parentColId: id },
      ncMeta,
    );
    this.collectRoots(parentColumnTree as any, deletedFilters);

    await Filter.deleteAllByParentColumn(context, id, ncMeta);

    this.broadcastDeletes(context, deletedSorts, deletedFilters).catch((e) =>
      this.logger.error(
        `Failed to broadcast sort/filter delete events: ${e?.message}`,
        e?.stack,
      ),
    );
  }

  // `getFilterObject({ parentColId })` returns either a root filter or a
  // synthetic wrapper whose `children` are the real roots. Push only the
  // top-level real filters; descendants cascade on the frontend.
  private collectRoots(
    node: { id?: string; children?: any[] } | undefined,
    out: any[],
  ): void {
    if (!node) return;
    if (node.id) {
      out.push(node);
      return;
    }
    for (const child of node.children || []) {
      if (child?.id) out.push(child);
    }
  }

  private async broadcastDeletes(
    context: NcContext,
    sorts: any[],
    filters: any[],
  ): Promise<void> {
    for (const sort of sorts) {
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: { action: 'sort_delete', payload: sort },
      });
    }
    // Dedupe — a filter referencing this column AND parented under it
    // would otherwise be broadcast twice.
    const seen = new Set<string>();
    for (const filter of filters) {
      if (!filter.id || seen.has(filter.id)) continue;
      seen.add(filter.id);
      NocoSocket.broadcastEvent(context, {
        event: EventType.META_EVENT,
        payload: { action: 'filter_delete', payload: filter },
      });
    }
  }
}
