import { RelationTypes, UITypes } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type Model from '~/models/Model';
import type { PlanColumnMeta, PlanMetaResolver } from './types';
import Column from '~/models/Column';
import LookupColumn from '~/models/LookupColumn';
import RollupColumn from '~/models/RollupColumn';
import FormulaColumn from '~/models/FormulaColumn';
import LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import { loadLookupSortAndLimit } from '~/db/lookupSortLimit';

const TO_MANY = new Set<string>([
  RelationTypes.HAS_MANY,
  RelationTypes.MANY_TO_MANY,
]);

/**
 * Production adapter: column metadata → PlanColumnMeta. Read-only and
 * memoised per resolver instance. Uses each option model's typed `read()`
 * rather than `getColOptions<T>()`, which resolves to `any` through
 * `Column<any>` and cannot take type arguments.
 *
 * Cross-base chains resolve against the root context — enough for cost
 * planning; the emitter keeps its own per-hop contexts.
 */
export function makeColumnMetaResolver(context: NcContext): PlanMetaResolver {
  const cache = new Map<string, Promise<PlanColumnMeta | undefined>>();

  const resolve = async (
    columnId: string,
  ): Promise<PlanColumnMeta | undefined> => {
    const column = await Column.get(context, { colId: columnId }).catch(
      () => null,
    );
    if (!column) return undefined;

    switch (column.uidt) {
      case UITypes.Lookup: {
        const opts = await LookupColumn.read(context, column.id);
        if (!opts) return { uidt: column.uidt };
        const relation = await LinkToAnotherRecordColumn.read(
          context,
          opts.fk_relation_column_id,
        );
        const lookupCfg = await loadLookupSortAndLimit(context, column);
        return {
          uidt: column.uidt,
          isArray: TO_MANY.has(relation?.type),
          hasSortLimitConfig: lookupCfg.hasConfig,
          targetColumnId: opts.fk_lookup_column_id,
        };
      }
      case UITypes.LinkToAnotherRecord:
      case UITypes.Links: {
        const opts = await LinkToAnotherRecordColumn.read(context, column.id);
        if (!opts) return { uidt: column.uidt };
        const relatedTable = await opts.getRelatedTable(context);
        const relatedColumns = await relatedTable.getColumns(context);
        return {
          uidt: column.uidt,
          isArray: TO_MANY.has(opts.type),
          targetColumnId: relatedColumns?.find((c) => c.pv)?.id,
        };
      }
      case UITypes.Rollup: {
        const opts = await RollupColumn.read(context, column.id);
        if (!opts) return { uidt: column.uidt };
        return {
          uidt: column.uidt,
          isArray: true,
          targetColumnId: opts.fk_rollup_column_id,
        };
      }
      case UITypes.Formula:
      case UITypes.Button: {
        const opts = await FormulaColumn.read(context, column.id);
        // hoistFormulaLookup keys its block on this model's PK and bails
        // without one, so the plan must see the same condition.
        const model = await column
          .getModel(context)
          .catch(() => null as Model | null);
        if (model) await model.getColumns(context).catch(() => null);
        return {
          uidt: column.uidt,
          formulaTree: opts?.getParsedTree(),
          hasPrimaryKey: !!model?.primaryKey?.column_name,
        };
      }
      default:
        return { uidt: column.uidt };
    }
  };

  return (columnId) => {
    if (!cache.has(columnId)) cache.set(columnId, resolve(columnId));
    return cache.get(columnId)!;
  };
}
