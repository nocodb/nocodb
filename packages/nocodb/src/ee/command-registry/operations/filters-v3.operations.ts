import { z } from 'zod';
import { MetaTable } from '~/utils/globals';
import { Column, Model, View } from '~/models';
import type { OperationContract } from 'src/command-registry/_types';
import { filterActions } from '~/decorators/trace-command-descriptions';

// ─── filterCreateV3 ───────────────────────────────────────────────────────────

const filterCreateV3Schema = z.object({
  filter: z.record(z.unknown()),
  viewId: z.string(),
  req: z.any(),
  user: z.any().optional(),
});

export const FilterCreateV3Contract: OperationContract<typeof filterCreateV3Schema> = {
  name: 'filterCreateV3',
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
