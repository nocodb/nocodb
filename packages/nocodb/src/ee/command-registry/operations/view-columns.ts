import type { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from '~/command-registry/types';
import type { FormColumnsService } from '~/services/form-columns.service';
import type { GanttColumnsService } from '~/services/gantt-columns.service';
import type { GridColumnsService } from '~/services/grid-columns.service';
import type { ListColumnsService } from '~/services/list-columns.service';
import type { TimelineColumnsService } from '~/services/timeline-columns.service';
import type { ViewColumnsService } from '~/services/view-columns.service';
import type { ViewsService } from '~/services/views.service';
import type { viewColumnBodySchema } from '~/command-registry/operations/_schemas/view-column';
import { OperationName } from '~/command-registry/op-names';
import { registerForward } from '~/command-registry/replay-context';
import { scopeView } from '~/command-registry/scope';
import { MetaTable } from '~/utils/globals';
import {
  Column,
  FormViewColumn,
  GanttViewColumn,
  GridViewColumn,
  ListViewColumn,
  Model,
  TimelineViewColumn,
  View,
} from '~/models';
import { pickFieldsIfPresent } from '~/utils/tsUtils';
import { viewColumnActions } from '~/decorators/trace-command-descriptions';
import {
  formColumnUpdateSchema,
  ganttColumnUpdateSchema,
  gridColumnUpdateSchema,
  listColumnUpdateSchema,
  showHideAllSchema,
  timelineColumnUpdateSchema,
  viewColumnsBulkSetVisibilitySchema,
  viewColumnUpdateSchema,
} from '~/command-registry/operations/_schemas/view-column';

interface ViewColumnUpdateExtra {
  fieldTitle?: string;
  tableTitle?: string;
  prevColumn?: z.infer<typeof viewColumnBodySchema>;
}

// Covers single show/hide, drag-reorder (`order`), and per-cell formatting
// (calendar/timeline bold/italic/underline) — they all flow through this op.
export const ViewColumnUpdateContract: OperationContract<
  typeof viewColumnUpdateSchema,
  ViewColumnUpdateExtra,
  unknown
> = {
  name: OperationName.viewColumnUpdate,
  entity: MetaTable.GRID_VIEW_COLUMNS,
  schema: viewColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.columnId,
    parent_id: 'viewId',
    description: viewColumnActions.update,
    before: async (context, params) => {
      const view = await View.get(context, params.viewId);
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = params.columnId
        ? await Column.get(context, { colId: params.columnId })
        : undefined;
      const viewCol = await View.getColumn(
        context,
        params.viewId,
        params.columnId,
      );
      // SDK `BoolType = number | boolean | null` is broader than the schema's
      // `boolean | 0 | 1 | null`. DB only ever stores the narrower set, so the
      // narrowing cast is sound — keeps the wire-format strict.
      type NarrowBool = boolean | 0 | 1 | null;
      return {
        parentEntityTitle: view?.title,
        extra: {
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevColumn: viewCol
            ? {
                show: viewCol.show as NarrowBool,
                order: viewCol.order,
                ...('underline' in viewCol
                  ? { underline: viewCol.underline as NarrowBool }
                  : {}),
                ...('bold' in viewCol
                  ? { bold: viewCol.bold as NarrowBool }
                  : {}),
                ...('italic' in viewCol
                  ? { italic: viewCol.italic as NarrowBool }
                  : {}),
              }
            : undefined,
        },
      };
    },
  },
  sandbox: {
    dependencies: (params) =>
      params.columnId
        ? [{ entity: MetaTable.COLUMNS, id: params.columnId }]
        : [],
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevColumn;
      if (!prev) return null;
      return {
        name: OperationName.viewColumnUpdate,
        params: {
          viewId: params.viewId,
          columnId: params.columnId,
          column: prev,
        },
      };
    },
    scope: (params) => scopeView(params.viewId),
  },
};

interface ShowHideAllExtra {
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
  ShowHideAllExtra,
  boolean
> = {
  name: OperationName.showAllColumns,
  entity: MetaTable.VIEWS,
  schema: showHideAllSchema,
  entry: {
    entity_id: (params) => params.viewId,
    description: () => 'Show all fields',
    before: async (context, params) => ({
      extra: {
        prevVisibility: await captureVisibilitySnapshot(context, params.viewId),
      },
    }),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevVisibility;
      if (!prev) return null;
      return {
        name: OperationName.viewColumnsBulkSetVisibility,
        params: { viewId: params.viewId, columnVisibility: prev },
      };
    },
    scope: (params) => scopeView(params.viewId),
  },
};

export const HideAllColumnsContract: OperationContract<
  typeof showHideAllSchema,
  ShowHideAllExtra,
  boolean
> = {
  name: OperationName.hideAllColumns,
  entity: MetaTable.VIEWS,
  schema: showHideAllSchema,
  entry: {
    entity_id: (params) => params.viewId,
    description: () => 'Hide all fields',
    before: async (context, params) => ({
      extra: {
        prevVisibility: await captureVisibilitySnapshot(context, params.viewId),
      },
    }),
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevVisibility;
      if (!prev) return null;
      return {
        name: OperationName.viewColumnsBulkSetVisibility,
        params: { viewId: params.viewId, columnVisibility: prev },
      };
    },
    scope: (params) => scopeView(params.viewId),
  },
};

export const ViewColumnsBulkSetVisibilityContract: OperationContract<
  typeof viewColumnsBulkSetVisibilitySchema,
  Record<string, any>,
  boolean
> = {
  name: OperationName.viewColumnsBulkSetVisibility,
  entity: MetaTable.VIEWS,
  schema: viewColumnsBulkSetVisibilitySchema,
  entry: {
    entity_id: (params) => params.viewId,
    description: () => 'Restore field visibility',
  },
};

type GridColumnBody = z.infer<typeof gridColumnUpdateSchema>['grid'];

interface GridColumnUpdateExtra {
  /** Owning view — captured by `before` so `scope` reads it without a refetch. */
  fkViewId?: string;
  fieldTitle?: string;
  tableTitle?: string;
  prevGrid?: Partial<GridColumnBody>;
}

export const GridColumnUpdateContract: OperationContract<
  typeof gridColumnUpdateSchema,
  GridColumnUpdateExtra,
  unknown
> = {
  name: OperationName.gridColumnUpdate,
  entity: MetaTable.GRID_VIEW_COLUMNS,
  schema: gridColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.gridViewColumnId,
    description: viewColumnActions.update,
    before: async (context, params) => {
      const gridCol = await GridViewColumn.get(
        context,
        params.gridViewColumnId,
      );
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

      const prevGrid = pickFieldsIfPresent(
        gridCol,
        [
          'show',
          'order',
          'width',
          'group_by',
          'group_by_order',
          'group_by_sort',
          'aggregation',
        ] as const,
        params.grid ?? {},
      ) as Partial<GridColumnBody>;

      // Service-side AJV validator on `group_by_order` requires a number;
      // legacy rows have null. Service treats null as 0 at runtime, so
      // mirror that on the snapshot to keep undo replayable.
      if (
        prevGrid &&
        prevGrid.group_by_order == null &&
        'group_by_order' in prevGrid
      ) {
        prevGrid.group_by_order = 0;
      }

      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: gridCol.fk_view_id,
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevGrid,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevGrid;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.gridColumnUpdate,
        params: { gridViewColumnId: params.gridViewColumnId, grid: prev },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

type FormColumnBody = z.infer<typeof formColumnUpdateSchema>['formViewColumn'];

interface FormColumnUpdateExtra {
  fkViewId?: string;
  fieldTitle?: string;
  tableTitle?: string;
  prevFormColumn?: Partial<FormColumnBody>;
}

export const FormColumnUpdateContract: OperationContract<
  typeof formColumnUpdateSchema,
  FormColumnUpdateExtra,
  unknown
> = {
  name: OperationName.formColumnUpdate,
  entity: MetaTable.FORM_VIEW_COLUMNS,
  schema: formColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.formViewColumnId,
    description: viewColumnActions.update,
    before: async (context, params) => {
      const formCol = await FormViewColumn.get(
        context,
        params.formViewColumnId,
      );
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

      const prevFormColumn = pickFieldsIfPresent(
        formCol,
        [
          'label',
          'help',
          'description',
          'required',
          'enable_scanner',
          'show',
          'order',
          'meta',
        ] as const,
        params.formViewColumn ?? {},
      ) as Partial<FormColumnBody>;

      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: formCol.fk_view_id,
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevFormColumn,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevFormColumn;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.formColumnUpdate,
        params: {
          formViewColumnId: params.formViewColumnId,
          formViewColumn: prev,
        },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

// ── Type-specific column-update contracts for Timeline / Gantt / List ──────
//
// These three view types share GridColumnReqType server-side. In practice
// only the group_by_* fields (and `show` / `order` for visibility/reorder
// when routed here) are exercised — width/aggregation are Grid/List-only
// surfaces, but the schema accepts them so undo round-trips cleanly.
//
// Same shape as GridColumnUpdateContract: snapshot prior body via `before`,
// restore via inverse. Each carries its own `entity` MetaTable so audit
// rows and cache scopes resolve correctly.

type TimelineColumnBody = z.infer<
  typeof timelineColumnUpdateSchema
>['timeline'];

interface TimelineColumnUpdateExtra {
  fkViewId?: string;
  fieldTitle?: string;
  tableTitle?: string;
  prevTimeline?: Partial<TimelineColumnBody>;
}

export const TimelineColumnUpdateContract: OperationContract<
  typeof timelineColumnUpdateSchema,
  TimelineColumnUpdateExtra,
  unknown
> = {
  name: OperationName.timelineColumnUpdate,
  entity: MetaTable.TIMELINE_VIEW_COLUMNS,
  schema: timelineColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.timelineViewColumnId,
    description: viewColumnActions.update,
    before: async (context, params) => {
      const timelineCol = await TimelineViewColumn.get(
        context,
        params.timelineViewColumnId,
      );
      if (!timelineCol) return {};
      const view = timelineCol.fk_view_id
        ? await View.get(context, timelineCol.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = timelineCol.fk_column_id
        ? await Column.get(context, { colId: timelineCol.fk_column_id })
        : undefined;

      // Timeline column model has no `width` (chart UI, not resizable). The
      // schema accepts the full GridColumnReq surface, but the snapshot only
      // covers fields the model actually stores so undo round-trips cleanly.
      const prevTimeline = pickFieldsIfPresent(
        timelineCol,
        [
          'show',
          'order',
          'group_by',
          'group_by_order',
          'group_by_sort',
          'aggregation',
        ] as const,
        params.timeline ?? {},
      ) as Partial<TimelineColumnBody>;

      // Mirror GridColumnUpdate's group_by_order normalization — legacy rows
      // can carry null but the AJV validator on replay requires a number.
      if (
        prevTimeline &&
        prevTimeline.group_by_order == null &&
        'group_by_order' in prevTimeline
      ) {
        prevTimeline.group_by_order = 0;
      }

      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: timelineCol.fk_view_id,
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevTimeline,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevTimeline;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.timelineColumnUpdate,
        params: {
          timelineViewColumnId: params.timelineViewColumnId,
          timeline: prev,
        },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

type GanttColumnBody = z.infer<typeof ganttColumnUpdateSchema>['gantt'];

interface GanttColumnUpdateExtra {
  fkViewId?: string;
  fieldTitle?: string;
  tableTitle?: string;
  prevGantt?: Partial<GanttColumnBody>;
}

export const GanttColumnUpdateContract: OperationContract<
  typeof ganttColumnUpdateSchema,
  GanttColumnUpdateExtra,
  unknown
> = {
  name: OperationName.ganttColumnUpdate,
  entity: MetaTable.GANTT_VIEW_COLUMNS,
  schema: ganttColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.ganttViewColumnId,
    description: viewColumnActions.update,
    before: async (context, params) => {
      const ganttCol = await GanttViewColumn.get(
        context,
        params.ganttViewColumnId,
      );
      if (!ganttCol) return {};
      const view = ganttCol.fk_view_id
        ? await View.get(context, ganttCol.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = ganttCol.fk_column_id
        ? await Column.get(context, { colId: ganttCol.fk_column_id })
        : undefined;

      // Gantt column model has no `width` (chart UI, not resizable).
      const prevGantt = pickFieldsIfPresent(
        ganttCol,
        [
          'show',
          'order',
          'group_by',
          'group_by_order',
          'group_by_sort',
          'aggregation',
        ] as const,
        params.gantt ?? {},
      ) as Partial<GanttColumnBody>;

      if (
        prevGantt &&
        prevGantt.group_by_order == null &&
        'group_by_order' in prevGantt
      ) {
        prevGantt.group_by_order = 0;
      }

      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: ganttCol.fk_view_id,
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevGantt,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevGantt;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.ganttColumnUpdate,
        params: {
          ganttViewColumnId: params.ganttViewColumnId,
          gantt: prev,
        },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

type ListColumnBody = z.infer<typeof listColumnUpdateSchema>['list'];

interface ListColumnUpdateExtra {
  fkViewId?: string;
  fieldTitle?: string;
  tableTitle?: string;
  prevList?: Partial<ListColumnBody>;
}

export const ListColumnUpdateContract: OperationContract<
  typeof listColumnUpdateSchema,
  ListColumnUpdateExtra,
  unknown
> = {
  name: OperationName.listColumnUpdate,
  entity: MetaTable.LIST_VIEW_COLUMNS,
  schema: listColumnUpdateSchema,
  entry: {
    entity_id: (params) => params.listViewColumnId,
    description: viewColumnActions.update,
    before: async (context, params) => {
      const listCol = await ListViewColumn.get(
        context,
        params.listViewColumnId,
      );
      if (!listCol) return {};
      const view = listCol.fk_view_id
        ? await View.get(context, listCol.fk_view_id)
        : undefined;
      const table = view?.fk_model_id
        ? await Model.get(context, view.fk_model_id)
        : undefined;
      const field = listCol.fk_column_id
        ? await Column.get(context, { colId: listCol.fk_column_id })
        : undefined;

      // List column model has no group_by_* / aggregation (List doesn't
      // group or aggregate). Width IS supported (column-resizable list rows).
      const prevList = pickFieldsIfPresent(
        listCol,
        ['show', 'order', 'width'] as const,
        params.list ?? {},
      ) as Partial<ListColumnBody>;

      // First-resize undo: list_view_columns.width has no default in the
      // schema (unlike grid_view_columns which defaults to '200px'), so a
      // fresh row stores width=null. Swagger GridColumnReq.width requires
      // a string matching ^[0-9]+(px|%)$, so replaying width=null fails
      // payload validation in listColumnUpdate. Drop the field when
      // there's no prior value — undo becomes a no-op for that property.
      if (prevList && prevList.width == null && 'width' in prevList) {
        delete prevList.width;
      }

      return {
        parentEntityTitle: view?.title,
        extra: {
          fkViewId: listCol.fk_view_id,
          fieldTitle: field?.title,
          tableTitle: table?.title,
          prevList,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevList;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.listColumnUpdate,
        params: {
          listViewColumnId: params.listViewColumnId,
          list: prev,
        },
      };
    },
    scope: (_p, _r, resolved) => scopeView(resolved?.extra?.fkViewId),
  },
};

export function registerViewColumnHandlers(svc: ViewColumnsService): void {
  registerForward(ViewColumnUpdateContract, (context, params) =>
    svc.columnUpdate(context, params),
  );
}

export function registerGridColumnHandlers(svc: GridColumnsService): void {
  registerForward(GridColumnUpdateContract, (context, params) =>
    svc.gridColumnUpdate(context, params),
  );
}

export function registerFormColumnHandlers(svc: FormColumnsService): void {
  registerForward(FormColumnUpdateContract, (context, params) =>
    svc.columnUpdate(context, params),
  );
}

export function registerTimelineColumnHandlers(
  svc: TimelineColumnsService,
): void {
  registerForward(TimelineColumnUpdateContract, (context, params) =>
    svc.timelineColumnUpdate(context, params),
  );
}

export function registerGanttColumnHandlers(svc: GanttColumnsService): void {
  registerForward(GanttColumnUpdateContract, (context, params) =>
    svc.ganttColumnUpdate(context, params),
  );
}

export function registerListColumnHandlers(svc: ListColumnsService): void {
  registerForward(ListColumnUpdateContract, (context, params) =>
    svc.listColumnUpdate(context, params),
  );
}

export function registerShowHideAllHandlers(svc: ViewsService): void {
  registerForward(ShowAllColumnsContract, (context, params) =>
    svc.showAllColumns(context, params),
  );
  registerForward(HideAllColumnsContract, (context, params) =>
    svc.hideAllColumns(context, params),
  );

  registerForward(ViewColumnsBulkSetVisibilityContract, (context, params) =>
    svc.viewColumnsBulkSetVisibility(context, params),
  );
}
