import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Model, View } from '~/models';
import { filterActions } from '~/decorators/trace-command-descriptions';

// ─── filterCreateV3 ───────────────────────────────────────────────────────────

const filterCreateV3Schema = z.object({
  filter: z.record(z.unknown()),
  viewId: z.string(),
  req: z.any(),
  user: z.any().optional(),
});

export const FilterCreateV3Contract: OperationContract<
  typeof filterCreateV3Schema
> = {
  name: OperationName.filterCreateV3,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterCreateV3Schema,
  idField: 'filter',
  entityId: (_p, r) => r?.filters?.[0]?.id,
  parentId: 'viewId',
  description: filterActions.add,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param?.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const colId = (param?.filter as any)?.fk_column_id;
    const field = colId ? await Column.get(context, { colId }) : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (_p, r) => {
    const colId = r?.filters?.[0]?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
  },
};

// ─── filterReplaceV3 ──────────────────────────────────────────────────────────
// Atomic op: PUT /filters replaces every filter on a view with a new set.
// Recording it as one event keeps changelog small; replay does deleteAll +
// insertFilterGroup to reach the new state on the production base.

const filterReplaceV3Schema = z.object({
  filter: z.record(z.unknown()),
  viewId: z.string(),
  user: z.any().optional(),
});

export const FilterReplaceV3Contract: OperationContract<
  typeof filterReplaceV3Schema
> = {
  name: OperationName.filterReplaceV3,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterReplaceV3Schema,
  parentId: 'viewId',
  description: filterActions.replace,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param?.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { tableTitle: table?.title },
    };
  },
};

// ─── filterDeleteAllV3 ────────────────────────────────────────────────────────
// Atomic op: clears every filter on a view. Used internally by view services
// (e.g. switching view types) and exposed via the V3 controller indirectly.

const filterDeleteAllV3Schema = z.object({
  viewId: z.string(),
});

export const FilterDeleteAllV3Contract: OperationContract<
  typeof filterDeleteAllV3Schema
> = {
  name: OperationName.filterDeleteAllV3,
  version: 1,
  entity: MetaTable.FILTER_EXP,
  schema: filterDeleteAllV3Schema,
  parentId: 'viewId',
  description: filterActions.deleteAll,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param?.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { tableTitle: table?.title },
    };
  },
};
