import { Injectable, Logger } from '@nestjs/common';
import { NcApiVersion, RelationTypes, ViewTypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { XKnex } from '~/db/CustomKnex';
import { Filter, Model, Sort, Source, View } from '~/models';
import ListViewColumn from '~/ee/models/ListViewColumn';
import ListViewLevel from '~/models/ListViewLevel';
import LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import conditionV2 from '~/db/conditionV2';
import { sanitize } from '~/helpers/sqlSanitize';
import getAst from '~/helpers/getAst';
import { PGDBQueryClient } from '~/ee/dbQueryClient/pg';
import { getAliasGenerator } from '~/utils';

@Injectable()
export class ListDatasService {
  protected logger = new Logger(ListDatasService.name);

  private async loadVisibleColumnMap(
    context: NcContext,
    viewId: string,
  ): Promise<Map<string, Set<string>>> {
    const listViewColumns = await ListViewColumn.list(context, viewId);
    const visibleByLevel = new Map<string, Set<string>>();
    for (const vc of listViewColumns) {
      if (vc.show && vc.fk_level_id && vc.fk_column_id) {
        if (!visibleByLevel.has(vc.fk_level_id)) {
          visibleByLevel.set(vc.fk_level_id, new Set());
        }
        visibleByLevel.get(vc.fk_level_id)!.add(vc.fk_column_id);
      }
    }
    return visibleByLevel;
  }

  async listViewCount(
    context: NcContext,
    param: { viewId: string; query: any },
  ) {
    const { viewId, query } = param;

    const view = await View.get(context, viewId);
    if (!view) NcError.get(context).viewNotFound(viewId);
    if (view.type !== ViewTypes.LIST)
      NcError.get(context).badRequest('Not a list view');

    // 1. Load levels (sorted by level ASC: 1=leaf, N=top) and reverse for display order
    const levels = await ListViewLevel.list(context, view.id);
    if (!levels.length) {
      return { totalRows: 0, counts: {} };
    }
    const displayLevels = [...levels].reverse();

    // 2. Load all filters upfront and merge with any draft filters from query
    const savedFilters = await Filter.rootFilterList(context, {
      viewId: view.id,
    });
    let extraFilters: any[] = [];
    if (query.filterArrJson) {
      try {
        extraFilters = JSON.parse(query.filterArrJson);
      } catch {
        // ignore invalid JSON
      }
    }
    // Sanitize: strip extraFilters referencing non-visible columns to prevent
    // count-based oracle attacks on hidden column values.
    const visibleColumnsByLevel = await this.loadVisibleColumnMap(
      context,
      viewId,
    );
    extraFilters = extraFilters.filter(
      (f) =>
        !f.fk_column_id ||
        (f.fk_level_id &&
          visibleColumnsByLevel.get(f.fk_level_id)?.has(f.fk_column_id)),
    );
    const allFilters = [...savedFilters, ...extraFilters];

    // 3. Parse collapsed parents: { "0": ["pk1", "pk2"], "1": ["pk3"] }
    const MAX_COLLAPSED_JSON_LENGTH = 10000;
    const MAX_COLLAPSED_IDS_PER_LEVEL = 100;
    const collapsed: Record<number, string[]> = {};
    if (query.collapsed) {
      if (
        typeof query.collapsed !== 'string' ||
        query.collapsed.length > MAX_COLLAPSED_JSON_LENGTH
      ) {
        NcError.get(context).badRequest(
          'Invalid or oversized collapsed parameter',
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(query.collapsed);
      } catch {
        NcError.get(context).badRequest('Invalid JSON in collapsed parameter');
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        NcError.get(context).badRequest(
          'Collapsed parameter must be a JSON object',
        );
      }
      for (const [key, val] of Object.entries(
        parsed as Record<string, unknown>,
      )) {
        const d = +key;
        if (!isNaN(d) && Array.isArray(val)) {
          collapsed[d] = val.slice(0, MAX_COLLAPSED_IDS_PER_LEVEL).map(String);
        }
      }
    }

    // 4. Get dbDriver from first level's source
    const firstModel = await Model.get(context, displayLevels[0].fk_model_id);
    const source = await Source.get(context, firstModel.source_id);
    const dbDriver = (await NcConnectionMgrv2.get(source)) as XKnex;

    // 5. Resolve each level and build its CTE inline
    const cteParts: string[] = [];
    const modelIds: string[] = []; // track model IDs for count result mapping

    for (let depth = 0; depth < displayLevels.length; depth++) {
      const level = displayLevels[depth];
      const model = await Model.get(context, level.fk_model_id);
      await model.getColumns(context);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver,
      });

      const filters = allFilters.filter(
        (f) => (f as any).fk_level_id === level.id,
      );

      // Resolve link for child levels (depth > 0) — break if missing
      let link: {
        type: 'hm' | 'mm';
        childFkCol: string;
        parentPkCol: string;
        junctionTn?: string;
        mmChildCol?: string;
        mmParentCol?: string;
      } | null = null;

      if (depth > 0) {
        const parentLevel = displayLevels[depth - 1];
        const linkColumnId =
          parentLevel?.fk_link_column_id || level.fk_link_column_id;
        if (!linkColumnId) break; // no link = stop here

        const linkColOpts = await LinkToAnotherRecordColumn.read(
          context,
          linkColumnId,
        );
        if (!linkColOpts)
          NcError.get(context).badRequest(
            `Link column ${linkColumnId} not found`,
          );

        if (
          linkColOpts.type === RelationTypes.HAS_MANY ||
          linkColOpts.type === RelationTypes.BELONGS_TO
        ) {
          const childCol = await linkColOpts.getChildColumn(context);
          const parentCol = await linkColOpts.getParentColumn(context);
          link = {
            type: 'hm',
            childFkCol: childCol.column_name,
            parentPkCol: parentCol.column_name,
          };
        } else if (
          linkColOpts.type === RelationTypes.MANY_TO_MANY ||
          linkColOpts.type === RelationTypes.ONE_TO_MANY ||
          linkColOpts.type === RelationTypes.MANY_TO_ONE
        ) {
          const mmModel = await linkColOpts.getMMModel(context);
          const mmChildCol = await linkColOpts.getMMChildColumn(context);
          const mmParentCol = await linkColOpts.getMMParentColumn(context);
          const childCol = await linkColOpts.getChildColumn(context);
          const parentCol = await linkColOpts.getParentColumn(context);

          const junctionTn = baseModel.getTnPath(mmModel);

          link = {
            type: 'mm',
            childFkCol: childCol.column_name,
            parentPkCol: parentCol.column_name,
            junctionTn,
            mmChildCol: mmChildCol.column_name,
            mmParentCol: mmParentCol.column_name,
          };
        } else {
          NcError.get(context).badRequest(
            `Only HM, BT, and MM link types are supported, got ${linkColOpts.type}`,
          );
        }
      }

      // Build CTE for this level — count only needs filtered ID lists, no ordering
      const tnPath = baseModel.getTnPath(model);
      const tAlias = `__nc_t${depth}`;
      const pks = model.primaryKeys;

      // Composite PK → concat with '___' separator (matches getCompositePkValue)
      const pkIdExpr = (prefix?: string) => {
        const q = (col: string) =>
          prefix ? `"${prefix}"."${sanitize(col)}"` : `"${sanitize(col)}"`;
        if (pks.length === 1) {
          return `${q(pks[0].column_name)}`;
        }
        return pks.map((pk) => `${q(pk.column_name)}`).join(` || '___' || `);
      };

      if (depth === 0) {
        // Root level: just select id with filters
        const levelQb = dbDriver(tnPath).select(
          dbDriver.raw(`${pkIdExpr()} AS id`),
        );

        if (filters.length) {
          await conditionV2(
            baseModel,
            [new Filter({ children: filters, is_group: true })],
            levelQb,
          );
        }

        cteParts.push(`"__nc_l0_ids" AS (${levelQb.toQuery()})`);
      } else {
        // Child level: join parent CTE to scope children
        const levelQb = dbDriver.from(
          dbDriver.raw(`?? AS "${tAlias}"`, [tnPath]),
        );

        levelQb.select(dbDriver.raw(`${pkIdExpr(tAlias)} AS id`));

        if (link.type === 'hm') {
          levelQb.select(
            dbDriver.raw(
              `"${tAlias}"."${sanitize(link.childFkCol)}" AS __nc_parent_fk`,
            ),
          );
          levelQb.joinRaw(
            `JOIN "__nc_l${
              depth - 1
            }_ids" parent ON parent.id = "${tAlias}"."${sanitize(
              link.childFkCol,
            )}"`,
          );
        } else {
          // mmChildCol references the link field owner's table (prev CTE / depth-1)
          // mmParentCol references the related table (current depth's model)
          levelQb.select(
            dbDriver.raw(
              `__nc_j."${sanitize(link.mmChildCol)}" AS __nc_parent_fk`,
            ),
          );
          levelQb.joinRaw(
            `JOIN ?? __nc_j ON ${pkIdExpr(tAlias)} = __nc_j."${sanitize(
              link.mmParentCol,
            )}"`,
            [link.junctionTn],
          );
          levelQb.joinRaw(
            `JOIN "__nc_l${
              depth - 1
            }_ids" parent ON parent.id = __nc_j."${sanitize(link.mmChildCol)}"`,
          );
        }

        if (filters.length) {
          await conditionV2(
            baseModel,
            [new Filter({ children: filters, is_group: true })],
            levelQb,
          );
        }

        // Collapse exclusions
        if (collapsed[depth - 1]?.length) {
          const placeholders = collapsed[depth - 1].map(() => '?').join(',');
          if (link.type === 'hm') {
            levelQb.whereRaw(
              `"${tAlias}"."${sanitize(
                link.childFkCol,
              )}" NOT IN (${placeholders})`,
              collapsed[depth - 1],
            );
          } else {
            levelQb.whereRaw(
              `__nc_j."${sanitize(link.mmChildCol)}" NOT IN (${placeholders})`,
              collapsed[depth - 1],
            );
          }
        }

        cteParts.push(`"__nc_l${depth}_ids" AS (${levelQb.toQuery()})`);
      }

      modelIds.push(model.id);
    }

    const N = modelIds.length;

    // 6. Pruned CTEs: bottom-up filter parents to only those with surviving children
    //    Also keep collapsed parents (they should still appear, just without children)
    const pruneBindings: any[] = [];
    if (N > 1) {
      for (let d = N - 2; d >= 0; d--) {
        const childRef =
          d === N - 2 ? `__nc_l${d + 1}_ids` : `__nc_l${d + 1}_pruned`;
        let pruneCondition = `id IN (SELECT DISTINCT __nc_parent_fk FROM "${childRef}")`;
        // Keep collapsed parents at this depth even if they have no surviving children
        if (collapsed[d]?.length) {
          const placeholders = collapsed[d].map(() => '?').join(',');
          pruneCondition += ` OR id::text IN (${placeholders})`;
          pruneBindings.push(...collapsed[d]);
        }
        cteParts.push(
          `"__nc_l${d}_pruned" AS (SELECT * FROM "__nc_l${d}_ids" WHERE ${pruneCondition})`,
        );
      }
    }

    // 7. Final count: count from pruned CTEs (non-leaf) and _ids (leaf)
    const cteRef = (d: number) =>
      N > 1 && d < N - 1 ? `__nc_l${d}_pruned` : `__nc_l${d}_ids`;
    const perDepthCounts = modelIds
      .map(
        (_, d) => `(SELECT count(*)::int FROM "${cteRef(d)}") AS count_l${d}`,
      )
      .join(', ');
    const totalExpr = modelIds
      .map((_, d) => `(SELECT count(*)::int FROM "${cteRef(d)}")`)
      .join(' + ');

    const countSql = `WITH ${cteParts.join(
      ',\n',
    )}\nSELECT ${totalExpr} AS total, ${perDepthCounts}`;

    this.logger.debug(countSql);

    const result = await dbDriver.raw(countSql, pruneBindings);

    const row = result?.rows?.[0] || {};

    const counts: Record<string, number> = {};
    for (let d = 0; d < modelIds.length; d++) {
      counts[modelIds[d]] = +(row[`count_l${d}`] || 0);
    }

    return {
      totalRows: +(row.total || 0),
      counts,
    };
  }

  async listViewData(
    context: NcContext,
    param: { viewId: string; query: any },
  ) {
    const { viewId, query } = param;
    const limit = Math.min(+(query.limit || 50), 200);
    const offset = Math.max(+(query.offset || 0), 0);

    const view = await View.get(context, viewId);
    if (!view) NcError.get(context).viewNotFound(viewId);
    if (view.type !== ViewTypes.LIST)
      NcError.get(context).badRequest('Not a list view');

    // 1. Load levels (sorted by level ASC: 1=leaf, N=top) and reverse for display order
    const levels = await ListViewLevel.list(context, view.id);
    if (!levels.length) {
      return { list: [], pageInfo: { offset, limit, totalRows: 0 } };
    }
    const displayLevels = [...levels].reverse();

    // 2. Load all filters and sorts upfront and merge with any draft values from query
    const savedFilters = await Filter.rootFilterList(context, {
      viewId: view.id,
    });
    let extraFilters: any[] = [];
    if (query.filterArrJson) {
      try {
        extraFilters = JSON.parse(query.filterArrJson);
      } catch {
        // ignore invalid JSON
      }
    }

    const savedSorts = await Sort.list(context, { viewId: view.id });
    let extraSorts: any[] = [];
    if (query.sortArrJson) {
      try {
        extraSorts = JSON.parse(query.sortArrJson);
      } catch {
        // ignore invalid JSON
      }
    }

    // Sanitize: strip extraFilters/extraSorts referencing non-visible columns
    // to prevent hidden column data leakage via filtering/sorting on public views.
    const visibleColumnsByLevel = await this.loadVisibleColumnMap(
      context,
      viewId,
    );
    extraFilters = extraFilters.filter(
      (f) =>
        !f.fk_column_id ||
        (f.fk_level_id &&
          visibleColumnsByLevel.get(f.fk_level_id)?.has(f.fk_column_id)),
    );
    extraSorts = extraSorts.filter(
      (s) =>
        !s.fk_column_id ||
        (s.fk_level_id &&
          visibleColumnsByLevel.get(s.fk_level_id)?.has(s.fk_column_id)),
    );

    const allFilters = [...savedFilters, ...extraFilters];
    const allSorts = [...savedSorts, ...extraSorts];

    // 3. Parse collapsed parents: { "0": ["pk1", "pk2"], "1": ["pk3"] }
    const MAX_COLLAPSED_JSON_LENGTH = 10000;
    const MAX_COLLAPSED_IDS_PER_LEVEL = 100;
    const collapsed: Record<number, string[]> = {};
    if (query.collapsed) {
      if (
        typeof query.collapsed !== 'string' ||
        query.collapsed.length > MAX_COLLAPSED_JSON_LENGTH
      ) {
        NcError.get(context).badRequest(
          'Invalid or oversized collapsed parameter',
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(query.collapsed);
      } catch {
        NcError.get(context).badRequest('Invalid JSON in collapsed parameter');
      }
      if (
        typeof parsed !== 'object' ||
        parsed === null ||
        Array.isArray(parsed)
      ) {
        NcError.get(context).badRequest(
          'Collapsed parameter must be a JSON object',
        );
      }
      for (const [key, val] of Object.entries(
        parsed as Record<string, unknown>,
      )) {
        const d = +key;
        if (!isNaN(d) && Array.isArray(val)) {
          collapsed[d] = val.slice(0, MAX_COLLAPSED_IDS_PER_LEVEL).map(String);
        }
      }
    }

    // 4. Get dbDriver from first level's source
    const firstModel = await Model.get(context, displayLevels[0].fk_model_id);
    const source = await Source.get(context, firstModel.source_id);
    const dbDriver = (await NcConnectionMgrv2.get(source)) as XKnex;

    // 5. Single loop: resolve each level, build thin index CTEs + hydration QBs
    const cteParts: string[] = [];
    const modelIds: string[] = [];
    const levelMeta: {
      model: Model;
      baseModel: any;
      columns: any[];
      parentFkCol: string | null;
    }[] = [];

    const client = new PGDBQueryClient();
    const hydrationQbs: any[] = [];

    for (let depth = 0; depth < displayLevels.length; depth++) {
      const level = displayLevels[depth];
      const model = await Model.get(context, level.fk_model_id);
      await model.getColumns(context);
      const baseModel = await Model.getBaseModelSQL(context, {
        id: model.id,
        dbDriver,
      });

      const filters = allFilters.filter(
        (f) => (f as any).fk_level_id === level.id,
      );
      const sorts = allSorts.filter((s) => (s as any).fk_level_id === level.id);

      // Resolve link for child levels (depth > 0) — break if missing
      let link: {
        type: 'hm' | 'mm';
        childFkCol: string;
        parentPkCol: string;
        junctionTn?: string;
        mmChildCol?: string;
        mmParentCol?: string;
      } | null = null;

      if (depth > 0) {
        const parentLevel = displayLevels[depth - 1];
        const linkColumnId =
          parentLevel?.fk_link_column_id || level.fk_link_column_id;
        if (!linkColumnId) break;

        const linkColOpts = await LinkToAnotherRecordColumn.read(
          context,
          linkColumnId,
        );
        if (!linkColOpts)
          NcError.get(context).badRequest(
            `Link column ${linkColumnId} not found`,
          );

        if (
          linkColOpts.type === RelationTypes.HAS_MANY ||
          linkColOpts.type === RelationTypes.BELONGS_TO
        ) {
          const childCol = await linkColOpts.getChildColumn(context);
          const parentCol = await linkColOpts.getParentColumn(context);
          link = {
            type: 'hm',
            childFkCol: childCol.column_name,
            parentPkCol: parentCol.column_name,
          };
        } else if (
          linkColOpts.type === RelationTypes.MANY_TO_MANY ||
          linkColOpts.type === RelationTypes.ONE_TO_MANY ||
          linkColOpts.type === RelationTypes.MANY_TO_ONE
        ) {
          const mmModel = await linkColOpts.getMMModel(context);
          const mmChildCol = await linkColOpts.getMMChildColumn(context);
          const mmParentCol = await linkColOpts.getMMParentColumn(context);
          const childCol = await linkColOpts.getChildColumn(context);
          const parentCol = await linkColOpts.getParentColumn(context);

          const junctionTn = baseModel.getTnPath(mmModel);

          link = {
            type: 'mm',
            childFkCol: childCol.column_name,
            parentPkCol: parentCol.column_name,
            junctionTn,
            mmChildCol: mmChildCol.column_name,
            mmParentCol: mmParentCol.column_name,
          };
        } else {
          NcError.get(context).badRequest(
            `Only HM, BT, and MM link types are supported, got ${linkColOpts.type}`,
          );
        }
      }

      // Build thin index CTE for this level
      const tnPath = baseModel.getTnPath(model);
      const tAlias = `__nc_t${depth}`;
      const pks = model.primaryKeys;
      const columns = model.columns;

      // Composite PK → concat with '___' separator
      const pkIdExpr = (prefix?: string) => {
        const q = (col: string) =>
          prefix ? `"${prefix}"."${sanitize(col)}"` : `"${sanitize(col)}"`;
        if (pks.length === 1) {
          return `${q(pks[0].column_name)}`;
        }
        return pks.map((pk) => `${q(pk.column_name)}`).join(` || '___' || `);
      };

      // Sort fallback: all PK columns
      const pkSortExpr = (prefix?: string) => {
        const q = (col: string) =>
          prefix ? `"${prefix}"."${sanitize(col)}"` : `"${sanitize(col)}"`;
        return pks.map((pk) => q(pk.column_name)).join(', ');
      };

      // Build ORDER BY expression for ROW_NUMBER
      let sortExpr: string;
      if (sorts.length) {
        const parts: string[] = [];
        for (const sort of sorts) {
          const col = columns.find((c) => c.id === sort.fk_column_id);
          if (col?.column_name) {
            const dir = sort.direction === 'desc' ? 'DESC' : 'ASC';
            const ref =
              depth > 0
                ? `"${tAlias}"."${sanitize(col.column_name)}"`
                : `"${sanitize(col.column_name)}"`;
            parts.push(`${ref} ${dir}`);
          }
        }
        sortExpr = parts.length
          ? parts.join(', ')
          : pkSortExpr(depth > 0 ? tAlias : undefined);
      } else {
        sortExpr = pkSortExpr(depth > 0 ? tAlias : undefined);
      }

      // FK column for __nc_parent_id in hydration
      let parentFkCol: string | null = null;

      if (depth === 0) {
        // Root level: id + ROW_NUMBER
        const levelQb = dbDriver(tnPath)
          .select(dbDriver.raw(`${pkIdExpr()} AS id`))
          .select(
            dbDriver.raw(
              `ROW_NUMBER() OVER (ORDER BY ${sortExpr}) AS __nc_l0_ord`,
            ),
          );

        if (filters.length) {
          await conditionV2(
            baseModel,
            [new Filter({ children: filters, is_group: true })],
            levelQb,
          );
        }

        cteParts.push(`"__nc_l0_ids" AS (${levelQb.toQuery()})`);
      } else {
        // Child level: join parent CTE, ROW_NUMBER partitioned by parent FK
        const levelQb = dbDriver.from(
          dbDriver.raw(`?? AS "${tAlias}"`, [tnPath]),
        );

        levelQb.select(dbDriver.raw(`${pkIdExpr(tAlias)} AS id`));

        // Carry parent ordinals
        for (let p = 0; p < depth; p++) {
          levelQb.select(dbDriver.raw(`parent.__nc_l${p}_ord`));
        }

        if (link.type === 'hm') {
          parentFkCol = link.childFkCol;
          levelQb.select(
            dbDriver.raw(
              `"${tAlias}"."${sanitize(link.childFkCol)}" AS __nc_parent_fk`,
            ),
          );
          levelQb.select(
            dbDriver.raw(
              `ROW_NUMBER() OVER (PARTITION BY "${tAlias}"."${sanitize(
                link.childFkCol,
              )}" ORDER BY ${sortExpr}) AS __nc_l${depth}_ord`,
            ),
          );
          levelQb.joinRaw(
            `JOIN "__nc_l${
              depth - 1
            }_ids" parent ON parent.id = "${tAlias}"."${sanitize(
              link.childFkCol,
            )}"`,
          );
        } else {
          parentFkCol = null; // MM: parent FK comes from junction
          // mmChildCol references the link field owner's table (prev CTE / depth-1)
          // mmParentCol references the related table (current depth's model)
          levelQb.select(
            dbDriver.raw(
              `__nc_j."${sanitize(link.mmChildCol)}" AS __nc_parent_fk`,
            ),
          );
          levelQb.select(
            dbDriver.raw(
              `ROW_NUMBER() OVER (PARTITION BY __nc_j."${sanitize(
                link.mmChildCol,
              )}" ORDER BY ${sortExpr}) AS __nc_l${depth}_ord`,
            ),
          );
          levelQb.joinRaw(
            `JOIN ?? __nc_j ON ${pkIdExpr(tAlias)} = __nc_j."${sanitize(
              link.mmParentCol,
            )}"`,
            [link.junctionTn],
          );
          levelQb.joinRaw(
            `JOIN "__nc_l${
              depth - 1
            }_ids" parent ON parent.id = __nc_j."${sanitize(link.mmChildCol)}"`,
          );
        }

        if (filters.length) {
          await conditionV2(
            baseModel,
            [new Filter({ children: filters, is_group: true })],
            levelQb,
          );
        }

        // Collapse exclusions
        if (collapsed[depth - 1]?.length) {
          const placeholders = collapsed[depth - 1].map(() => '?').join(',');
          if (link.type === 'hm') {
            levelQb.whereRaw(
              `"${tAlias}"."${sanitize(
                link.childFkCol,
              )}" NOT IN (${placeholders})`,
              collapsed[depth - 1],
            );
          } else {
            levelQb.whereRaw(
              `__nc_j."${sanitize(link.mmChildCol)}" NOT IN (${placeholders})`,
              collapsed[depth - 1],
            );
          }
        }

        cteParts.push(`"__nc_l${depth}_ids" AS (${levelQb.toQuery()})`);
      }

      // --- Build hydration QB for this depth (references "page" CTE) ---
      const hydAlias = `l${depth}_root`;
      const pkCol = pks[0].column_name;

      // Inner QB: only rows in the page at this depth
      const innerQb = dbDriver(tnPath).whereRaw(
        `"${sanitize(
          pkCol,
        )}" IN (SELECT "id" FROM "page" WHERE "__nc_depth" = ?)`,
        [depth],
      );
      const hydQb = dbDriver.from(innerQb.as(hydAlias));

      // __nc_pk
      hydQb.select(
        dbDriver.raw(`"${hydAlias}"."${sanitize(pkCol)}" AS __nc_pk`),
      );

      // __nc_parent_id: join page CTE to get __nc_parent_fk (works for both HM and MM)
      if (depth > 0) {
        hydQb.joinRaw(
          `JOIN "page" __nc_pg ON "${hydAlias}"."${sanitize(
            pkCol,
          )}" = __nc_pg."id" AND __nc_pg."__nc_depth" = ?`,
          [depth],
        );
        hydQb.select(
          dbDriver.raw(`__nc_pg."__nc_parent_fk" AS __nc_parent_id`),
        );
      } else {
        hydQb.select(dbDriver.raw(`NULL::integer AS __nc_parent_id`));
      }

      // extractColumns: adds LATERAL JOINs, formula subqueries, etc.
      const { ast } = await getAst(context, {
        query: {},
        model,
        view,
        throwErrorIfInvalidParams: false,
        apiVersion: NcApiVersion.V2,
      });

      await client.extractColumns({
        columns,
        knex: dbDriver,
        qb: hydQb,
        getAlias: getAliasGenerator(),
        params: {},
        baseModel,
        ast,
        alias: hydAlias,
        throwErrorIfInvalidParams: false,
        validateFormula: false,
        apiVersion: NcApiVersion.V2,
      });

      hydrationQbs.push(hydQb);

      modelIds.push(model.id);
      levelMeta.push({ model, baseModel, columns, parentFkCol });
    }

    const N = modelIds.length;

    // 6. Pruned CTEs: bottom-up filter parents to only those with surviving children
    //    Also keep collapsed parents (they should still appear, just without children)
    const pruneBindings: any[] = [];
    if (N > 1) {
      for (let d = N - 2; d >= 0; d--) {
        const childRef =
          d === N - 2 ? `__nc_l${d + 1}_ids` : `__nc_l${d + 1}_pruned`;
        let pruneCondition = `id IN (SELECT DISTINCT __nc_parent_fk FROM "${childRef}")`;
        // Keep collapsed parents at this depth even if they have no surviving children
        if (collapsed[d]?.length) {
          const placeholders = collapsed[d].map(() => '?').join(',');
          pruneCondition += ` OR id::text IN (${placeholders})`;
          pruneBindings.push(...collapsed[d]);
        }
        cteParts.push(
          `"__nc_l${d}_pruned" AS (SELECT * FROM "__nc_l${d}_ids" WHERE ${pruneCondition})`,
        );
      }
    }

    // 7. flat_index CTE — UNION ALL with padded ordinals (uses pruned CTEs for non-leaf)
    const cteRef = (d: number) =>
      N > 1 && d < N - 1 ? `__nc_l${d}_pruned` : `__nc_l${d}_ids`;
    const unionParts: string[] = [];
    for (let d = 0; d < N; d++) {
      const cols = ['id', `${d} AS __nc_depth`];
      for (let o = 0; o < N; o++) {
        if (o <= d) {
          cols.push(`__nc_l${o}_ord`);
        } else {
          cols.push(`0 AS __nc_l${o}_ord`);
        }
      }
      if (d === 0) {
        cols.push(`NULL::integer AS __nc_parent_fk`);
      } else {
        cols.push(`__nc_parent_fk`);
      }
      unionParts.push(`SELECT ${cols.join(', ')} FROM "${cteRef(d)}"`);
    }
    cteParts.push(`"flat_index" AS (${unionParts.join(' UNION ALL ')})`);

    // 7. page CTE — hierarchical ORDER BY + LIMIT/OFFSET
    const orderClauses: string[] = [];
    for (let d = 0; d < N; d++) {
      orderClauses.push(`__nc_l${d}_ord`);
      if (d < N - 1) {
        orderClauses.push(`CASE WHEN __nc_depth < ${d + 1} THEN 0 ELSE 1 END`);
      }
    }
    cteParts.push(
      `"page" AS (SELECT * FROM "flat_index" ORDER BY ${orderClauses.join(
        ', ',
      )} LIMIT ${limit} OFFSET ${offset})`,
    );

    // 8. Extract global CTEs registered by extractColumns (e.g. nc_base_user)
    const allCteParts: string[] = [];

    const tmpQb = dbDriver.from(dbDriver.raw('(SELECT 1) AS __nc_tmp'));
    dbDriver.applyCte(tmpQb);
    const tmpSql = tmpQb.toQuery();
    const withMatch = tmpSql.match(/^(WITH [\s\S]+?)select/i);
    if (withMatch) {
      let globalCteSql = withMatch[1].replace(/^WITH\s+/i, '').trim();
      if (globalCteSql.endsWith(',')) {
        globalCteSql = globalCteSql.slice(0, -1).trim();
      }
      allCteParts.push(globalCteSql);
    }

    // 9. Add thin index + flat_index + page CTEs
    allCteParts.push(...cteParts);

    // 9a. Add total count CTE — counts all rows in flat_index before pagination
    allCteParts.push(
      `"total_count" AS (SELECT COUNT(*)::int AS n FROM "flat_index")`,
    );

    // 10. Add hydration CTEs (reference "page" CTE)
    for (let d = 0; d < N; d++) {
      allCteParts.push(`"l${d}_hydrated" AS (${hydrationQbs[d].toQuery()})`);
    }

    // 11. Final SELECT — page LEFT JOIN hydration CTEs, pack per-depth data as JSONB
    const selectParts: string[] = [
      'page.__nc_depth',
      'page.id AS __nc_row_id',
      'page.__nc_parent_fk',
      '(SELECT n FROM total_count) AS __nc_total',
    ];

    const pkCoalesce = Array.from(
      { length: N },
      (_, d) => `l${d}.__nc_pk`,
    ).join(', ');
    const parentCoalesce = Array.from(
      { length: N },
      (_, d) => `l${d}.__nc_parent_id`,
    ).join(', ');
    selectParts.push(`COALESCE(${pkCoalesce}) AS __nc_pk`);
    selectParts.push(`COALESCE(${parentCoalesce}) AS __nc_parent_id`);

    for (let d = 0; d < N; d++) {
      selectParts.push(
        `CASE WHEN page.__nc_depth = ${d} THEN to_jsonb(l${d}) END AS __nc_data_${d}`,
      );
    }

    const joinParts = Array.from({ length: N }, (_, d) =>
      d === 0
        ? `LEFT JOIN "l${d}_hydrated" l${d} ON page.__nc_depth = ${d} AND l${d}.__nc_pk = page.id`
        : `LEFT JOIN "l${d}_hydrated" l${d} ON page.__nc_depth = ${d} AND l${d}.__nc_pk = page.id AND l${d}.__nc_parent_id = page.__nc_parent_fk`,
    ).join('\n');

    const finalSql = `WITH ${allCteParts.join(
      ',\n',
    )}\nSELECT ${selectParts.join(
      ', ',
    )}\nFROM "page"\n${joinParts}\nORDER BY ${orderClauses.join(', ')}`;

    this.logger.debug(finalSql);

    // 12. Execute single query
    const rawResult = await dbDriver.raw(finalSql, pruneBindings);
    const rawRows: Record<string, any>[] = rawResult?.rows || [];

    if (!rawRows.length) {
      return { list: [], pageInfo: { offset, limit, totalRows: 0 } };
    }

    // Extract total count from the first row (populated by total_count CTE)
    const totalRows: number = rawRows[0]?.__nc_total ?? rawRows.length;

    // 13. Post-process: unpack JSONB, convert types, substitute column IDs
    const metaKeys = new Set(['__nc_pk', '__nc_parent_id']);

    for (const row of rawRows) {
      const d = row.__nc_depth;
      const data = row[`__nc_data_${d}`];
      if (data && typeof data === 'object') {
        for (const [key, value] of Object.entries(data)) {
          if (!metaKeys.has(key)) {
            row[key] = value;
          }
        }
      }
      for (let dd = 0; dd < N; dd++) {
        delete row[`__nc_data_${dd}`];
      }
      row.__nc_row_type = modelIds[d];
    }

    // Per-depth type conversions + column ID→title substitution
    const byDepth: Record<number, Record<string, any>[]> = {};
    for (const row of rawRows) {
      (byDepth[row.__nc_depth] ??= []).push(row);
    }

    for (const [depthStr, rows] of Object.entries(byDepth)) {
      const d = +depthStr;
      const { baseModel, columns } = levelMeta[d];
      const bm = baseModel as any;

      if (typeof bm.convertAttachmentType === 'function') {
        await bm.convertAttachmentType(rows, columns);
      }
      if (typeof bm.convertDateFormat === 'function') {
        bm.convertDateFormat(rows, columns);
      }
      if (typeof bm.convertUserFormat === 'function') {
        await bm.convertUserFormat(rows, columns);
      }
      if (typeof bm.convertJsonTypes === 'function') {
        await bm.convertJsonTypes(rows, columns);
      }

      // Column ID → title substitution
      const substituted = await bm.substituteColumnIdsWithColumnTitles(rows);
      for (let i = 0; i < rows.length; i++) {
        Object.keys(rows[i]).forEach((k) => delete rows[i][k]);
        Object.assign(rows[i], substituted[i]);
      }
    }

    // Clean up internal fields
    for (const row of rawRows) {
      delete row.__nc_parent_fk;
      delete row.__nc_total;
    }

    return {
      list: rawRows,
      pageInfo: { offset, limit, totalRows },
    };
  }
}
