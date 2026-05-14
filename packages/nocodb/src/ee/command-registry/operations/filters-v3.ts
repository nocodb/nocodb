import {
  filterCreateV3Schema,
  filterDeleteAllV3Schema,
  filterReplaceV3Schema,
} from './_schemas/filters-v3';
import type { OperationContract } from '~/command-registry/types';
import type { FiltersV3Service } from '~/services/v3/filters-v3.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { MetaTable } from '~/utils/globals';
import { Column, Model, View } from '~/models';
import { filterActions } from '~/decorators/trace-command-descriptions';

interface FilterV3Result {
  filters?: Array<{ id?: string; fk_column_id?: string }>;
}

export const FilterCreateV3Contract: OperationContract<
  typeof filterCreateV3Schema,
  Record<string, any>,
  FilterV3Result | undefined
> = {
  name: OperationName.filterCreateV3,
  entity: MetaTable.FILTER_EXP,
  schema: filterCreateV3Schema,
  entry: {
    entity_id: (_params, result) => result?.filters?.[0]?.id,
    parent_id: 'viewId',
    description: filterActions.add,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      // Field-id only present when the body is a leaf (group bodies have no
      // `field_id`). Narrow via `in` guard.
      const colId =
        'field_id' in params.filter ? params.filter.field_id : undefined;
      const field = colId ? await Column.get(context, { colId }) : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
      };
    },
  },
  sandbox: {
    id_field: 'filter',
    dependencies: (_params, result) => {
      const colId = result?.filters?.[0]?.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
  },
};

// Atomic op: PUT /filters replaces every filter on a view with a new set.
// Recording it as one event keeps changelog small; replay does deleteAll +
// insertFilterGroup to reach the new state on the production base.

export const FilterReplaceV3Contract: OperationContract<
  typeof filterReplaceV3Schema,
  Record<string, any>,
  FilterV3Result | undefined
> = {
  name: OperationName.filterReplaceV3,
  entity: MetaTable.FILTER_EXP,
  schema: filterReplaceV3Schema,
  entry: {
    parent_id: 'viewId',
    description: filterActions.replace,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { tableTitle: table?.title },
      };
    },
  },
};

// Atomic op: clears every filter on a view. Used internally by view services
// (e.g. switching view types) and exposed via the V3 controller indirectly.

export const FilterDeleteAllV3Contract: OperationContract<
  typeof filterDeleteAllV3Schema,
  Record<string, any>,
  void
> = {
  name: OperationName.filterDeleteAllV3,
  entity: MetaTable.FILTER_EXP,
  schema: filterDeleteAllV3Schema,
  entry: {
    parent_id: 'viewId',
    description: filterActions.deleteAll,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { tableTitle: table?.title },
      };
    },
  },
};

export function registerFiltersV3Handlers(svc: FiltersV3Service): void {
  registerForward(FilterCreateV3Contract, (context, params) =>
    svc.filterCreate(context, params),
  );
  registerForward(FilterReplaceV3Contract, (context, params) =>
    svc.filterReplace(context, params),
  );
  registerForward(FilterDeleteAllV3Contract, (context, params) =>
    svc.filterDeleteAll(context, params),
  );
}
