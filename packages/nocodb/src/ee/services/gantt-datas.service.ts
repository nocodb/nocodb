import { Injectable } from '@nestjs/common';
import { ViewTypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { DateDependency, Model, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';

/**
 * Gantt counterpart of timeline-datas.service. The previous Gantt fetch was
 * a single naive `dbViewRow.list` capped at limit=400 — but cloud's
 * NC_DB_QUERY_LIMIT_MAX silently clamps that to 100, leaving most boards
 * looking nearly empty. This service mirrors timeline-datas:
 *
 * - Frontend passes `from_date`/`to_date` (the current buffer window).
 * - We build the bar-overlap predicate from the view's DateDependency rule
 *   (view-owned first, table-level fallback) and AND it with the user's
 *   filters.
 * - `limitOverride: GANTT_RECORD_LIMIT` bypasses the env clamp so dense
 *   windows return the full 400 rows.
 *
 * As the user scrolls / zooms the buffer slides and the frontend re-fetches
 * the new window. Effectively unbounded across a session at the cost of one
 * round-trip per pan.
 */

// Hard server-side cap on records returned per windowed fetch. Mirrors the
// frontend cap — keep them in sync.
const GANTT_RECORD_LIMIT = 400;

// Largest legitimate buffer is the 5-year zoom (bufferDays = 1825 × 2 =
// 3650 days). Allow some headroom for off-by-one and timezone padding.
const GANTT_MAX_WINDOW_DAYS = 4000;

@Injectable()
export class GanttDatasService {
  constructor(protected datasService: DatasService) {}

  async getGanttDataList(
    context: NcContext,
    param: {
      viewId: string;
      query: any;
      from_date: string;
      to_date: string;
    },
  ) {
    const { viewId, query, from_date, to_date } = param;

    if (!from_date || !to_date) {
      NcError.get(context).badRequest('from_date and to_date are required');
    }

    if (dayjs(to_date).diff(dayjs(from_date), 'days') > GANTT_MAX_WINDOW_DAYS) {
      NcError.get(context).badRequest(
        `Date range should not exceed ${GANTT_MAX_WINDOW_DAYS} days`,
      );
    }

    const view = await View.get(context, viewId);
    if (!view) NcError.get(context).viewNotFound(viewId);

    if (view.type !== ViewTypes.GANTT) {
      NcError.get(context).badRequest('View is not a gantt view');
    }

    // View-owned rule takes precedence over the table-level default. Two
    // Gantt views on the same table can carry independent schedules.
    const rule =
      (await DateDependency.getByGanttViewId(context, view.id)) ??
      (await DateDependency.getByModelId(context, view.fk_model_id));

    if (!rule || rule.is_active === false) {
      NcError.get(context).badRequest('No active date dependency rule found');
    }

    const overlapFilter = this.buildOverlapFilter(rule, from_date, to_date);

    // Combine the server-built overlap predicate with any user-supplied
    // filters. Both sit at the top level so the parser ANDs them together.
    query.filterArrJson = JSON.stringify([
      ...overlapFilter,
      ...(query.filterArrJson ? JSON.parse(query.filterArrJson) : []),
    ]);

    const model = await Model.getByIdOrName(context, {
      id: view.fk_model_id,
    });

    return await this.datasService.dataList(context, {
      ...param,
      ...query,
      viewName: view.id,
      baseName: model.base_id,
      tableName: model.id,
      // Hard cap regardless of NC_DB_QUERY_LIMIT_MAX. The frontend's
      // `limit=400` URL param is overridden here.
      limitOverride: GANTT_RECORD_LIMIT,
    });
  }

  async getPublicGanttDataList(
    context: NcContext,
    param: {
      password: string;
      query: any;
      sharedViewUuid: string;
      from_date: string;
      to_date: string;
    },
  ) {
    const { sharedViewUuid, password, query = {} } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.get(context).viewNotFound(sharedViewUuid);
    if (view.type !== ViewTypes.GANTT) {
      NcError.get(context).notFound('View is not a gantt view');
    }

    if (!(await View.verifyPassword(view, password))) {
      return NcError.get(context).invalidSharedViewPassword();
    }

    return this.getGanttDataList(context, {
      viewId: view.id,
      query,
      from_date: param.from_date,
      to_date: param.to_date,
    });
  }

  /**
   * Build the bar-overlap predicate for the requested window. With both
   * start + end columns: strict overlap `start <= to_date AND end >=
   * from_date`. With only a start column (zero-duration milestones): `start
   * in [from_date, to_date]`.
   *
   * Same trade-off as Timeline: records with one of the range columns null
   * won't appear in the window — the existing filter parser drops the
   * entire OR group to zero results when a `blank` op sits alongside date
   * predicates.
   */
  private buildOverlapFilter(
    rule: DateDependency,
    from_date: string,
    to_date: string,
  ): Array<FilterType> {
    const root: FilterType = {
      is_group: true,
      logical_op: 'and',
      children: [],
    };

    const startCol = rule.fk_start_date_field_id;
    const endCol = rule.fk_end_date_field_id;

    if (startCol && endCol) {
      root.children.push([
        {
          fk_column_id: startCol,
          comparison_op: 'lte',
          comparison_sub_op: 'exactDate',
          value: to_date,
        },
        {
          fk_column_id: endCol,
          comparison_op: 'gte',
          comparison_sub_op: 'exactDate',
          value: from_date,
        },
      ] as any);
    } else if (startCol) {
      root.children.push([
        {
          fk_column_id: startCol,
          comparison_op: 'gte',
          comparison_sub_op: 'exactDate',
          value: from_date,
        },
        {
          fk_column_id: startCol,
          comparison_op: 'lte',
          comparison_sub_op: 'exactDate',
          value: to_date,
        },
      ] as any);
    }

    return [root];
  }
}
