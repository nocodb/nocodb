import { Injectable, Logger } from '@nestjs/common';
import {
  isLinksOrLTAR,
  isMMOrMMLike,
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
import { Altered } from '~/services/columns.service';
import { CacheScope, MetaTable } from '~/utils/globals';
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

    const columnName = `${columnNamePrefix}${originalCol.id}`;

    const base = await Base.getWithInfo(ctx, table.base_id, true, ncMeta);
    const source = base?.sources?.find((s) => s.id === table.source_id);
    if (!source) return null;

    await table.getColumns(
      { ...ctx, workspace_id: table.fk_workspace_id, base_id: table.base_id },
      ncMeta,
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
        order: originalCol.order,
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
    await View.insertColumnToAllViews(
      ctx,
      {
        fk_column_id: placeholderCol.id,
        fk_model_id: originalCol.fk_model_id,
        order: originalCol.order,
        column_show: { show: true },
      },
      ncMeta,
    );

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
    if (!colOpt) return;

    const relatedTable = await Model.get(
      ctx,
      colOpt.fk_related_model_id,
      true,
      ncMeta,
    );
    if (!relatedTable) return;

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

    const pvCol =
      relatedTable.columns?.find((c) => c.pv) ??
      relatedTable.columns?.find((c) => c.pk);
    if (!pvCol) return;

    const dbDriver = await NcConnectionMgrv2.get(source);
    if (!dbDriver) return;

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

    const aggFn = baseModel.isPg
      ? `string_agg(${pvExpr}::text, ', ')`
      : `GROUP_CONCAT(${pvExpr}, ', ')`;

    const isMMLike = isMMOrMMLike({ ...originalCol, colOptions: colOpt });

    if (isMMLike && colOpt.fk_mm_model_id) {
      const junctionTable = await Model.get(
        ctx,
        colOpt.fk_mm_model_id,
        true,
        ncMeta,
      );
      if (!junctionTable) return;

      const [mmChildCol, mmParentCol, childCol, parentCol] = await Promise.all([
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COLUMNS,
          colOpt.fk_mm_child_column_id,
        ),
        ncMeta.metaGet2(
          ctx.workspace_id,
          ctx.base_id,
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
          ctx.workspace_id,
          ctx.base_id,
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
            childCol.column_name,
          )} = ${relAliasQ}.${qi(parentCol.column_name)} SET ${qCol(
            srcTn,
            phCn,
          )} = ${pvExprAliased} WHERE ${qCol(
            srcTn,
            childCol.column_name,
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
            childCol.column_name,
          )} = ${relAliasQ}.${qi(parentCol.column_name)} AND ${qCol(
            srcTn,
            childCol.column_name,
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

    const relatedTable = await Model.get(ctx, relatedTableId, true, ncMeta);
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
