import type { OperationContract } from '~/command-registry/types';
import type { SortsService } from '~/services/sorts.service';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { scopeView } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Sort, View } from '~/models';
import { sortActions } from '~/decorators/trace-command-descriptions';
import {
  sortCreateSchema,
  sortDeleteSchema,
  sortUpdateSchema,
} from '~/command-registry/operations/_schemas/sort';

type SortDirection = 'asc' | 'desc' | 'count-asc' | 'count-desc' | string;

export const SortCreateContract: OperationContract<
  typeof sortCreateSchema,
  Record<string, any>,
  Sort | undefined
> = {
  name: OperationName.sortCreate,
  entity: MetaTable.SORT,
  schema: sortCreateSchema,
  entry: {
    entity_id: 'id',
    parent_id: 'viewId',
    description: sortActions.add,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const field = params.sort.fk_column_id
        ? await Column.get(context, { colId: params.sort.fk_column_id })
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: { fieldTitle: field?.title, tableTitle: table?.title },
      };
    },
  },
  sandbox: {
    id_field: 'sort',
    dependencies: (_params, result) =>
      result?.fk_column_id
        ? [{ entity: MetaTable.COLUMNS, id: result.fk_column_id }]
        : [],
  },
  undo: {
    inverse: (_context, _params, result) => {
      if (!result?.id) return null;
      return {
        name: OperationName.sortDelete,
        params: { sortId: result.id },
      };
    },
    scope: (params) => scopeView(params.viewId),
  },
};

interface SortUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevSort?: {
    fk_column_id?: string;
    direction?: SortDirection;
  };
}

export const SortUpdateContract: OperationContract<
  typeof sortUpdateSchema,
  SortUpdateExtra,
  Sort | undefined
> = {
  name: OperationName.sortUpdate,
  entity: MetaTable.SORT,
  schema: sortUpdateSchema,
  entry: {
    entity_id: (params) => params.sortId,
    description: sortActions.edit,
    before: async (context, params) => {
      const sort = await Sort.get(context, params.sortId);
      if (!sort) return {};
      const view = sort.fk_view_id
        ? await View.get(context, sort.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const colId = params.sort.fk_column_id ?? sort.fk_column_id;
      const field = colId ? await Column.get(context, { colId }) : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: {
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevSort: {
            fk_column_id: sort.fk_column_id,
            direction: sort.direction,
          },
        },
      };
    },
  },
  sandbox: {
    dependencies: (params, result) => {
      const colId = result?.fk_column_id ?? params.sort.fk_column_id;
      return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevSort;
      if (!prev) return null;
      return {
        name: OperationName.sortUpdate,
        params: { sortId: params.sortId, sort: prev },
      };
    },
    scope: (_p, result) => scopeView(result?.fk_view_id),
  },
};

interface SortDeleteExtra {
  fieldTitle?: string;
  tableTitle?: string;
  deletedSort?: {
    fk_view_id?: string;
    fk_column_id?: string;
    direction?: SortDirection;
  };
}

export const SortDeleteContract: OperationContract<
  typeof sortDeleteSchema,
  SortDeleteExtra,
  boolean
> = {
  name: OperationName.sortDelete,
  entity: MetaTable.SORT,
  schema: sortDeleteSchema,
  entry: {
    entity_id: (params) => params.sortId,
    description: sortActions.delete,
    before: async (context, params) => {
      const sort = await Sort.get(context, params.sortId);
      if (!sort) return {};
      const view = sort.fk_view_id
        ? await View.get(context, sort.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = sort.fk_column_id
        ? await Column.get(context, { colId: sort.fk_column_id })
        : undefined;
      return {
        parentEntityTitle: view?.title,
        extra: {
          fieldTitle: field?.title,
          tableTitle: table?.title,
          deletedSort: {
            fk_view_id: sort.fk_view_id,
            fk_column_id: sort.fk_column_id,
            direction: sort.direction,
          },
        },
      };
    },
  },
  undo: {
    inverse: (_context, _params, _result, resolved) => {
      const deleted = resolved?.extra?.deletedSort;
      if (!deleted?.fk_view_id) return null;
      return {
        name: OperationName.sortCreate,
        params: {
          viewId: deleted.fk_view_id,
          sort: {
            fk_column_id: deleted.fk_column_id,
            direction: deleted.direction,
          },
        },
      };
    },
    scope: (_p, _r, resolved) =>
      scopeView(resolved?.extra?.deletedSort?.fk_view_id),
  },
};

export function registerSortHandlers(svc: SortsService): void {
  registerForward(SortCreateContract, (context, params) =>
    svc.sortCreate(context, params),
  );
  registerForward(SortUpdateContract, (context, params) =>
    svc.sortUpdate(context, params),
  );
  registerForward(SortDeleteContract, (context, params) =>
    svc.sortDelete(context, params),
  );
}
