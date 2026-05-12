import { Injectable } from '@nestjs/common';
import { ViewTypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Model, View } from '~/models';
import TimelineRange from '~/models/TimelineRange';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';

/**
 * Backend equivalent of calendar-datas.service for timeline views. The
 * windowed-fetch flow on the frontend was hitting the generic
 * dbViewRow.list endpoint, which honors the deployment-level
 * NC_DB_QUERY_LIMIT_MAX env var (default 1000, lowered to 100 on shared
 * cloud builds). That clamped our 400-record cap down to 100 silently
 * and made dense windows look ~75% emptier than they should.
 *
 * This service mirrors calendar's pattern: the frontend passes
 * `from_date`/`to_date` as first-class query params, the server builds
 * the bar-overlap predicate (avoids the `blank`-in-OR filter parser bug
 * since the predicate is constructed in code, not parsed from JSON),
 * and `limitOverride: TIMELINE_RECORD_LIMIT` bypasses the env clamp.
 */

// Hard server-side cap on records returned per windowed fetch. Mirrors
// the frontend's TIMELINE_RECORD_LIMIT — keep them in sync.
const TIMELINE_RECORD_LIMIT = 400;

// Maximum window the server will accept. Largest legitimate buffer is
// the 5-year zoom (bufferDays = 1825 × 2 = 3650 days). Allow some
// headroom for off-by-one and timezone padding.
const TIMELINE_MAX_WINDOW_DAYS = 4000;

@Injectable()
export class TimelineDatasService {
  constructor(protected datasService: DatasService) {}

  async getTimelineDataList(
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

    if (
      dayjs(to_date).diff(dayjs(from_date), 'days') > TIMELINE_MAX_WINDOW_DAYS
    ) {
      NcError.get(context).badRequest(
        `Date range should not exceed ${TIMELINE_MAX_WINDOW_DAYS} days`,
      );
    }

    const view = await View.get(context, viewId);
    if (!view) NcError.get(context).viewNotFound(viewId);

    if (view.type !== ViewTypes.TIMELINE) {
      NcError.get(context).badRequest('View is not a timeline view');
    }

    const timelineRange = await TimelineRange.read(context, view.id);
    if (!timelineRange?.ranges?.length) {
      NcError.get(context).badRequest('No ranges found');
    }

    const overlapFilter = this.buildOverlapFilter(
      timelineRange.ranges,
      from_date,
      to_date,
    );

    // Combine the server-built overlap predicate with any user-supplied
    // filters. Both sit at the top level, so the standard filter parser
    // ANDs them together.
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
      // Hard cap regardless of the deployment's NC_DB_QUERY_LIMIT_MAX.
      // The frontend's `limit=400` URL parameter is overridden here.
      limitOverride: TIMELINE_RECORD_LIMIT,
    });
  }

  async getPublicTimelineDataList(
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
    if (view.type !== ViewTypes.TIMELINE) {
      NcError.get(context).notFound('View is not a timeline view');
    }

    if (!(await View.verifyPassword(view, password))) {
      return NcError.get(context).invalidSharedViewPassword();
    }

    return this.getTimelineDataList(context, {
      viewId: view.id,
      query,
      from_date: param.from_date,
      to_date: param.to_date,
    });
  }

  /**
   * Build the bar-overlap predicate for the requested window. Range with
   * both from + to columns: strict overlap `from <= to_date AND to >=
   * from_date`. Range with only a from column (single-day events): `from
   * in [from_date, to_date]`.
   *
   * Null-end / null-start fallbacks aren't included here — the existing
   * filter parser drops the entire OR group to zero results when any
   * `blank` op is a sibling of date predicates. Records with one of the
   * two range columns null won't appear in the window until that bug is
   * fixed; same trade-off as the frontend version.
   */
  private buildOverlapFilter(
    ranges: Array<Partial<TimelineRange>>,
    from_date: string,
    to_date: string,
  ): Array<FilterType> {
    const root: FilterType = {
      is_group: true,
      logical_op: 'and',
      children: [],
    };

    ranges.forEach((range) => {
      const fromColumn = range.fk_from_column_id;
      const toColumn = range.fk_to_column_id;

      if (fromColumn && toColumn) {
        root.children.push([
          {
            fk_column_id: fromColumn,
            comparison_op: 'lte',
            comparison_sub_op: 'exactDate',
            value: to_date,
          },
          {
            fk_column_id: toColumn,
            comparison_op: 'gte',
            comparison_sub_op: 'exactDate',
            value: from_date,
          },
        ] as any);
      } else if (fromColumn) {
        root.children.push([
          {
            fk_column_id: fromColumn,
            comparison_op: 'gte',
            comparison_sub_op: 'exactDate',
            value: from_date,
          },
          {
            fk_column_id: fromColumn,
            comparison_op: 'lte',
            comparison_sub_op: 'exactDate',
            value: to_date,
          },
        ] as any);
      }
    });

    return [root];
  }
}
