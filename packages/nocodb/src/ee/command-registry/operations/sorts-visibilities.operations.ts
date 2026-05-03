import { z } from 'zod';
import type { BoolType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Column, Model, Sort, View } from '~/models';
import {
  sortActions,
  viewColumnActions,
} from '~/decorators/trace-command-descriptions';

// ─────────────────────────────────────────────────────────────
// Sort contracts
// ─────────────────────────────────────────────────────────────

const sortBodySchema = z.record(z.unknown());

const sortCreateSchema = z.object({
  viewId: z.string(),
  sort: sortBodySchema,
});

export const SortCreateContract: OperationContract<typeof sortCreateSchema> = {
  name: OperationName.sortCreate,
  version: 1,
  entity: MetaTable.SORT,
  schema: sortCreateSchema,
  idField: 'sort',
  entityId: 'id',
  parentId: 'viewId',
  description: sortActions.add,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const field = (param.sort as any)?.fk_column_id
      ? await Column.get(context, { colId: (param.sort as any).fk_column_id })
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
  deps: (_p, r) =>
    r?.fk_column_id ? [{ entity: MetaTable.COLUMNS, id: r.fk_column_id }] : [],
  // Undo: delete the sort that was just created.
  buildInverse: (_ctx, _p, r) => {
    if (!r?.id) return null;
    return {
      name: OperationName.sortDelete,
      version: 1,
      params: { sortId: r.id },
    };
  },
};

const sortUpdateSchema = z.object({
  sortId: z.string(),
  sort: sortBodySchema,
});

interface SortUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevSort?: {
    fk_column_id?: string;
    direction?: string;
  };
}

export const SortUpdateContract: OperationContract<
  typeof sortUpdateSchema,
  SortUpdateExtra
> = {
  name: OperationName.sortUpdate,
  version: 1,
  entity: MetaTable.SORT,
  schema: sortUpdateSchema,
  entityId: (p) => p.sortId,
  description: sortActions.edit,
  resolveCtx: async (context, param) => {
    const sort = await Sort.get(context, param.sortId);
    if (!sort) return {};
    const view = sort.fk_view_id
      ? await View.get(context, sort.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const colId = (param.sort as any)?.fk_column_id ?? sort.fk_column_id;
    const field = colId ? await Column.get(context, { colId }) : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: {
        fieldTitle: field?.title,
        tableTitle: table?.title,
        // Snapshot for buildInverse — re-applied verbatim on undo.
        prevSort: {
          fk_column_id: sort.fk_column_id,
          direction: sort.direction,
        },
      },
    };
  },
  deps: (p, r) => {
    const colId = r?.fk_column_id ?? (p.sort as any)?.fk_column_id;
    return colId ? [{ entity: MetaTable.COLUMNS, id: colId }] : [];
  },
  // Undo: re-apply the pre-update sort body captured in resolveCtx.
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevSort;
    if (!prev) return null;
    return {
      name: OperationName.sortUpdate,
      version: 1,
      params: { sortId: p.sortId, sort: prev },
    };
  },
};

const sortDeleteSchema = z.object({
  sortId: z.string(),
});

interface SortDeleteExtra {
  fieldTitle?: string;
  tableTitle?: string;
  deletedSort?: {
    fk_view_id?: string;
    fk_column_id?: string;
    direction?: string;
  };
}

export const SortDeleteContract: OperationContract<
  typeof sortDeleteSchema,
  SortDeleteExtra
> = {
  name: OperationName.sortDelete,
  version: 1,
  entity: MetaTable.SORT,
  schema: sortDeleteSchema,
  entityId: (p) => p.sortId,
  description: sortActions.delete,
  resolveCtx: async (context, param) => {
    const sort = await Sort.get(context, param.sortId);
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
  // Undo: recreate the sort.
  buildInverse: (_ctx, _p, _r, resolved) => {
    const deleted = resolved?.extra?.deletedSort;
    if (!deleted?.fk_view_id) return null;
    return {
      name: OperationName.sortCreate,
      version: 1,
      params: {
        viewId: deleted.fk_view_id,
        sort: {
          fk_column_id: deleted.fk_column_id,
          direction: deleted.direction,
        },
      },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// ViewColumn contract
// ─────────────────────────────────────────────────────────────

const viewColumnUpdateSchema = z.object({
  viewId: z.string(),
  columnId: z.string(),
  column: z.record(z.unknown()),
});

interface ViewColumnUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevColumn?: {
    show?: BoolType;
    order?: number;
    underline?: BoolType;
    bold?: BoolType;
    italic?: BoolType;
  };
}

export const ViewColumnUpdateContract: OperationContract<
  typeof viewColumnUpdateSchema,
  ViewColumnUpdateExtra
> = {
  name: OperationName.viewColumnUpdate,
  version: 1,
  entity: MetaTable.GRID_VIEW_COLUMNS,
  schema: viewColumnUpdateSchema,
  entityId: (p) => p.columnId,
  parentId: 'viewId',
  description: viewColumnActions.update,
  resolveCtx: async (context, param) => {
    const view = await View.get(context, param.viewId);
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = param.columnId
      ? await Column.get(context, { colId: param.columnId })
      : undefined;
    const viewCol = await View.getColumn(context, param.viewId, param.columnId);
    return {
      parentEntityTitle: view?.title,
      extra: {
        fieldTitle: field?.title,
        tableTitle: table?.title,
        prevColumn: viewCol
          ? {
              show: viewCol.show,
              order: viewCol.order,
              ...('underline' in viewCol
                ? { underline: viewCol.underline }
                : {}),
              ...('bold' in viewCol ? { bold: viewCol.bold } : {}),
              ...('italic' in viewCol ? { italic: viewCol.italic } : {}),
            }
          : undefined,
      },
    };
  },
  deps: (p) =>
    p.columnId ? [{ entity: MetaTable.COLUMNS, id: p.columnId }] : [],
  // Undo: re-apply prev visibility / order / styling. Covers single show/hide,
  // drag-reorder (`order`), and per-cell formatting (calendar/timeline
  // bold/italic/underline) since they all flow through the same op.
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevColumn;
    if (!prev) return null;
    return {
      name: OperationName.viewColumnUpdate,
      version: 1,
      params: { viewId: p.viewId, columnId: p.columnId, column: prev },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// Show/Hide All + bulk visibility (undo-only inverse)
// ─────────────────────────────────────────────────────────────

const showHideAllSchema = z.object({
  viewId: z.string(),
  ignoreIds: z.array(z.string()).optional(),
  levelId: z.string().optional(),
});

interface ShowHideAllExtra {
  /**
   * Pre-toggle map of view-column id → show flag, captured across all
   * per-type column tables (Grid/Map/...). Lets undo restore the exact
   * mixed state instead of just flipping all-on/all-off.
   */
  prevVisibility?: Record<string, boolean>;
}

async function captureVisibilitySnapshot(
  context: NcContext,
  viewId: string,
): Promise<Record<string, boolean>> {
  const cols = (await View.getColumns(context, viewId)) ?? [];
  return cols.reduce<Record<string, boolean>>((acc, c: any) => {
    if (c?.id != null) acc[c.id] = !!c.show;
    return acc;
  }, {});
}

export const ShowAllColumnsContract: OperationContract<
  typeof showHideAllSchema,
  ShowHideAllExtra
> = {
  name: OperationName.showAllColumns,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: showHideAllSchema,
  entityId: (p) => p.viewId,
  description: () => 'Show all fields',
  resolveCtx: async (context, param) => ({
    extra: {
      prevVisibility: await captureVisibilitySnapshot(context, param.viewId),
    },
  }),
  // Undo: dispatch the bulk-set inverse with the snapshot. Lossless
  // restoration of any prior mixed visibility state.
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevVisibility;
    if (!prev) return null;
    return {
      name: OperationName.viewColumnsBulkSetVisibility,
      version: 1,
      params: { viewId: p.viewId, columnVisibility: prev },
    };
  },
};

export const HideAllColumnsContract: OperationContract<
  typeof showHideAllSchema,
  ShowHideAllExtra
> = {
  name: OperationName.hideAllColumns,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: showHideAllSchema,
  entityId: (p) => p.viewId,
  description: () => 'Hide all fields',
  resolveCtx: async (context, param) => ({
    extra: {
      prevVisibility: await captureVisibilitySnapshot(context, param.viewId),
    },
  }),
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevVisibility;
    if (!prev) return null;
    return {
      name: OperationName.viewColumnsBulkSetVisibility,
      version: 1,
      params: { viewId: p.viewId, columnVisibility: prev },
    };
  },
};

const viewColumnsBulkSetVisibilitySchema = z.object({
  viewId: z.string(),
  columnVisibility: z.record(z.boolean()),
});

/**
 * Internal undo-only primitive — restores an arbitrary per-column visibility
 * map. Has no controller / ACL / operationScope wiring: it's only ever
 * dispatched by the registry as the inverse of `showAllColumns` /
 * `hideAllColumns` (or as its own inverse). The handler is registered in
 * `sorts-visibilities.handlers.ts` and calls `View.updateColumn` directly.
 *
 * No `buildInverse` because undo of an undo (= redo) replays the original
 * forward op directly via the existing log entry — see UndoRedoService.
 */
export const ViewColumnsBulkSetVisibilityContract: OperationContract<
  typeof viewColumnsBulkSetVisibilitySchema
> = {
  name: OperationName.viewColumnsBulkSetVisibility,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: viewColumnsBulkSetVisibilitySchema,
  entityId: (p) => p.viewId,
  description: () => 'Restore field visibility',
};

// ─────────────────────────────────────────────────────────────
// GridColumn contract — grid-specific props (width, group_by, aggregation)
// ─────────────────────────────────────────────────────────────

const gridColumnUpdateSchema = z.object({
  gridViewColumnId: z.string(),
  grid: z.record(z.unknown()),
});

export const GridColumnUpdateContract: OperationContract<
  typeof gridColumnUpdateSchema
> = {
  name: OperationName.gridColumnUpdate,
  version: 1,
  entity: MetaTable.GRID_VIEW_COLUMNS,
  schema: gridColumnUpdateSchema,
  entityId: (p) => p.gridViewColumnId,
  description: viewColumnActions.update,
  resolveCtx: async (context, param) => {
    const { GridViewColumn } = await import('~/models');
    const gridCol = await GridViewColumn.get(context, param.gridViewColumnId);
    if (!gridCol) return {};
    const view = gridCol.fk_view_id
      ? await View.get(context, gridCol.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = gridCol.fk_column_id
      ? await Column.get(context, { colId: gridCol.fk_column_id })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
};

// ─────────────────────────────────────────────────────────────
// FormColumn contract — form-specific props (label, help, required, etc.)
// ─────────────────────────────────────────────────────────────

const formColumnUpdateSchema = z.object({
  formViewColumnId: z.string(),
  formViewColumn: z.record(z.unknown()),
});

export const FormColumnUpdateContract: OperationContract<
  typeof formColumnUpdateSchema
> = {
  name: OperationName.formColumnUpdate,
  version: 1,
  entity: MetaTable.FORM_VIEW_COLUMNS,
  schema: formColumnUpdateSchema,
  entityId: (p) => p.formViewColumnId,
  description: viewColumnActions.update,
  resolveCtx: async (context, param) => {
    const { FormViewColumn } = await import('~/models');
    const formCol = await FormViewColumn.get(context, param.formViewColumnId);
    if (!formCol) return {};
    const view = formCol.fk_view_id
      ? await View.get(context, formCol.fk_view_id)
      : undefined;
    const table = view?.fk_model_id
      ? await Model.get(context, view.fk_model_id)
      : undefined;
    const field = formCol.fk_column_id
      ? await Column.get(context, { colId: formCol.fk_column_id })
      : undefined;
    return {
      parentEntityTitle: view?.title,
      extra: { fieldTitle: field?.title, tableTitle: table?.title },
    };
  },
};
