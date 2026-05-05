import { z } from 'zod';
import { ROW_COLORING_MODE } from 'nocodb-sdk';
import { arrayToNested, parseProp } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Filter, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import {
  rowColorConditionActions,
  rowColoringActions,
} from '~/decorators/trace-command-descriptions';
import Noco from '~/Noco';

interface RowColorConditionSnapshot {
  id: string;
  color: string;
  nc_order: number;
  is_set_as_background: boolean;
  type?: string;
  fk_target_column_id?: string;
  // Filter tree rooted at this condition. Each node may carry `children`.
  nestedFilters: Array<Record<string, unknown>>;
}

interface RowColoringSnapshot {
  row_coloring_mode: string | null;
  meta?: unknown;
  conditions?: RowColorConditionSnapshot[];
}

// Walk the filter rows owned by `conditionId` into a `children`-nested tree.
// Mirrors the shape `ViewRowColorService.insertRowColorFilterSubtree` walks.
async function snapshotConditionFilters(
  context: NcContext,
  conditionId: string,
): Promise<Array<Record<string, unknown>>> {
  const ncMeta = Noco.ncMeta;
  const flat = (await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.FILTER_EXP,
    { condition: { fk_row_color_condition_id: conditionId } },
  )) as Array<Record<string, unknown>>;
  flat.sort(
    (a, b) =>
      ((a.order as number) ?? Infinity) - ((b.order as number) ?? Infinity),
  );
  // arrayToNested attaches matched children to each node's `children` field
  // via the supplied handler. The output is the list of root nodes.
  return arrayToNested({
    data: flat,
    childAssignHandler: (filter: any, children) => (filter.children = children),
    getFkHandler: (filter: any) => filter.fk_parent_id,
    getIdHandler: (filter: any) => filter.id,
  }) as Array<Record<string, unknown>>;
}

async function snapshotRowColoring(
  context: NcContext,
  fkViewId: string,
): Promise<RowColoringSnapshot> {
  const view = await View.get(context, fkViewId);
  if (!view) return { row_coloring_mode: null };

  const mode = view.row_coloring_mode ?? null;

  if (mode === ROW_COLORING_MODE.FILTER) {
    const conditions = await RowColorCondition.getByViewId(context, fkViewId);
    const conditionSnapshots: RowColorConditionSnapshot[] = [];
    for (const cond of conditions) {
      conditionSnapshots.push({
        id: cond.id,
        color: cond.color,
        nc_order: cond.nc_order,
        is_set_as_background: !!cond.is_set_as_background,
        type: cond.type,
        fk_target_column_id: cond.fk_target_column_id,
        nestedFilters: await snapshotConditionFilters(context, cond.id),
      });
    }
    return { row_coloring_mode: mode, conditions: conditionSnapshots };
  }

  if (mode === ROW_COLORING_MODE.SELECT) {
    return { row_coloring_mode: mode, meta: parseProp(view.meta) };
  }

  return { row_coloring_mode: null };
}

// ─── rowColorConditionAdd ────────────────────────────────────────────────────

const conditionBodySchema = z.object({
  color: z.string(),
  is_set_as_background: z.boolean(),
  nc_order: z.number(),
  type: z.string().optional(),
  fk_target_column_id: z.string().optional(),
});

const conditionAddSchema = z.object({
  fk_view_id: z.string(),
  condition: conditionBodySchema.extend({ id: z.string().optional() }),
  filter: z.record(z.unknown()).optional(),
  // Undo of `rowColorConditionDelete` carries the full multi-root tree
  filters: z.array(z.record(z.unknown())).optional(),
});

export const RowColorConditionAddContract: OperationContract<
  typeof conditionAddSchema
> = {
  name: OperationName.rowColorConditionAdd,
  version: 1,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: conditionAddSchema,
  // Service returns `{ id, info }` — `id` lives at the top level.
  entityId: 'id',
  idField: 'condition',
  parentId: 'fk_view_id',
  description: rowColorConditionActions.add,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.fk_view_id);
    return { parentEntityTitle: view?.title };
  },
  buildInverse: (_ctx, p, r) => {
    const newId = (r as { id?: string } | undefined)?.id;
    if (!newId) return null;
    return {
      name: OperationName.rowColorConditionDelete,
      version: 1,
      params: {
        fk_view_id: p.fk_view_id,
        fk_row_coloring_conditions_id: newId,
      },
    };
  },
};

// ─── rowColorConditionUpdate ─────────────────────────────────────────────────

const conditionUpdateSchema = z.object({
  fk_view_id: z.string().optional(),
  fk_row_coloring_conditions_id: z.string(),
  condition: conditionBodySchema,
});

interface ConditionUpdatePrev {
  color: string;
  is_set_as_background: boolean;
  nc_order: number;
  type?: string;
  fk_target_column_id?: string;
}

interface ConditionUpdateExtra {
  prev?: ConditionUpdatePrev;
}

export const RowColorConditionUpdateContract: OperationContract<
  typeof conditionUpdateSchema,
  ConditionUpdateExtra
> = {
  name: OperationName.rowColorConditionUpdate,
  version: 1,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: conditionUpdateSchema,
  entityId: (p) => p.fk_row_coloring_conditions_id,
  description: rowColorConditionActions.edit,
  resolveCtx: async (context, param) => {
    const cond = await RowColorCondition.getById(
      context,
      param.fk_row_coloring_conditions_id,
    );
    const view = cond?.fk_view_id
      ? await View.get(context, cond.fk_view_id)
      : undefined;
    if (!cond) return { parentEntityTitle: view?.title };
    return {
      parentEntityTitle: view?.title,
      extra: {
        prev: {
          color: cond.color,
          is_set_as_background: !!cond.is_set_as_background,
          nc_order: cond.nc_order,
          type: cond.type,
          fk_target_column_id: cond.fk_target_column_id,
        },
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prev;
    if (!prev) return null;
    return {
      name: OperationName.rowColorConditionUpdate,
      version: 1,
      params: {
        fk_view_id: p.fk_view_id,
        fk_row_coloring_conditions_id: p.fk_row_coloring_conditions_id,
        condition: {
          color: prev.color,
          is_set_as_background: prev.is_set_as_background,
          nc_order: prev.nc_order,
          ...(prev.type !== undefined ? { type: prev.type } : {}),
          ...(prev.fk_target_column_id !== undefined
            ? { fk_target_column_id: prev.fk_target_column_id }
            : {}),
        },
      },
    };
  },
};

// ─── rowColorConditionDelete ─────────────────────────────────────────────────

const conditionDeleteSchema = z.object({
  fk_view_id: z.string().optional(),
  fk_row_coloring_conditions_id: z.string(),
});

interface ConditionDeleteExtra {
  // Full snapshot of the condition row + its filter subtree, captured before
  // the delete runs. The inverse re-emits `rowColorConditionAdd` with this.
  condition?: RowColorConditionSnapshot & { fk_view_id?: string };
}

export const RowColorConditionDeleteContract: OperationContract<
  typeof conditionDeleteSchema,
  ConditionDeleteExtra
> = {
  name: OperationName.rowColorConditionDelete,
  version: 1,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: conditionDeleteSchema,
  entityId: (p) => p.fk_row_coloring_conditions_id,
  description: rowColorConditionActions.delete,
  resolveCtx: async (context, param) => {
    const cond = await RowColorCondition.getById(
      context,
      param.fk_row_coloring_conditions_id,
    );
    const view = cond?.fk_view_id
      ? await View.get(context, cond.fk_view_id)
      : undefined;
    if (!cond) return { parentEntityTitle: view?.title };
    const nestedFilters = await snapshotConditionFilters(context, cond.id);
    return {
      parentEntityTitle: view?.title,
      extra: {
        condition: {
          id: cond.id,
          fk_view_id: cond.fk_view_id,
          color: cond.color,
          nc_order: cond.nc_order,
          is_set_as_background: !!cond.is_set_as_background,
          type: cond.type,
          fk_target_column_id: cond.fk_target_column_id,
          nestedFilters,
        },
      },
    };
  },
  // Re-add via the same forward path. The condition's id is preserved
  // (honored by `RowColorCondition.insert` under `is_replay`). The full
  // multi-root filter tree is passed via `filters` — the service iterates
  // each root and `insertRowColorFilterSubtree` recurses through `children`.
  buildInverse: (_ctx, _p, _r, resolved) => {
    const cond = resolved?.extra?.condition;
    if (!cond?.fk_view_id) return null;
    return {
      name: OperationName.rowColorConditionAdd,
      version: 1,
      params: {
        fk_view_id: cond.fk_view_id,
        condition: {
          id: cond.id,
          color: cond.color,
          is_set_as_background: cond.is_set_as_background,
          nc_order: cond.nc_order,
          ...(cond.type !== undefined ? { type: cond.type } : {}),
          ...(cond.fk_target_column_id !== undefined
            ? { fk_target_column_id: cond.fk_target_column_id }
            : {}),
        },
        ...(cond.nestedFilters.length > 0
          ? { filters: cond.nestedFilters }
          : {}),
      },
    };
  },
};

// ─── rowColorSelectSet ───────────────────────────────────────────────────────

const selectSetSchema = z.object({
  fk_view_id: z.string(),
  fk_column_id: z.string(),
  is_set_as_background: z.boolean(),
});

interface RowColoringRestoreExtra {
  snapshot?: RowColoringSnapshot;
}

export const RowColorSelectSetContract: OperationContract<
  typeof selectSetSchema,
  RowColoringRestoreExtra
> = {
  name: OperationName.rowColorSelectSet,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: selectSetSchema,
  entityId: (p) => p.fk_view_id,
  description: rowColoringActions.selectSet,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.fk_view_id);
    return {
      parentEntityTitle: view?.title,
      extra: { snapshot: await snapshotRowColoring(context, param.fk_view_id) },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const snapshot = resolved?.extra?.snapshot;
    if (!snapshot) return null;
    return {
      name: OperationName.rowColoringRestore,
      version: 1,
      params: { fk_view_id: p.fk_view_id, snapshot },
    };
  },
};

// ─── rowColoringRemove ───────────────────────────────────────────────────────

const removeSchema = z.object({
  fk_view_id: z.string(),
});

export const RowColoringRemoveContract: OperationContract<
  typeof removeSchema,
  RowColoringRestoreExtra
> = {
  name: OperationName.rowColoringRemove,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: removeSchema,
  entityId: (p) => p.fk_view_id,
  description: rowColoringActions.remove,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.fk_view_id);
    return {
      parentEntityTitle: view?.title,
      extra: { snapshot: await snapshotRowColoring(context, param.fk_view_id) },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const snapshot = resolved?.extra?.snapshot;
    if (!snapshot) return null;
    return {
      name: OperationName.rowColoringRestore,
      version: 1,
      params: { fk_view_id: p.fk_view_id, snapshot },
    };
  },
};

// ─── rowColoringRestore (private primitive) ──────────────────────────────────
// Only dispatched by the registry as the
// inverse of `rowColorSelectSet` and `rowColoringRemove`. Wipes the view's
// current row coloring config and rebuilds from the snapshot atomically.

const restoreSchema = z.object({
  fk_view_id: z.string(),
  snapshot: z.object({
    row_coloring_mode: z.union([z.string(), z.null()]),
    meta: z.unknown().optional(),
    conditions: z.array(z.record(z.unknown())).optional(),
  }),
});

export const RowColoringRestoreContract: OperationContract<
  typeof restoreSchema
> = {
  name: OperationName.rowColoringRestore,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: restoreSchema,
  entityId: (p) => p.fk_view_id,
  description: rowColoringActions.restore,
};

export { Filter };
