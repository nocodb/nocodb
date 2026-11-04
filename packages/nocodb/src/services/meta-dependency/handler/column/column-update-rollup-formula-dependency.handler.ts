import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  isLinksOrLTAR,
  MetaEventType,
  ROLLUP_FORMULA_FUNCTION,
  UITypes,
  validateFormulaAndExtractTreeWithType,
} from 'nocodb-sdk';
import type {
  ClientTypeOrSqlUI,
  NcContext,
  ParsedFormulaNode,
  RollupColumnReqType,
} from 'nocodb-sdk';
import type {
  AffectedDependencyResult,
  MetaDependencyEventRequest,
  MetaEventHandler,
} from '~/services/meta-dependency/types';
import type { MetaService } from '~/meta/meta.service';
import { FormulaColumn, Model, RollupColumn, Source, View } from '~/models';
import Column from '~/models/Column';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { validateRollupPayload } from '~/helpers/columnHelpers';
import { getFormulasReferredTheColumn } from '~/helpers/formulaHelpers';
import { clearSingleQueryCacheForColumnReferences } from '~/helpers/singleQueryCacheInvalidator';

/**
 * A formula rollup stores the type of `values` (`parsed_tree`). When a field
 * changes, the rollups reading it — directly, through formulas over it,
 * lookups of it, links to its table when it is the display value, or other
 * rollups — are re-validated: re-typed, or error-marked when the formula no
 * longer fits. Reads only re-derive in memory; this keeps the stored tree
 * current.
 *
 * Walks same-base AND cross-base dependents, like the transitive delete
 * handler. A rollup is only written when its tree or error changed, so an
 * unrelated column update costs a few indexed reads. Errors are logged and
 * swallowed — the column update has already committed.
 */
@Injectable()
export class ColumnUpdateRollupFormulaDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateRollupFormulaDependencyHandler.name,
  );

  // a new display value changes what links to its table read
  triggerMetaEvents: MetaEventType[] = [
    MetaEventType.COLUMN_UPDATED,
    MetaEventType.COLUMN_PRIMARY_UPDATED,
  ];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const newCol = param.newEntity;
    if (!newCol?.id) return undefined;

    // Probe — does anything read this field? Formulas over it live in its own
    // table; lookups and rollups of it may be cross-base.
    const columns = await Column.list(
      context,
      { fk_model_id: newCol.fk_model_id },
      ncMeta,
    );
    if (
      (
        await getFormulasReferredTheColumn(
          context,
          { column: newCol, columns },
          ncMeta,
        )
      ).length
    ) {
      return {};
    }
    for (const ctx of await this.linkedContexts(context, columns, ncMeta)) {
      for (const [table, condition] of [
        [MetaTable.COL_LOOKUP, { fk_lookup_column_id: newCol.id }],
        [MetaTable.COL_ROLLUP, { fk_rollup_column_id: newCol.id }],
        ...(newCol.pv
          ? [
              [
                MetaTable.COL_RELATIONS,
                { fk_related_model_id: newCol.fk_model_id },
              ],
            ]
          : []),
      ] as [MetaTable, Record<string, string>][]) {
        const rows = await ncMeta.metaList2(
          ctx.workspace_id,
          ctx.base_id,
          table,
          { condition, limit: 1 },
        );
        if (rows.length) return {};
      }
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
    const newCol = param.newEntity as Column;
    if (!newCol?.id) return;

    try {
      const visited = new Set<string>();
      const queue: { fk_column_id: string; context: NcContext }[] = [];
      const enqueue = (fk_column_id: string, ctx: NcContext) => {
        const key = `${ctx.base_id}:${fk_column_id}`;
        if (visited.has(key)) return;
        visited.add(key);
        queue.push({ fk_column_id, context: ctx });
      };
      const affectedModelCtxMap = new Map<string, NcContext>();

      // BFS over the fields whose type may have changed: the updated one,
      // then every formula, lookup, link and rollup that passes it on.
      enqueue(newCol.id, context);
      while (queue.length > 0) {
        const { fk_column_id: id, context: ctx } = queue.shift();
        const column = await Column.get(ctx, { colId: id }, ncMeta);
        if (!column) continue;

        // Formulas read only their own table — re-derive their stored tree.
        const tableColumns = await Column.list(
          ctx,
          { fk_model_id: column.fk_model_id },
          ncMeta,
        );
        for (const formula of await getFormulasReferredTheColumn(
          ctx,
          { column, columns: tableColumns },
          ncMeta,
        )) {
          if (formula.uidt !== UITypes.Formula) continue;
          if (await this.retypeFormula(ctx, formula, tableColumns, ncMeta)) {
            enqueue(formula.id, ctx);
          }
        }

        for (const linkedCtx of await this.linkedContexts(
          ctx,
          tableColumns,
          ncMeta,
        )) {
          for (const row of await ncMeta.metaList2(
            linkedCtx.workspace_id,
            linkedCtx.base_id,
            MetaTable.COL_LOOKUP,
            { condition: { fk_lookup_column_id: id } },
          )) {
            enqueue(row.fk_column_id, linkedCtx);
          }

          // A link reads as its records' display value.
          if (column.pv) {
            for (const row of await ncMeta.metaList2(
              linkedCtx.workspace_id,
              linkedCtx.base_id,
              MetaTable.COL_RELATIONS,
              { condition: { fk_related_model_id: column.fk_model_id } },
            )) {
              enqueue(row.fk_column_id, linkedCtx);
            }
          }

          for (const rollup of await ncMeta.metaList2(
            linkedCtx.workspace_id,
            linkedCtx.base_id,
            MetaTable.COL_ROLLUP,
            {
              condition: {
                fk_rollup_column_id: id,
                rollup_function: ROLLUP_FORMULA_FUNCTION,
              },
            },
          )) {
            const rollupCol = await this.retypeRollup(
              linkedCtx,
              rollup,
              ncMeta,
            );
            if (!rollupCol) continue;
            affectedModelCtxMap.set(rollupCol.fk_model_id, linkedCtx);
            // lookups of this rollup embed its SQL in their own models' queries
            await clearSingleQueryCacheForColumnReferences(
              linkedCtx,
              rollupCol,
            );
            enqueue(rollupCol.id, linkedCtx);
          }
        }
      }

      for (const [modelId, modelCtx] of affectedModelCtxMap) {
        await View.clearSingleQueryCache(modelCtx, modelId, null, ncMeta);
      }

      // Realtime: other clients pick up the new result types / error state.
      this.broadcastColumnUpdates(affectedModelCtxMap).catch((e) =>
        this.logger.error(
          `Failed to broadcast column_update events: ${e?.message}`,
          e?.stack,
        ),
      );
    } catch (e) {
      this.logger.error(
        `Failed to re-type rollup formulas over column ${newCol.id}: ${e?.message}`,
        e?.stack,
      );
    }
  }

  // The table's own base, plus each base its links reach.
  private async linkedContexts(
    context: NcContext,
    tableColumns: Column[],
    ncMeta: MetaService,
  ): Promise<NcContext[]> {
    const contexts = [context];
    for (const col of tableColumns) {
      if (!isLinksOrLTAR(col.uidt)) continue;
      const opts = await col.getColOptions<any>(ncMeta);
      if (
        !opts?.fk_related_base_id ||
        contexts.some((c) => c.base_id === opts.fk_related_base_id)
      ) {
        continue;
      }
      contexts.push({ ...context, base_id: opts.fk_related_base_id });
    }
    return contexts;
  }

  // Re-derives a formula's stored tree; true when its type changed.
  private async retypeFormula(
    context: NcContext,
    formula: Column,
    tableColumns: Column[],
    ncMeta: MetaService,
  ): Promise<boolean> {
    const colOptions = await formula.getColOptions<FormulaColumn>(ncMeta);
    const model = await Model.get(context, formula.fk_model_id, false, ncMeta);
    const source = await Source.get(context, model.source_id, false, ncMeta);
    let parsedTree: ParsedFormulaNode;
    try {
      parsedTree = await validateFormulaAndExtractTreeWithType({
        formula: colOptions.formula,
        columns: tableColumns,
        column: formula,
        clientOrSqlUi: source.type as ClientTypeOrSqlUI,
        getMeta: async (metaContext, { id }) => {
          const related = await Model.get(metaContext, id, false, ncMeta);
          await related?.getColumns(ncMeta);
          return related;
        },
      });
    } catch {
      // a formula that no longer fits reports that on its own read
      return false;
    }
    const stored = colOptions.getParsedTree();
    if (JSON.stringify(parsedTree) === JSON.stringify(stored)) return false;
    await FormulaColumn.update(
      context,
      formula.id,
      { parsed_tree: parsedTree },
      ncMeta,
    );
    return parsedTree?.dataType !== stored?.dataType;
  }

  // Re-validates a formula rollup; returns its column when the tree or error
  // changed (and was written).
  private async retypeRollup(
    context: NcContext,
    rollup: RollupColumn,
    ncMeta: MetaService,
  ): Promise<Column | undefined> {
    const column = await Column.get(
      context,
      { colId: rollup.fk_column_id },
      ncMeta,
    );
    if (!column) return undefined;

    const payload: RollupColumnReqType & {
      title: string;
      parsed_tree?: ParsedFormulaNode;
    } = {
      title: column.title,
      uidt: UITypes.Rollup,
      fk_relation_column_id: rollup.fk_relation_column_id,
      fk_rollup_column_id: rollup.fk_rollup_column_id,
      rollup_function: rollup.rollup_function,
      rollup_formula: rollup.rollup_formula,
    };
    let error: string | null = null;
    try {
      await validateRollupPayload(context, payload);
    } catch (e) {
      error = e.message;
    }

    const stored =
      typeof rollup.parsed_tree === 'string'
        ? rollup.parsed_tree
        : JSON.stringify(rollup.parsed_tree);
    if (
      (rollup.error ?? null) === error &&
      (error || JSON.stringify(payload.parsed_tree) === stored)
    ) {
      return undefined;
    }
    await RollupColumn.update(
      context,
      column.id,
      error ? { error } : { parsed_tree: payload.parsed_tree, error: null },
      ncMeta,
    );
    return column;
  }

  private async broadcastColumnUpdates(
    affectedModelCtxMap: Map<string, NcContext>,
  ): Promise<void> {
    for (const [modelId, modelCtx] of affectedModelCtxMap) {
      const model = await Model.getWithInfo(
        modelCtx,
        { id: modelId },
        Noco.ncMeta,
      );
      if (!model) continue;

      NocoSocket.broadcastEvent(modelCtx, {
        event: EventType.META_EVENT,
        payload: {
          action: 'column_update',
          payload: { table: model, column: {}, skipDataReload: true },
        },
      } as Parameters<typeof NocoSocket.broadcastEvent>[1]);
    }
  }
}
