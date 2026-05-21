import { Injectable, Logger } from '@nestjs/common';
import { ViewTypes } from 'nocodb-sdk';
import dayjs from 'dayjs';
import type { FilterType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { LinkToAnotherRecordColumn } from '~/models';
import { Column, DateDependency, Model, Source, View } from '~/models';
import { NcError } from '~/helpers/catchError';
import { DatasService } from '~/services/datas.service';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

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
  protected logger = new Logger(GanttDatasService.name);

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

    // Either both date bounds or neither. Mixed-mode (one missing) is almost
    // always a frontend bug — fail loud rather than silently dropping half
    // the predicate. Absence of both means row-index pagination mode: list
    // rows by offset/limit + default chronological sort, bars off the
    // visible date window simply don't paint.
    if ((from_date && !to_date) || (!from_date && to_date)) {
      NcError.get(context).badRequest(
        'from_date and to_date must be provided together',
      );
    }

    if (
      from_date &&
      to_date &&
      dayjs(to_date).diff(dayjs(from_date), 'days') > GANTT_MAX_WINDOW_DAYS
    ) {
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

    // Bar-overlap predicate only applies when the caller passed a window.
    // Row-index pagination (no window) returns the full filtered set with
    // standard offset/limit; bars off the visible buffer just don't paint.
    if (from_date && to_date) {
      const overlapFilter = this.buildOverlapFilter(rule, from_date, to_date);

      // Combine the server-built overlap predicate with any user-supplied
      // filters. Both sit at the top level so the parser ANDs them together.
      query.filterArrJson = JSON.stringify([
        ...overlapFilter,
        ...(query.filterArrJson ? JSON.parse(query.filterArrJson) : []),
      ]);
    }

    // Default to chronological order when the caller didn't supply a sort.
    // Without this the list reads in insertion order, which makes vertical
    // scrolling feel random on a Gantt — top should be earliest, bottom
    // latest. Gantt has no user-configurable sort so this is the only
    // ordering signal we have.
    const existingSort = query.sortArrJson
      ? JSON.parse(query.sortArrJson)
      : [];
    if (!existingSort.length && rule.fk_start_date_field_id) {
      query.sortArrJson = JSON.stringify([
        {
          fk_column_id: rule.fk_start_date_field_id,
          direction: 'asc',
        },
      ]);
    }

    const model = await Model.getByIdOrName(context, {
      id: view.fk_model_id,
    });

    // Honor the caller's `limit` (for row-index pagination) but cap at
    // GANTT_RECORD_LIMIT to keep any single response bounded. `limitOverride`
    // also bypasses NC_DB_QUERY_LIMIT_MAX so cloud's 100-row clamp doesn't
    // silently truncate.
    const requestedLimit = Number.parseInt(query.limit, 10);
    const effectiveLimit =
      Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, GANTT_RECORD_LIMIT)
        : GANTT_RECORD_LIMIT;

    return await this.datasService.dataList(context, {
      ...param,
      ...query,
      viewName: view.id,
      baseName: model.base_id,
      tableName: model.id,
      limitOverride: effectiveLimit,
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

  /**
   * Return the full dependency-edge graph for a Gantt view.
   *
   * The dep field is validated to be a self-referencing HM/OM/OO LTAR
   * (date-dependency.service.ts). For those shapes the FK column lives on
   * the same table — each row's FK points to its parent. So the entire
   * graph is one SELECT: `(pk, fk_child)` for every row with a non-null
   * FK, with view filters and RLS applied via baseModel.
   *
   * This replaces two broken paths in `useGanttViewStore.loadDependencyLinks`:
   *
   *  - Authenticated: N+1 nestedList calls (one per formattedData row).
   *  - Public: row-payload elaboration that needed `linksAsLtar=true` AND
   *    api_version=V3 — the public endpoint runs at V1/V2 so the Links
   *    column came back as a count, not an array.
   *
   * Edges shape: `[childPk, parentPk]` — same direction the frontend's
   * `dependencyLinks` Map<parentId, childIds[]> expects after grouping.
   *
   * v1 limitations: assumes single-column PK (errors otherwise). Bounded
   * at GANTT_DEPS_LIMIT rows to avoid runaway queries on huge tables.
   */
  async getGanttDeps(
    context: NcContext,
    param: {
      viewId: string;
    },
  ) {
    const { viewId } = param;

    const view = await View.get(context, viewId);
    if (!view) NcError.get(context).viewNotFound(viewId);

    if (view.type !== ViewTypes.GANTT) {
      NcError.get(context).badRequest('View is not a gantt view');
    }

    const rule =
      (await DateDependency.getByGanttViewId(context, view.id)) ??
      (await DateDependency.getByModelId(context, view.fk_model_id));

    // No dep field configured (e.g. start-date-only Gantt) → empty graph.
    if (
      !rule ||
      rule.is_active === false ||
      !rule.fk_dependency_linkrow_field_id
    ) {
      return { edges: [] as Array<[string, string]> };
    }

    const depCol = await Column.get(context, {
      colId: rule.fk_dependency_linkrow_field_id,
    });
    if (!depCol) {
      return { edges: [] as Array<[string, string]> };
    }

    const colOpts = await depCol.getColOptions<LinkToAnotherRecordColumn>(
      context,
    );

    // Validation in date-dependency.service.ts already rejects non-self-ref
    // / wrong relation types — re-check defensively in case a rule predates
    // that validation or a field's relation shape changed underneath.
    if (
      !colOpts ||
      colOpts.fk_related_model_id !== view.fk_model_id ||
      !['hm', 'om', 'oo'].includes(colOpts.type as string)
    ) {
      return { edges: [] as Array<[string, string]> };
    }

    const model = await Model.getByIdOrName(context, {
      id: view.fk_model_id,
    });
    await model.getColumns(context);
    const pkCols = model.primaryKeys ?? model.columns.filter((c) => c.pk);

    if (pkCols.length === 0) {
      return { edges: [] as Array<[string, string]> };
    }
    if (pkCols.length > 1) {
      // Composite PK not supported in v1 — emit empty graph rather than
      // half-correct edges. Most Gantt tables use a single auto-PK.
      this.logger.warn(
        `getGanttDeps: composite-PK table not supported; returning empty edge graph for view ${view.id} (model ${model.id}, ${pkCols.length} PK cols).`,
      );
      return { edges: [] as Array<[string, string]> };
    }
    const pkCol = pkCols[0];

    const source = await Source.get(context, model.source_id);
    const dbDriver = await NcConnectionMgrv2.get(source);

    // Parent-table baseModel scoped to the current view — applies RLS and
    // the view's filters. Used by both branches: directly by the FK path,
    // and by the junction path to derive the visible PK set so the
    // junction read only returns edges from rows the caller can see.
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      viewId: view.id,
      dbDriver,
      source,
    });

    // `om` (and `mm`) routes through an MM-style junction table even for
    // self-ref one-to-many. The "Predecessors" virtual field's
    // fk_child_column_id then points back to the parent PK — selecting it
    // alongside the row's PK yields `(id, id)` self-loops, which is what
    // was breaking the inspector + arrows. Detect via fk_mm_model_id.
    const usesJunction = !!colOpts.fk_mm_model_id;

    if (usesJunction) {
      const junctionModel = await Model.getByIdOrName(context, {
        id: colOpts.fk_mm_model_id as string,
      });
      if (!junctionModel) {
        return { edges: [] as Array<[string, string]> };
      }
      await junctionModel.getColumns(context);

      const mmParentCol = junctionModel.columns?.find(
        (c) => c.id === colOpts.fk_mm_parent_column_id,
      );
      const mmChildCol = junctionModel.columns?.find(
        (c) => c.id === colOpts.fk_mm_child_column_id,
      );
      if (!mmParentCol || !mmChildCol) {
        return { edges: [] as Array<[string, string]> };
      }

      // Resolve the visible PK set on the parent table (RLS + view filters
      // applied via the standard baseModel.list path). Junction tables have
      // no RLS of their own, so reading the junction without scope would
      // leak the existence of restricted rows via their PKs in the edges.
      // Scoping mm_parent to the visible set mirrors the security envelope
      // of the legacy nestedList path this endpoint replaced.
      const visibleRows = (await baseModel.list(
        {
          fieldsSet: new Set<string>([pkCol.id]),
        },
        { limitOverride: GANTT_DEPS_LIMIT },
      )) as Array<Record<string, any>>;
      const visiblePks = visibleRows
        .map((r) => r?.[pkCol.title as string])
        .filter((v) => v != null)
        .map(String);

      if (!visiblePks.length) {
        return { edges: [] as Array<[string, string]> };
      }

      // Each junction row = one edge (mm_parent, mm_child) where parent =
      // the row that "owns" the LTAR field, child = the linked row.
      // The mm_parent IN visiblePks predicate scopes the read to edges
      // originating from rows the user can see.
      const junctionBaseModel = await Model.getBaseModelSQL(context, {
        id: junctionModel.id,
        dbDriver,
        source,
      });

      const rows = (await junctionBaseModel.list(
        {
          fieldsSet: new Set<string>([mmParentCol.id, mmChildCol.id]),
          customConditions: [
            {
              fk_column_id: mmParentCol.id,
              comparison_op: 'in',
              value: visiblePks,
              logical_op: 'and',
            } as any,
          ],
        },
        // Junction has no view scope or RLS of its own — visibility is
        // enforced via the mm_parent IN visiblePks predicate above.
        {
          ignoreViewFilterAndSort: true,
          ignoreRls: true,
          limitOverride: GANTT_DEPS_LIMIT,
        },
      )) as Array<Record<string, any>>;

      const parentKey = mmParentCol.title as string;
      const childKey = mmChildCol.title as string;
      const edges: Array<[string, string]> = [];

      for (const row of rows) {
        const parentId = row?.[parentKey];
        const childId = row?.[childKey];
        if (parentId == null || childId == null) continue;
        edges.push([String(childId), String(parentId)]);
      }

      return { edges };
    }

    // Legacy `hm` (and `oo`) — direct FK on the same table. Select (pk,
    // fk_child_col) and read each row's parent off its FK.
    const fkChildCol = await Column.get(context, {
      colId: colOpts.fk_child_column_id as string,
    });
    if (!fkChildCol) {
      return { edges: [] as Array<[string, string]> };
    }

    // fieldsSet override forces these two columns through the visibility
    // gate (FK column is typically `system: true` and hidden in the view).
    const fieldsSet = new Set<string>([pkCol.id, fkChildCol.id]);

    const rows = (await baseModel.list(
      {
        fieldsSet,
      },
      {
        ignoreViewFilterAndSort: false,
        // Bypass NC_DB_QUERY_LIMIT_MAX. Hard cap matches realistic Gantt
        // upper bound — 100k tasks is well beyond any sane project board.
        limitOverride: GANTT_DEPS_LIMIT,
      },
    )) as Array<Record<string, any>>;

    const pkKey = pkCol.title as string;
    const fkKey = fkChildCol.title as string;
    const edges: Array<[string, string]> = [];

    for (const row of rows) {
      const childId = row?.[pkKey];
      const parentId = row?.[fkKey];
      if (childId == null || parentId == null) continue;
      edges.push([String(childId), String(parentId)]);
    }

    return { edges };
  }

  async getPublicGanttDeps(
    context: NcContext,
    param: {
      password: string;
      sharedViewUuid: string;
    },
  ) {
    const { sharedViewUuid, password } = param;
    const view = await View.getByUUID(context, sharedViewUuid);

    if (!view) NcError.get(context).viewNotFound(sharedViewUuid);
    if (view.type !== ViewTypes.GANTT) {
      NcError.get(context).notFound('View is not a gantt view');
    }

    if (!(await View.verifyPassword(view, password))) {
      return NcError.get(context).invalidSharedViewPassword();
    }

    return this.getGanttDeps(context, { viewId: view.id });
  }
}

// Hard upper bound on edges returned. Each edge is a (string, string) pair —
// at 100k edges we're well under a megabyte on the wire. Tables larger than
// this should switch to a different visualization anyway.
const GANTT_DEPS_LIMIT = 100_000;
