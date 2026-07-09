import { Injectable, Logger } from '@nestjs/common';
import {
  isLinksOrLTAR,
  isMMOrMMLike,
  isSupportedDisplayValueColumn,
  RelationTypes,
  SqlUiFactory,
  UITypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import Column from '~/models/Column';
import Model from '~/models/Model';
import View from '~/models/View';
import Base from '~/models/Base';
import NocoCache from '~/cache/NocoCache';
import Noco from '~/Noco';
import ProjectMgrv2 from '~/db/sql-mgr/v2/ProjectMgrv2';
import { getColumnNameQuery } from '~/db/getColumnNameQuery';
import { getUniqueColumnName } from '~/helpers/getUniqueName';
import { Altered } from '~/services/columns.service';
import { CacheDelDirection, CacheScope, MetaTable } from '~/utils/globals';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

@Injectable()
export class LinkPlaceholderService {
  private logger = new Logger(LinkPlaceholderService.name);

  /**
   * Creates a SingleLineText placeholder column to replace a link column,
   * populates it with aggregated display values from the linked records,
   * adds it to all views, and updates the cache.
   *
   * Returns the created placeholder column meta, or null on failure.
   */
  async createPlaceholder(
    ctx: NcContext,
    originalCol: any,
    table: Model,
    columnNamePrefix = '_nc_ph_',
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<{ id: string } | null> {
    if (!table) return null;

    const base = await Base.getWithInfo(ctx, table.base_id, true, ncMeta);
    const source = base?.sources?.find((s) => s.id === table.source_id);
    if (!source) return null;

    await table.getColumns(
      { ...ctx, workspace_id: table.fk_workspace_id, base_id: table.base_id },
      ncMeta,
    );

    // Capture per-view visibility of the column being replaced (the LTAR
    // that's about to be soft-deleted on THIS table — i.e. the reverse-side
    // column on the related table when the user deletes a link). The
    // placeholder lives on the same table and should mirror that visibility:
    // shown in views where the LTAR was shown, hidden in views where it was
    // hidden. Without this, the placeholder is forced visible everywhere.
    const views = await View.list(ctx, originalCol.fk_model_id, false, ncMeta);
    const showByViewId = new Map<string, boolean>();
    for (const view of views) {
      const viewCols = await View.getColumns(ctx, view.id, ncMeta);
      const entry = viewCols.find(
        (vc: any) => vc.fk_column_id === originalCol.id,
      );
      if (entry) showByViewId.set(view.id, !!entry.show);
    }

    const columnName = getUniqueColumnName(
      table.columns ?? [],
      `${columnNamePrefix}${originalCol.id}`,
    );

    const sqlUi = SqlUiFactory.create(await source.getConnectionConfig());
    const typeProps = sqlUi.getDataTypeForUiType({
      uidt: UITypes.SingleLineText,
    });
    typeProps.dtxp = sqlUi.getDefaultLengthForDatatype(typeProps.dt);
    typeProps.dtxs = sqlUi.getDefaultScaleForDatatype(typeProps.dt);

    try {
      const sqlMgr = ProjectMgrv2.getSqlMgr(
        ctx,
        { id: source.base_id },
        ncMeta,
      );

      await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
        ...table,
        tn: table.table_name,
        originalColumns: table.columns.map((c) => ({
          ...c,
          cn: c.column_name,
        })),
        columns: [
          ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
          {
            ...typeProps,
            cn: columnName,
            column_name: columnName,
            title: originalCol.title,
            uidt: UITypes.SingleLineText,
            altered: Altered.NEW_COLUMN,
          },
        ],
      });
    } catch (e) {
      this.logger.error(
        `createPlaceholder DDL failed for ${originalCol.id}: ${e.message}`,
        e.stack,
      );
      return null;
    }

    const placeholderCol = await ncMeta.metaInsert2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COLUMNS,
      {
        fk_model_id: originalCol.fk_model_id,
        base_id: originalCol.base_id,
        source_id: originalCol.source_id,
        fk_workspace_id: ctx.workspace_id,
        title: originalCol.title,
        column_name: columnName,
        uidt: UITypes.SingleLineText,
        dt: typeProps.dt,
        dtxp: typeProps.dtxp,
        dtxs: typeProps.dtxs,
        order:
          Math.max(
            0,
            ...(table.columns ?? []).map((c) => Number(c.order ?? 0)),
          ) + 1,
      },
    );

    // Populate with linked record display values (non-fatal)
    try {
      await this.populatePlaceholderValues(
        ctx,
        originalCol,
        columnName,
        table,
        source,
        ncMeta,
      );
    } catch (e) {
      this.logger.error(
        `populatePlaceholderValues failed: ${e.message}`,
        e.stack,
      );
    }

    // Add placeholder to column list cache
    await NocoCache.set(
      ctx,
      `${CacheScope.COLUMN}:${placeholderCol.id}`,
      placeholderCol,
    );
    await NocoCache.appendToList(
      ctx,
      CacheScope.COLUMN,
      [originalCol.fk_model_id],
      `${CacheScope.COLUMN}:${placeholderCol.id}`,
    );

    // Add view column entries so the placeholder is visible in all views
    try {
      await View.insertColumnToAllViews(
        ctx,
        {
          fk_column_id: placeholderCol.id,
          fk_model_id: originalCol.fk_model_id,
          order: placeholderCol.order,
          column_show: { show: true },
        },
        ncMeta,
      );

      // Mirror the soft-deleted LTAR's per-view visibility: hide the
      // placeholder in views where the LTAR was hidden, leave it shown
      // elsewhere.
      for (const view of views) {
        const desiredShow = showByViewId.get(view.id);
        if (desiredShow === undefined || desiredShow) continue;
        const phViewColId = await View.getViewColumnId(
          ctx,
          { viewId: view.id, colId: placeholderCol.id },
          ncMeta,
        );
        if (phViewColId) {
          await View.updateColumn(
            ctx,
            view.id,
            phViewColId,
            { show: false },
            ncMeta,
          );
        }
      }
    } catch (e) {
      this.logger.error(
        `insertColumnToAllViews failed for placeholder ${placeholderCol.id}; rolling back: ${e.message}`,
        e.stack,
      );

      try {
        await ncMeta.metaDelete(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          placeholderCol.id,
        );
        await NocoCache.deepDel(
          ctx,
          `${CacheScope.COLUMN}:${placeholderCol.id}`,
          CacheDelDirection.CHILD_TO_PARENT,
        );

        const sqlMgr = ProjectMgrv2.getSqlMgr(
          ctx,
          { id: source.base_id },
          ncMeta,
        );
        await sqlMgr.sqlOpPlus(source, 'tableUpdate', {
          ...table,
          tn: table.table_name,
          originalColumns: [
            ...table.columns.map((c) => ({ ...c, cn: c.column_name })),
            {
              ...typeProps,
              cn: columnName,
              column_name: columnName,
              title: originalCol.title,
              uidt: UITypes.SingleLineText,
            },
          ],
          columns: table.columns.map((c) => ({ ...c, cn: c.column_name })),
        });
      } catch (rollbackErr) {
        this.logger.error(
          `Rollback of placeholder ${placeholderCol.id} failed — manual cleanup required: ${rollbackErr.message}`,
          rollbackErr.stack,
        );
      }

      throw e;
    }

    return placeholderCol;
  }

  /**
   * Populates a placeholder column with display values from linked records
   * using a single UPDATE query. Handles MM, HM, BT, and OO relation types.
   */
  async populatePlaceholderValues(
    ctx: NcContext,
    originalCol: any,
    placeholderColumnName: string,
    table: Model,
    source: any,
    ncMeta: MetaService = Noco.ncMeta,
  ): Promise<void> {
    const colOpt = await ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { fk_column_id: originalCol.id },
    );
    if (!colOpt) {
      this.logger.warn(
        `populatePlaceholder skipped — no col_relations row for ${originalCol.id}`,
      );
      return;
    }

    // The related table and the junction can live in other bases (cross-base
    // link). Resolve each in its own base — using ctx.base_id would query the
    // wrong base and silently no-op (placeholder values never materialize).
    // Same-base links leave fk_related_base_id/fk_mm_base_id null or equal, so
    // these collapse to ctx.
    const relatedCtx: NcContext =
      colOpt.fk_related_base_id && colOpt.fk_related_base_id !== ctx.base_id
        ? { ...ctx, base_id: colOpt.fk_related_base_id }
        : ctx;
    const mmCtx: NcContext =
      colOpt.fk_mm_base_id && colOpt.fk_mm_base_id !== ctx.base_id
        ? { ...ctx, base_id: colOpt.fk_mm_base_id }
        : ctx;

    const relatedTable = await Model.get(
      relatedCtx,
      colOpt.fk_related_model_id,
      true,
      ncMeta,
    );
    if (!relatedTable) {
      this.logger.warn(
        `populatePlaceholder skipped — related table ${colOpt.fk_related_model_id} missing for ${originalCol.id}`,
      );
      return;
    }

    await relatedTable.getColumns(
      {
        ...ctx,
        workspace_id: relatedTable.fk_workspace_id,
        base_id: relatedTable.base_id,
      },
      ncMeta,
      undefined,
      true,
      true,
    );

    // Honor the link's custom display value override — the chips showed that
    // column, and this materialized text is permanent. PV/PK fallback when
    // no override or it's stale/unsupported.
    const overrideCol = colOpt.fk_display_value_column_id
      ? relatedTable.columns?.find(
          (c) =>
            c.id === colOpt.fk_display_value_column_id &&
            isSupportedDisplayValueColumn(c),
        )
      : undefined;
    const pvCol =
      overrideCol ??
      relatedTable.columns?.find((c) => c.pv) ??
      relatedTable.columns?.find((c) => c.pk);
    if (!pvCol) {
      this.logger.warn(
        `populatePlaceholder skipped — no pv/pk column on related table ${relatedTable.id}`,
      );
      return;
    }

    const dbDriver = await NcConnectionMgrv2.get(source);
    if (!dbDriver) {
      this.logger.warn(
        `populatePlaceholder skipped — no dbDriver for source ${source?.id}`,
      );
      return;
    }

    const baseModel = await Model.getBaseModelSQL(
      ctx,
      {
        model: table,
        dbDriver,
        source,
      },
      ncMeta,
    );

    const relContext = {
      ...ctx,
      workspace_id: relatedTable.fk_workspace_id,
      base_id: relatedTable.base_id,
    };

    const relBaseModel = await Model.getBaseModelSQL(
      relContext,
      {
        model: relatedTable,
        dbDriver,
        source,
      },
      ncMeta,
    );

    // Resolve pv column SQL — handles both physical and virtual (Formula, Lookup, etc.)
    const { builder: pvBuilder } = await getColumnNameQuery({
      baseModelSqlv2: relBaseModel,
      column: pvCol,
      context: relContext,
      ncMeta,
    });

    const pvExpr =
      typeof pvBuilder === 'string'
        ? `${
            relBaseModel.schema
              ? `${dbDriver.raw('??', [relBaseModel.schema]).toQuery()}.`
              : ''
          }${dbDriver.raw('??', [relatedTable.table_name]).toQuery()}.${dbDriver
            .raw('??', [pvBuilder])
            .toQuery()}`
        : `(${pvBuilder.toQuery()})`;

    const qi = (n: string) => dbDriver.raw('??', [n]).toQuery();
    const qTn = (m: { table_name: string }) => {
      return baseModel.schema
        ? `${qi(baseModel.schema)}.${qi(m.table_name)}`
        : qi(m.table_name);
    };
    const qCol = (tn: string, col: string) => `${tn}.${qi(col)}`;

    const srcTn = qTn(table);
    const relTn = qTn(relatedTable);
    const phCn = placeholderColumnName;

    // COALESCE so a single NULL doesn't contaminate the whole aggregate to
    // NULL (PG behaviour). mssql has no GROUP_CONCAT — STRING_AGG is the
    // T-SQL equivalent (SQL Server 2017+, separator as second arg, ignores
    // pure NULL rows so the COALESCE keeps empty segments visible). Oracle has
    // neither — LISTAGG(... WITHIN GROUP) is the equivalent; it skips NULLs
    // (and Oracle stores '' AS NULL, so COALESCE would be a no-op) and the
    // subquery already filters `pvExpr IS NOT NULL`, so no COALESCE is needed.
    const aggFn = baseModel.isPg
      ? `string_agg(COALESCE(${pvExpr}::text, ''), ', ')`
      : baseModel.isMySQL
      ? `GROUP_CONCAT(COALESCE(${pvExpr}, '') SEPARATOR ', ')`
      : baseModel.isMssql
      ? `STRING_AGG(COALESCE(${pvExpr}, ''), ', ')`
      : baseModel.isOracle
      ? `LISTAGG(TO_CHAR(${pvExpr}), ', ') WITHIN GROUP (ORDER BY NULL)`
      : `GROUP_CONCAT(COALESCE(${pvExpr}, ''), ', ')`;

    const isMMLike = isMMOrMMLike({ ...originalCol, colOptions: colOpt });

    if (isMMLike && colOpt.fk_mm_model_id) {
      const junctionTable = await Model.get(
        mmCtx,
        colOpt.fk_mm_model_id,
        true,
        ncMeta,
      );
      if (!junctionTable) return;

      // mm child/parent columns live on the junction (mmCtx); the link's child
      // column is on the current model (ctx); the parent column is on the
      // related model (relatedCtx).
      const [mmChildCol, mmParentCol, childCol, parentCol] = await Promise.all([
        ncMeta.metaGet2(
          mmCtx.workspace_id,
          mmCtx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_mm_child_column_id,
        ),
        ncMeta.metaGet2(
          mmCtx.workspace_id,
          mmCtx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_mm_parent_column_id,
        ),
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        ncMeta.metaGet2(
          relatedCtx.workspace_id,
          relatedCtx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!mmChildCol || !mmParentCol || !childCol || !parentCol) return;

      const jTn = qTn(junctionTable);
      const subquery = `SELECT ${qCol(
        jTn,
        mmChildCol.column_name,
      )} AS fk_val, ${aggFn} AS dv FROM ${jTn} LEFT JOIN ${relTn} ON ${qCol(
        jTn,
        mmParentCol.column_name,
      )} = ${qCol(
        relTn,
        parentCol.column_name,
      )} WHERE ${pvExpr} IS NOT NULL GROUP BY ${qCol(
        jTn,
        mmChildCol.column_name,
      )}`;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN (${subquery}) AS _linked ON ${qCol(
            srcTn,
            childCol.column_name,
          )} = _linked.\`fk_val\` SET ${qCol(srcTn, phCn)} = _linked.\`dv\``,
          null,
          { raw: true },
        );
      } else if (baseModel.isOracle) {
        // Oracle has no `UPDATE ... FROM`; MERGE is the join-update form. The
        // source alias must start with a letter (a `_linked`-style underscore
        // prefix is invalid unquoted — ORA-00911) and table aliases take no
        // `AS` (ORA-03048). The subquery's `fk_val`/`dv` column aliases stay
        // unquoted so they fold to the same case as the unquoted references.
        await baseModel.execAndParse(
          `MERGE INTO ${srcTn} USING (${subquery}) nc_ph_linked ON (${qCol(
            srcTn,
            childCol.column_name,
          )} = nc_ph_linked.fk_val) WHEN MATCHED THEN UPDATE SET ${qCol(
            srcTn,
            phCn,
          )} = nc_ph_linked.dv`,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
            srcTn,
            childCol.column_name,
          )} = _linked."fk_val"`,
          null,
          { raw: true },
        );
      }
    } else if (colOpt.type === 'hm') {
      const [childCol, parentCol] = await Promise.all([
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!childCol || !parentCol) return;

      const subquery = `SELECT ${qCol(
        relTn,
        childCol.column_name,
      )} AS fk_val, ${aggFn} AS dv FROM ${relTn} WHERE ${qCol(
        relTn,
        childCol.column_name,
      )} IS NOT NULL AND ${pvExpr} IS NOT NULL GROUP BY ${qCol(
        relTn,
        childCol.column_name,
      )}`;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN (${subquery}) AS _linked ON ${qCol(
            srcTn,
            parentCol.column_name,
          )} = _linked.\`fk_val\` SET ${qCol(srcTn, phCn)} = _linked.\`dv\``,
          null,
          { raw: true },
        );
      } else if (baseModel.isOracle) {
        // Oracle has no `UPDATE ... FROM` — see the MM branch above for why the
        // source alias is `nc_ph_linked` and the table alias carries no `AS`.
        await baseModel.execAndParse(
          `MERGE INTO ${srcTn} USING (${subquery}) nc_ph_linked ON (${qCol(
            srcTn,
            parentCol.column_name,
          )} = nc_ph_linked.fk_val) WHEN MATCHED THEN UPDATE SET ${qCol(
            srcTn,
            phCn,
          )} = nc_ph_linked.dv`,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = _linked."dv" FROM (${subquery}) AS _linked WHERE ${qCol(
            srcTn,
            parentCol.column_name,
          )} = _linked."fk_val"`,
          null,
          { raw: true },
        );
      }
    } else if (colOpt.type === 'bt' || colOpt.type === 'oo') {
      const [childCol, parentCol] = await Promise.all([
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_child_column_id,
        ),
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_parent_column_id,
        ),
      ]);
      if (!childCol || !parentCol) return;

      // The FK (child) column physically lives on the relation's "owner" side.
      // For BT — and the OO side that holds the FK (`meta.bt`) — that's the
      // table being updated (srcTn), so the join is `srcTn.fk = rel.pk`. For
      // the OO side that does NOT hold the FK, the FK sits on the related
      // table, so the join must flip to `srcTn.pk = rel.fk`. Without flipping,
      // the query references the FK column on srcTn where it doesn't exist
      // (e.g. `RA.RA_id` for an `RA`-owned `id` referenced by `RB.RA_id`).
      // Deriving orientation from the FK column's `fk_model_id` covers every
      // case without inspecting the OO `meta.bt` flag.
      const fkOnSrc = childCol.fk_model_id === table.id;
      const srcJoinCol = fkOnSrc ? childCol.column_name : parentCol.column_name;
      const relJoinCol = fkOnSrc ? parentCol.column_name : childCol.column_name;

      // Alias the relation side so self-referential BT/OO works
      // (PG rejects `UPDATE T ... FROM T` and MySQL joins need distinct names).
      // Virtual pv (Knex QB) would reference the original table name inside its
      // subquery, so we skip population for self-ref + virtual pv.
      const isSelfRef = table.id === relatedTable.id;
      if (isSelfRef && typeof pvBuilder !== 'string') return;

      const relAlias = '__nc_ph_rel';
      const relAliasQ = qi(relAlias);
      const pvExprAliased =
        typeof pvBuilder === 'string'
          ? `${relAliasQ}.${dbDriver.raw('??', [pvBuilder]).toQuery()}`
          : `(${pvBuilder.toQuery()})`;

      if (baseModel.isMySQL) {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} JOIN ${relTn} AS ${relAliasQ} ON ${qCol(
            srcTn,
            srcJoinCol,
          )} = ${relAliasQ}.${qi(relJoinCol)} SET ${qCol(
            srcTn,
            phCn,
          )} = ${pvExprAliased} WHERE ${qCol(srcTn, srcJoinCol)} IS NOT NULL`,
          null,
          { raw: true },
        );
      } else if (baseModel.isMssql || baseModel.isOracle) {
        // Oracle uses the same correlated-subquery UPDATE as T-SQL, but rejects
        // `AS` before a table alias (ORA-03048) — the relation alias is bare
        // there. (The quoted `__nc_ph_rel` alias itself is valid in Oracle.)
        const relFromAs = baseModel.isOracle ? '' : 'AS ';
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = (SELECT ${pvExprAliased} FROM ${relTn} ${relFromAs}${relAliasQ} WHERE ${relAliasQ}.${qi(
            relJoinCol,
          )} = ${qCol(srcTn, srcJoinCol)}) WHERE ${qCol(
            srcTn,
            srcJoinCol,
          )} IS NOT NULL`,
          null,
          { raw: true },
        );
      } else {
        await baseModel.execAndParse(
          `UPDATE ${srcTn} SET ${qi(
            phCn,
          )} = ${pvExprAliased} FROM ${relTn} AS ${relAliasQ} WHERE ${qCol(
            srcTn,
            srcJoinCol,
          )} = ${relAliasQ}.${qi(relJoinCol)} AND ${qCol(
            srcTn,
            srcJoinCol,
          )} IS NOT NULL`,
          null,
          { raw: true },
        );
      }
    }
  }

  /**
   * Find the reverse link column for a given link column. Read-only — safe to
   * call before opening a meta transaction. Returns null if no matching
   * reverse column exists or the related table/column is already deleted.
   */
  async findReverseLinkColumn(
    ctx: NcContext,
    columnId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<Column | null> {
    const col = await Column.get(
      ctx,
      { colId: columnId, includeDeleted: true },
      ncMeta,
    );
    if (!col) return null;

    const colOpt = await ncMeta.metaGet2(
      ctx.workspace_id,
      ctx.base_id,
      MetaTable.COL_RELATIONS,
      { fk_column_id: columnId },
    );
    if (!colOpt) return null;

    const relatedTableId = colOpt.fk_related_model_id;
    if (!relatedTableId) return null;

    // For a cross-base link the related table lives in `fk_related_base_id`,
    // NOT the deleted column's base. Resolving it with the caller's `ctx`
    // returns null (wrong base scope), so the reverse column is never found
    // and is left orphaned. Resolve it in the related base.
    const relatedCtx: NcContext =
      colOpt.fk_related_base_id && colOpt.fk_related_base_id !== ctx.base_id
        ? { ...ctx, base_id: colOpt.fk_related_base_id }
        : ctx;

    const relatedTable = await Model.get(
      relatedCtx,
      relatedTableId,
      true,
      ncMeta,
    );
    if (!relatedTable) return null;

    const relatedCols = await relatedTable.getColumns(
      {
        ...ctx,
        workspace_id: relatedTable.fk_workspace_id,
        base_id: relatedTable.base_id,
      },
      ncMeta,
      undefined,
      true,
      true,
    );

    for (const c of relatedCols) {
      if (!isLinksOrLTAR(c)) continue;
      if (c.id === columnId) continue;

      const revOpt = await c.getColOptions<any>(
        {
          ...ctx,
          workspace_id: relatedTable.fk_workspace_id,
          base_id: relatedTable.base_id,
        },
        ncMeta,
      );
      if (!revOpt) continue;

      if (this.matchReverseColumn(col, colOpt, revOpt)) {
        return c.deleted ? null : c;
      }
    }

    return null;
  }

  /**
   * Create a placeholder column on the opposite side of a link relationship.
   * The DDL is issued via sqlMgr and opens its own Knex connection, so this
   * must be called OUTSIDE any meta transaction — otherwise single-pool DBs
   * (SQLite) will deadlock.
   *
   * `ncMeta` is used only for the lookup + cache clear that sit around the
   * DDL path; `createPlaceholder` itself still goes through `Noco.ncMeta`
   * (its meta insert happens after the DDL and is independent of any
   * caller-held transaction).
   *
   * Returns { reverseCol, placeholder, table_id } on success, null otherwise.
   */
  async createPlaceholderForReverse(
    ctx: NcContext,
    reverseCol: Column,
    columnNamePrefix = '_nc_ph_',
    ncMeta = Noco.ncMeta,
  ): Promise<{
    reverseCol: Column;
    placeholder: { id: string };
    table_id: string;
  } | null> {
    const revTable = await Model.get(ctx, reverseCol.fk_model_id, true, ncMeta);
    if (!revTable) return null;

    const placeholder = await this.createPlaceholder(
      ctx,
      reverseCol,
      revTable,
      columnNamePrefix,
      ncMeta,
    );

    await View.clearSingleQueryCache(
      {
        ...ctx,
        workspace_id: revTable.fk_workspace_id,
        base_id: revTable.base_id,
      },
      reverseCol.fk_model_id,
      null,
      ncMeta,
    );

    if (!placeholder) return null;

    return {
      reverseCol,
      placeholder,
      table_id: reverseCol.fk_model_id,
    };
  }

  private matchReverseColumn(
    originalCol: any,
    original: any,
    candidate: any,
  ): boolean {
    if (isMMOrMMLike({ ...originalCol, colOptions: original })) {
      return (
        candidate.fk_parent_column_id === original.fk_child_column_id &&
        candidate.fk_child_column_id === original.fk_parent_column_id &&
        candidate.fk_mm_model_id === original.fk_mm_model_id &&
        candidate.fk_mm_parent_column_id === original.fk_mm_child_column_id &&
        candidate.fk_mm_child_column_id === original.fk_mm_parent_column_id
      );
    }

    if (
      original.type === RelationTypes.HAS_MANY ||
      original.type === RelationTypes.BELONGS_TO
    ) {
      const expectedType =
        original.type === RelationTypes.HAS_MANY
          ? RelationTypes.BELONGS_TO
          : RelationTypes.HAS_MANY;
      return (
        candidate.type === expectedType &&
        candidate.fk_parent_column_id === original.fk_parent_column_id &&
        candidate.fk_child_column_id === original.fk_child_column_id
      );
    }

    if (original.type === RelationTypes.ONE_TO_ONE) {
      return (
        candidate.type === RelationTypes.ONE_TO_ONE &&
        candidate.fk_parent_column_id === original.fk_parent_column_id &&
        candidate.fk_child_column_id === original.fk_child_column_id
      );
    }

    return false;
  }
}
