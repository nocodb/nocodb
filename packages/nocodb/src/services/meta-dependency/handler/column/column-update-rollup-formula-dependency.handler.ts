import { Injectable, Logger } from '@nestjs/common';
import {
  EventType,
  isLinksOrLTAR,
  isRollupFormula,
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
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import { FormulaColumn, Model, RollupColumn, Source, View } from '~/models';
import Column from '~/models/Column';
import { MetaTable } from '~/utils/globals';
import NocoSocket from '~/socket/NocoSocket';
import Noco from '~/Noco';
import { NcBaseError, NcBaseErrorv2 } from '~/helpers/catchError';
import { validateRollupPayload } from '~/helpers/columnHelpers';
import { getFormulasReferredTheColumn } from '~/helpers/formulaHelpers';
import { clearSingleQueryCacheForColumnReferences } from '~/helpers/singleQueryCacheInvalidator';

// fields whose `error` the trash / delete cascade owns
const CASCADE_ERROR_UIDTS: string[] = [
  UITypes.Lookup,
  UITypes.Rollup,
  UITypes.QrCode,
  UITypes.Barcode,
];

/**
 * A formula rollup stores the type of `values` (`parsed_tree`). When a field
 * changes, is restored or becomes a display value, the formula rollups that
 * read it — directly, through formulas, lookups, links or other rollups, in
 * this base or a linked one — are re-typed, or error-marked when the formula
 * no longer fits. Errors are logged, not thrown: the update has committed.
 */
@Injectable()
export class ColumnUpdateRollupFormulaDependencyHandler
  implements MetaEventHandler
{
  private readonly logger = new Logger(
    ColumnUpdateRollupFormulaDependencyHandler.name,
  );

  // COLUMN_ADDED: a restored field (or formula rollup) is re-checked;
  // COLUMN_DELETED: a deleted field may have been a link's display value
  triggerMetaEvents: MetaEventType[] = [
    MetaEventType.COLUMN_UPDATED,
    MetaEventType.COLUMN_PRIMARY_UPDATED,
    MetaEventType.COLUMN_ADDED,
    MetaEventType.COLUMN_DELETED,
  ];

  async getAffectedDependency(
    context: NcContext,
    param: MetaDependencyEventRequest,
    ncMeta = Noco.ncMeta,
  ): Promise<AffectedDependencyResult | undefined> {
    const newCol = param.newEntity ?? param.oldEntity;
    if (!newCol?.id) return undefined;

    // runs on every column update: a failing probe must not roll back the
    // other handlers' work in the shared transaction
    try {
      // Probe — only bases holding a formula rollup can be affected.
      const columns = await Column.list(
        context,
        { fk_model_id: newCol.fk_model_id },
        ncMeta,
      );
      for (const ctx of await this.linkedContexts(context, columns, ncMeta)) {
        const rows = await ncMeta.metaList2(
          ctx.workspace_id,
          ctx.base_id,
          MetaTable.COL_ROLLUP,
          {
            condition: { rollup_function: ROLLUP_FORMULA_FUNCTION },
            limit: 1,
          },
        );
        if (rows.length) return {};
      }
    } catch (e) {
      this.logger.error(
        `Failed to probe rollup formulas over column ${newCol.id}: ${e?.message}`,
        e?.stack,
      );
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
    const newCol = (param.newEntity ?? param.oldEntity) as Column;
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

      // A deleted field has no dependents left to walk, but a link that used
      // it as its display value was reset to the table's own: re-check them.
      if (param.eventType === MetaEventType.COLUMN_DELETED) {
        const tableColumns = await Column.list(
          context,
          { fk_model_id: newCol.fk_model_id },
          ncMeta,
        );
        for (const linkedCtx of await this.linkedContexts(
          context,
          tableColumns,
          ncMeta,
        )) {
          for (const row of await ncMeta.metaList2(
            linkedCtx.workspace_id,
            linkedCtx.base_id,
            MetaTable.COL_RELATIONS,
            { condition: { fk_related_model_id: newCol.fk_model_id } },
          )) {
            enqueue(row.fk_column_id, linkedCtx);
          }
        }
      } else {
        enqueue(newCol.id, context);
      }

      // A restored / added formula rollup is re-checked itself.
      if (
        newCol.uidt === UITypes.Rollup &&
        param.eventType !== MetaEventType.COLUMN_DELETED
      ) {
        const rollup = await RollupColumn.read(context, newCol.id, ncMeta);
        if (isRollupFormula(rollup)) {
          await this.retypeRollup(context, rollup, ncMeta);
          affectedModelCtxMap.set(newCol.fk_model_id, context);
        }
      }

      // BFS over the fields whose type may have changed: the updated one,
      // then every formula, lookup, link and rollup that passes it on.
      while (queue.length > 0) {
        const { fk_column_id: id, context: ctx } = queue.shift();
        const column = await Column.get(ctx, { colId: id }, ncMeta);
        if (!column) continue;

        // Formulas read only their own table. `Column.update` has just
        // cleared their trees; re-derive them so rollups over them type right.
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
          await this.retypeFormula(ctx, formula, tableColumns, ncMeta);
          enqueue(formula.id, ctx);
        }

        for (const linkedCtx of await this.linkedContexts(
          ctx,
          tableColumns,
          ncMeta,
        )) {
          const list = (table: MetaTable, condition: Record<string, string>) =>
            ncMeta.metaList2(linkedCtx.workspace_id, linkedCtx.base_id, table, {
              condition,
            });

          for (const row of await list(MetaTable.COL_LOOKUP, {
            fk_lookup_column_id: id,
          })) {
            enqueue(row.fk_column_id, linkedCtx);
          }

          // A link reads as its records' display value, or its own override.
          for (const row of [
            ...(column.pv
              ? await list(MetaTable.COL_RELATIONS, {
                  fk_related_model_id: column.fk_model_id,
                })
              : []),
            ...(await list(MetaTable.COL_RELATIONS, {
              fk_display_value_column_id: id,
            })),
          ]) {
            enqueue(row.fk_column_id, linkedCtx);
          }

          // Every rollup over the field: formula ones are re-typed, plain
          // min / max pass the type on, and any of them may embed new SQL.
          for (const rollup of await list(MetaTable.COL_ROLLUP, {
            fk_rollup_column_id: id,
          })) {
            const rollupCol = await Column.get(
              linkedCtx,
              { colId: rollup.fk_column_id },
              ncMeta,
            );
            if (!rollupCol) continue;
            // one broken rollup must not stop the others being re-typed
            let retyped = false;
            try {
              retyped =
                isRollupFormula(rollup) &&
                (await this.retypeRollup(linkedCtx, rollup, ncMeta));
            } catch (e) {
              this.logger.error(
                `Failed to re-type rollup ${rollupCol.id}: ${e?.message}`,
                e?.stack,
              );
            }
            if (retyped) {
              // lookups of this rollup embed its SQL in their own queries
              await clearSingleQueryCacheForColumnReferences(
                linkedCtx,
                rollupCol,
              );
            }
            affectedModelCtxMap.set(rollupCol.fk_model_id, linkedCtx);
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
      const opts = await col.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
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

  // Re-derives a formula's stored tree (cleared by `Column.update`).
  private async retypeFormula(
    context: NcContext,
    formula: Column,
    tableColumns: Column[],
    ncMeta: MetaService,
  ): Promise<void> {
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
      return;
    }
    if (
      JSON.stringify(parsedTree) === JSON.stringify(colOptions.getParsedTree())
    ) {
      return;
    }
    await FormulaColumn.update(
      context,
      formula.id,
      { parsed_tree: parsedTree },
      ncMeta,
    );
  }

  // True when the rollup's link or target is trashed or cascade-errored: the
  // trash system owns its error then, and restores re-check it.
  private async upstreamBroken(
    context: NcContext,
    rollup: RollupColumn,
    ncMeta: MetaService,
  ): Promise<boolean> {
    const relation = await Column.get(
      context,
      { colId: rollup.fk_relation_column_id, includeDeleted: true },
      ncMeta,
    );
    if (!relation || relation.deleted) return true;
    const relationOptions =
      await relation.getColOptions<LinkToAnotherRecordColumn>(ncMeta);
    const refContext = relationOptions?.getRelContext?.().refContext ?? context;
    const target = await Column.get(
      refContext,
      { colId: rollup.fk_rollup_column_id, includeDeleted: true },
      ncMeta,
    );
    if (!target || target.deleted) return true;
    if (!CASCADE_ERROR_UIDTS.includes(target.uidt)) return false;
    return !!(await target.getColOptions<{ error?: string }>(ncMeta))?.error;
  }

  // Re-validates a formula rollup; true when its tree or error changed (and
  // was written).
  private async retypeRollup(
    context: NcContext,
    rollup: RollupColumn,
    ncMeta: MetaService,
  ): Promise<boolean> {
    if (await this.upstreamBroken(context, rollup, ncMeta)) return false;
    const column = await Column.get(
      context,
      { colId: rollup.fk_column_id },
      ncMeta,
    );
    if (!column) return false;

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
      await validateRollupPayload(context, payload, ncMeta);
    } catch (e) {
      // only a formula that no longer fits is the rollup's error
      if (!(e instanceof NcBaseErrorv2 || e instanceof NcBaseError)) throw e;
      error = e.message;
    }

    const stored =
      typeof rollup.parsed_tree === 'string'
        ? rollup.parsed_tree
        : JSON.stringify(rollup.parsed_tree);
    if (
      (rollup.error || null) === error &&
      (error || JSON.stringify(payload.parsed_tree) === stored)
    ) {
      return false;
    }
    await RollupColumn.update(
      context,
      column.id,
      error ? { error } : { parsed_tree: payload.parsed_tree, error: null },
      ncMeta,
    );
    return true;
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
