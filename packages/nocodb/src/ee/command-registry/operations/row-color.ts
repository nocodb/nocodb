import { ROW_COLORING_MODE } from 'nocodb-sdk';
import { arrayToNested, parseProp } from 'nocodb-sdk';
import type { COLORING_TYPE } from 'nocodb-sdk';
import type { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { ViewRowColorService } from '~/services/view-row-color.service';
import type {
  rowColoringConditionSnapshotSchema,
  rowColoringSnapshotSchema,
} from '~/command-registry/operations/_schemas/row-color';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import { registerForward } from '~/command-registry/replay-context';
import { scopeView } from '~/command-registry/scope';
import { setReplay } from '~/helpers/replayScope';
import { MetaTable } from '~/utils/globals';
import { Filter, View } from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import { pickFields } from '~/utils/tsUtils';
import {
  rowColorConditionActions,
  rowColoringActions,
} from '~/decorators/trace-command-descriptions';
import Noco from '~/Noco';
import {
  rowColorAddCaptureSchema,
  rowColorConditionAddSchema,
  rowColorConditionDeleteSchema,
  rowColorConditionUpdateSchema,
  rowColoringRemoveSchema,
  rowColoringRestoreSchema,
  rowColorSelectSetSchema,
} from '~/command-registry/operations/_schemas/row-color';

const colDeps = (...ids: ReadonlyArray<string | null | undefined>) =>
  ids
    .filter((id): id is string => !!id)
    .map((id) => ({ entity: MetaTable.COLUMNS, id }));

type RowColorConditionSnapshot = z.infer<
  typeof rowColoringConditionSnapshotSchema
>;
type RowColoringSnapshot = z.infer<typeof rowColoringSnapshotSchema>;

type FilterSnapshotNode = RowColorConditionSnapshot['nestedFilters'][number];

async function snapshotConditionFilters(
  context: NcContext,
  conditionId: string,
): Promise<FilterSnapshotNode[]> {
  const ncMeta = Noco.ncMeta;
  const flat = (await ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.FILTER_EXP,
    { condition: { fk_row_color_condition_id: conditionId } },
  )) as FilterSnapshotNode[];
  flat.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
  return arrayToNested({
    data: flat,
    childAssignHandler: (filter, children) => {
      (filter as FilterSnapshotNode).children =
        children as FilterSnapshotNode[];
    },
    getFkHandler: (filter) => (filter as FilterSnapshotNode).fk_parent_id,
    getIdHandler: (filter) => (filter as FilterSnapshotNode).id,
  }) as FilterSnapshotNode[];
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
        // DB column is `string` but values are constrained to COLORING_TYPE.
        type: cond.type as COLORING_TYPE | undefined,
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

interface RowColorAddExtra {
  rowColorFilterIds?: ReadonlyArray<string>;
}

export const RowColorConditionAddContract: OperationContract<
  typeof rowColorConditionAddSchema,
  RowColorAddExtra,
  RowColorCondition | undefined
> = {
  name: OperationName.rowColorConditionAdd,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: rowColorConditionAddSchema,
  entry: {
    entity_id: 'id',
    parent_id: 'fk_view_id',
    description: rowColorConditionActions.add,
    before: async (context, params) => {
      const view = await View.get(context, params.fk_view_id);
      return { parentEntityTitle: view?.title };
    },
  },
  capture: ['rowColorFilterIds'],
  capture_schema: rowColorAddCaptureSchema,
  sandbox: {
    id_field: 'condition',
    dependencies: (params, result) =>
      colDeps(
        params.condition?.fk_target_column_id,
        result?.fk_target_column_id,
      ),
  },
  undo: {
    inverse: (_context, params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.rowColorConditionDelete,
        params: {
          fk_view_id: params.fk_view_id,
          fk_row_coloring_conditions_id: result.id,
        },
      };
    },
    scope: (params) => scopeView(params.fk_view_id),
  },
};

const CONDITION_PREV_FIELDS = [
  'color',
  'is_set_as_background',
  'nc_order',
  'type',
  'fk_target_column_id',
] as const satisfies readonly (keyof RowColorCondition)[];

// Same as PREV but with `id` — used by the delete snapshot, which carries
// the row's id so the inverse can recreate the same row.
const CONDITION_SNAPSHOT_FIELDS = [
  'id',
  'color',
  'is_set_as_background',
  'nc_order',
  'type',
  'fk_target_column_id',
] as const satisfies readonly (keyof RowColorCondition)[];

type ConditionUpdatePrev = Pick<
  RowColorCondition,
  (typeof CONDITION_PREV_FIELDS)[number]
>;

interface ConditionUpdateExtra {
  fkViewId?: string;
  prev?: ConditionUpdatePrev;
}

export const RowColorConditionUpdateContract: OperationContract<
  typeof rowColorConditionUpdateSchema,
  ConditionUpdateExtra,
  RowColorCondition | undefined
> = {
  name: OperationName.rowColorConditionUpdate,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: rowColorConditionUpdateSchema,
  entry: {
    entity_id: (params) => params.fk_row_coloring_conditions_id,
    description: rowColorConditionActions.edit,
    before: async (context, params) => {
      const cond = await RowColorCondition.getById(
        context,
        params.fk_row_coloring_conditions_id,
      );
      const view = cond?.fk_view_id
        ? await View.get(context, cond.fk_view_id)
        : undefined;
      if (!cond) return { parentEntityTitle: view?.title };
      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: cond.fk_view_id,
          prev: pickFields(cond, CONDITION_PREV_FIELDS),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prev;
      if (!prev) return null;
      // `prev` is `Pick<RowColorCondition, ...>` — body schema's `type`
      // narrows to COLORING_TYPE (model has `string`); cast at the boundary.
      return {
        name: OperationName.rowColorConditionUpdate,
        params: {
          fk_view_id: params.fk_view_id,
          fk_row_coloring_conditions_id: params.fk_row_coloring_conditions_id,
          condition: { ...prev, type: prev.type as COLORING_TYPE | undefined },
        },
      };
    },
    scope: (params, _r, resolved) =>
      scopeView(params.fk_view_id ?? resolved?.extra?.fkViewId),
  },
};

interface ConditionDeleteExtra {
  condition?: RowColorConditionSnapshot & { fk_view_id?: string };
}

export const RowColorConditionDeleteContract: OperationContract<
  typeof rowColorConditionDeleteSchema,
  ConditionDeleteExtra,
  void
> = {
  name: OperationName.rowColorConditionDelete,
  entity: MetaTable.ROW_COLOR_CONDITIONS,
  schema: rowColorConditionDeleteSchema,
  entry: {
    entity_id: (params) => params.fk_row_coloring_conditions_id,
    description: rowColorConditionActions.delete,
    before: async (context, params) => {
      const cond = await RowColorCondition.getById(
        context,
        params.fk_row_coloring_conditions_id,
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
            ...pickFields(cond, CONDITION_SNAPSHOT_FIELDS),
            // DB column is `string` but values are constrained to COLORING_TYPE.
            type: cond.type as COLORING_TYPE | undefined,
            fk_view_id: cond.fk_view_id,
            nestedFilters,
          },
        },
      };
    },
  },
  undo: {
    // Re-add via the forward path; `RowColorCondition.insert` honors the
    // pre-set id under `is_replay`, and the service walks `filters[]`
    // recursively via `children` to rebuild the subtree.
    inverse: (_context, _params, _result, resolved) => {
      const cond = resolved?.extra?.condition;
      if (!cond?.fk_view_id) return null;
      return {
        name: OperationName.rowColorConditionAdd,
        params: {
          fk_view_id: cond.fk_view_id,
          condition: pickFields(cond, CONDITION_SNAPSHOT_FIELDS),
          ...(cond.nestedFilters.length > 0
            ? { filters: cond.nestedFilters }
            : {}),
        },
      };
    },
    // Snapshot in resolved.extra carries `fk_view_id`; the params variant
    // is a backup for schemas that include it directly.
    scope: (params, _r, resolved) =>
      scopeView(
        resolved?.extra?.condition?.fk_view_id ??
          (params as { fk_view_id?: string }).fk_view_id,
      ),
  },
};

interface RowColoringRestoreExtra {
  snapshot?: RowColoringSnapshot;
}

export const RowColorSelectSetContract: OperationContract<
  typeof rowColorSelectSetSchema,
  RowColoringRestoreExtra,
  void
> = {
  name: OperationName.rowColorSelectSet,
  entity: MetaTable.VIEWS,
  schema: rowColorSelectSetSchema,
  entry: {
    entity_id: (params) => params.fk_view_id,
    description: rowColoringActions.selectSet,
    before: async (context, params) => {
      const view = await View.get(context, params.fk_view_id);
      return {
        parentEntityTitle: view?.title,
        extra: {
          snapshot: await snapshotRowColoring(context, params.fk_view_id),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const snapshot = resolved?.extra?.snapshot;
      if (!snapshot) return null;
      return {
        name: OperationName.rowColoringRestore,
        params: { fk_view_id: params.fk_view_id, snapshot },
      };
    },
    scope: (params) => scopeView(params.fk_view_id),
  },
};

export const RowColoringRemoveContract: OperationContract<
  typeof rowColoringRemoveSchema,
  RowColoringRestoreExtra,
  void
> = {
  name: OperationName.rowColoringRemove,
  entity: MetaTable.VIEWS,
  schema: rowColoringRemoveSchema,
  entry: {
    entity_id: (params) => params.fk_view_id,
    description: rowColoringActions.remove,
    before: async (context, params) => {
      const view = await View.get(context, params.fk_view_id);
      return {
        parentEntityTitle: view?.title,
        extra: {
          snapshot: await snapshotRowColoring(context, params.fk_view_id),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const snapshot = resolved?.extra?.snapshot;
      if (!snapshot) return null;
      return {
        name: OperationName.rowColoringRestore,
        params: { fk_view_id: params.fk_view_id, snapshot },
      };
    },
    scope: (params) => scopeView(params.fk_view_id),
  },
};

// Only dispatched by the registry as the
// inverse of `rowColorSelectSet` and `rowColoringRemove`. Wipes the view's
// current row coloring config and rebuilds from the snapshot atomically.

export const RowColoringRestoreContract: OperationContract<
  typeof rowColoringRestoreSchema,
  Record<string, any>,
  void
> = {
  name: OperationName.rowColoringRestore,
  entity: MetaTable.VIEWS,
  schema: rowColoringRestoreSchema,
  entry: {
    entity_id: (params) => params.fk_view_id,
    description: rowColoringActions.restore,
  },
};

export { Filter };

export function registerRowColorHandlers(svc: ViewRowColorService): void {
  OperationRegistry.register(
    RowColorConditionAddContract,
    async (context, params, meta) => {
      const captured = meta.extra?.rowColorFilterIds;
      if (captured?.length) {
        setReplay('rowColorFilterIds', captured);
      }
      return svc.addRowColoringCondition(
        context,
        params as Parameters<typeof svc.addRowColoringCondition>[1],
      );
    },
  );
  registerForward(RowColorConditionUpdateContract, (context, params) =>
    svc.updateRowColoringCondition(context, params),
  );
  registerForward(RowColorConditionDeleteContract, (context, params) =>
    svc.deleteRowColoringCondition(context, params),
  );
  registerForward(RowColorSelectSetContract, (context, params) =>
    svc.setRowColoringSelect(context, params),
  );
  registerForward(RowColoringRemoveContract, (context, params) =>
    svc.removeRowColorInfo(context, params),
  );
  registerForward(RowColoringRestoreContract, (context, params) =>
    svc.restoreRowColoring(context, params),
  );
}
