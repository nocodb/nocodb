import type { NcContext } from '~/interface/config';
import type { OperationContract, ResolvedCtx } from '~/command-registry/types';
import type { GridsService } from '~/services/grids.service';
import type { FormsService } from '~/services/forms.service';
import type { GalleriesService } from '~/services/galleries.service';
import type { KanbansService } from '~/services/kanbans.service';
import type { CalendarsService } from '~/services/calendars.service';
import type { ListsService } from '~/ee/services/lists.service';
import type { TimelinesService } from '~/services/timelines.service';
import type { MapsService } from '~/services/maps.service';
import type { BaseTrashService } from '~/services/base-trash/base-trash.service';
import BaseTrash from '~/ee/models/BaseTrash';
import { OperationName } from '~/command-registry/op-names';
import { OperationRegistry } from '~/command-registry/registry';
import {
  makeReplayReq,
  registerForward,
} from '~/command-registry/replay-context';
import { isReplay } from '~/helpers/replayScope';
import { overrideConflictingViewByTitle } from '~/command-registry/operations/shared/view-replay-conflict';
import { MetaTable } from '~/utils/globals';
import {
  CalendarView,
  FormView,
  GalleryView,
  GridView,
  KanbanView,
  ListView,
  ListViewLevel,
  MapView,
  Model,
  TimelineView,
  View,
} from '~/models';
import Noco from '~/Noco';
import { pickFields, pickFieldsIfPresent } from '~/utils/tsUtils';
import { viewActions } from '~/decorators/trace-command-descriptions';
import {
  calendarCreateSchema,
  calendarUpdateSchema,
  formCreateSchema,
  formUpdateSchema,
  galleryCreateSchema,
  galleryUpdateSchema,
  gridCreateSchema,
  gridUpdateSchema,
  kanbanCreateSchema,
  kanbanUpdateSchema,
  listCreateSchema,
  listUpdateSchema,
  listViewLevelsRestoreSchema,
  mapCreateSchema,
  mapUpdateSchema,
  timelineCreateSchema,
  timelineUpdateSchema,
} from '~/command-registry/operations/_schemas/view';

async function resolveCreateCtx(
  context: NcContext,
  tableId: string,
): Promise<ResolvedCtx> {
  const table = await Model.get(context, tableId);
  return { parentEntityTitle: table?.title };
}

async function resolveUpdateCtx(
  context: NcContext,
  viewId: string,
): Promise<ResolvedCtx<{ oldTitle?: string }>> {
  const view = await View.get(context, viewId);
  const table = view?.fk_model_id
    ? await Model.get(context, view.fk_model_id)
    : undefined;
  return {
    entityTitle: view?.title,
    parentEntityTitle: table?.title,
    extra: { oldTitle: view?.title },
  };
}

const renameOrEdit = (context: {
  entityTitle?: string;
  parentEntityTitle?: string;
  operation: string;
  extra?: { oldTitle?: string };
}) =>
  context.extra?.oldTitle && context.extra.oldTitle !== context.entityTitle
    ? viewActions.rename(context)
    : viewActions.edit(context);

const buildViewCreateInverse = (
  _context: NcContext,
  _params: unknown,
  result: any,
) => {
  if (!result?.id) return null;
  return {
    name: OperationName.viewDelete,
    params: { viewId: result.id },
  };
};

/**
 * Per-view-type contracts reference columns via `fk_*_col_id` body fields —
 * sandbox cherry-pick uses this to auto-include the referenced columns when
 * the view itself is selected.
 */
const colDeps = (...ids: ReadonlyArray<string | null | undefined>) =>
  ids
    .filter((id): id is string => !!id)
    .map((id) => ({ entity: MetaTable.COLUMNS, id }));

export const GridViewCreateContract: OperationContract<
  typeof gridCreateSchema,
  Record<string, any>,
  GridView | undefined
> = {
  name: OperationName.gridViewCreate,
  entity: MetaTable.VIEWS,
  schema: gridCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.grid?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: { id_field: 'grid' },
  undo: { inverse: buildViewCreateInverse },
};

interface GridUpdateExtra {
  oldTitle?: string;
  prevGrid?: { row_height?: number; meta?: unknown };
}

export const GridViewUpdateContract: OperationContract<
  typeof gridUpdateSchema,
  GridUpdateExtra,
  GridView | undefined
> = {
  name: OperationName.gridViewUpdate,
  entity: MetaTable.VIEWS,
  schema: gridUpdateSchema,
  entry: {
    entity_id: (params) => params.viewId,
    entity_title: (params) => params.grid?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.viewId);
      const gridRow = await GridView.get(context, params.viewId);
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevGrid: gridRow
            ? (pickFieldsIfPresent(
                gridRow,
                ['row_height', 'meta'] as const,
                params.grid ?? {},
              ) as { row_height?: number; meta?: unknown })
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevGrid;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.gridViewUpdate,
        params: { viewId: params.viewId, grid: prev },
      };
    },
  },
};

export const FormViewCreateContract: OperationContract<
  typeof formCreateSchema,
  Record<string, any>,
  FormView | undefined
> = {
  name: OperationName.formViewCreate,
  entity: MetaTable.VIEWS,
  schema: formCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.body?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: { id_field: 'body' },
  undo: { inverse: buildViewCreateInverse },
};

interface FormUpdateExtra {
  oldTitle?: string;
  prevForm?: {
    title?: string;
    heading?: string;
    subheading?: string;
    success_msg?: string;
    redirect_url?: string;
    redirect_after_secs?: string;
    email?: string;
    banner_image_url?: unknown;
    logo_url?: unknown;
    submit_another_form?: unknown;
    show_blank_form?: unknown;
    meta?: unknown;
    starts_at?: string;
    expires_at?: string;
  };
}

export const FormViewUpdateContract: OperationContract<
  typeof formUpdateSchema,
  FormUpdateExtra,
  FormView | undefined
> = {
  name: OperationName.formViewUpdate,
  entity: MetaTable.VIEWS,
  schema: formUpdateSchema,
  entry: {
    entity_id: (params) => params.formViewId,
    entity_title: (params) => params.form?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.formViewId);
      const formRow = await FormView.get(context, params.formViewId);
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevForm: formRow
            ? pickFieldsIfPresent(
                formRow,
                [
                  'title',
                  'heading',
                  'subheading',
                  'success_msg',
                  'redirect_url',
                  'redirect_after_secs',
                  'email',
                  'banner_image_url',
                  'logo_url',
                  'submit_another_form',
                  'show_blank_form',
                  'meta',
                  'starts_at',
                  'expires_at',
                ] as const,
                params.form ?? {},
              )
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevForm;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.formViewUpdate,
        params: { formViewId: params.formViewId, form: prev },
      };
    },
  },
};

export const GalleryViewCreateContract: OperationContract<
  typeof galleryCreateSchema,
  Record<string, any>,
  GalleryView | undefined
> = {
  name: OperationName.galleryViewCreate,
  entity: MetaTable.VIEWS,
  schema: galleryCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.gallery?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: {
    id_field: 'gallery',
    dependencies: (params, result) =>
      colDeps(
        params.gallery?.fk_cover_image_col_id,
        result?.fk_cover_image_col_id,
      ),
  },
  undo: { inverse: buildViewCreateInverse },
};

interface GalleryUpdateExtra {
  oldTitle?: string;
  prevGallery?: { fk_cover_image_col_id?: string; meta?: unknown };
}

export const GalleryViewUpdateContract: OperationContract<
  typeof galleryUpdateSchema,
  GalleryUpdateExtra,
  GalleryView | undefined
> = {
  name: OperationName.galleryViewUpdate,
  entity: MetaTable.VIEWS,
  schema: galleryUpdateSchema,
  entry: {
    entity_id: (params) => params.galleryViewId,
    entity_title: (params) => params.gallery?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.galleryViewId);
      const galleryRow = await GalleryView.get(context, params.galleryViewId);
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevGallery: galleryRow
            ? (pickFieldsIfPresent(
                galleryRow,
                ['fk_cover_image_col_id', 'meta'] as const,
                params.gallery ?? {},
              ) as { fk_cover_image_col_id?: string; meta?: unknown })
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevGallery;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.galleryViewUpdate,
        params: { galleryViewId: params.galleryViewId, gallery: prev },
      };
    },
  },
};

export const KanbanViewCreateContract: OperationContract<
  typeof kanbanCreateSchema,
  Record<string, any>,
  KanbanView | undefined
> = {
  name: OperationName.kanbanViewCreate,
  entity: MetaTable.VIEWS,
  schema: kanbanCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.kanban?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: {
    id_field: 'kanban',
    dependencies: (params, result) =>
      colDeps(
        params.kanban?.fk_grp_col_id,
        params.kanban?.fk_cover_image_col_id,
        result?.fk_grp_col_id,
        result?.fk_cover_image_col_id,
      ),
  },
  undo: { inverse: buildViewCreateInverse },
};

interface KanbanUpdateExtra {
  oldTitle?: string;
  prevKanban?: {
    fk_grp_col_id?: string;
    fk_cover_image_col_id?: string;
    meta?: unknown;
  };
}

export const KanbanViewUpdateContract: OperationContract<
  typeof kanbanUpdateSchema,
  KanbanUpdateExtra,
  KanbanView | undefined
> = {
  name: OperationName.kanbanViewUpdate,
  entity: MetaTable.VIEWS,
  schema: kanbanUpdateSchema,
  entry: {
    entity_id: (params) => params.kanbanViewId,
    entity_title: (params) => params.kanban?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.kanbanViewId);
      const kanbanRow = await KanbanView.get(context, params.kanbanViewId);
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevKanban: kanbanRow
            ? (pickFieldsIfPresent(
                kanbanRow,
                [
                  'fk_grp_col_id',
                  'fk_cover_image_col_id',
                  'meta',
                ] as const,
                params.kanban ?? {},
              ) as {
                fk_grp_col_id?: string;
                fk_cover_image_col_id?: string;
                meta?: unknown;
              })
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevKanban;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.kanbanViewUpdate,
        params: { kanbanViewId: params.kanbanViewId, kanban: prev },
      };
    },
  },
};

export const CalendarViewCreateContract: OperationContract<
  typeof calendarCreateSchema,
  Record<string, any>,
  CalendarView | undefined
> = {
  name: OperationName.calendarViewCreate,
  entity: MetaTable.VIEWS,
  schema: calendarCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.calendar?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: {
    id_field: 'calendar',
    dependencies: (params, result) =>
      colDeps(
        params.calendar?.fk_cover_image_col_id,
        ...(params.calendar?.calendar_range ?? []).flatMap((r) => [
          r.fk_from_column_id,
          r.fk_to_column_id,
        ]),
        result?.fk_cover_image_col_id,
      ),
  },
  undo: { inverse: buildViewCreateInverse },
};

interface CalendarUpdateExtra {
  oldTitle?: string;
  prevCalendar?: {
    title?: string;
    fk_cover_image_col_id?: string;
    calendar_range?: unknown;
    meta?: unknown;
  };
}

export const CalendarViewUpdateContract: OperationContract<
  typeof calendarUpdateSchema,
  CalendarUpdateExtra,
  CalendarView | undefined
> = {
  name: OperationName.calendarViewUpdate,
  entity: MetaTable.VIEWS,
  schema: calendarUpdateSchema,
  entry: {
    entity_id: (params) => params.calendarViewId,
    entity_title: (params) => params.calendar?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.calendarViewId);
      const calendarRow = await CalendarView.get(
        context,
        params.calendarViewId,
      );
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevCalendar: calendarRow
            ? (pickFieldsIfPresent(
                calendarRow,
                [
                  'title',
                  'fk_cover_image_col_id',
                  'calendar_range',
                  'meta',
                ] as const,
                params.calendar ?? {},
              ) as {
                title?: string;
                fk_cover_image_col_id?: string;
                calendar_range?: unknown;
                meta?: unknown;
              })
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevCalendar;
      if (!prev || Object.keys(prev).length === 0) return null;
      return {
        name: OperationName.calendarViewUpdate,
        params: { calendarViewId: params.calendarViewId, calendar: prev },
      };
    },
  },
};

export const ListViewCreateContract: OperationContract<
  typeof listCreateSchema,
  Record<string, any>,
  ListView | undefined
> = {
  name: OperationName.listViewCreate,
  entity: MetaTable.VIEWS,
  schema: listCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.list?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: { id_field: 'list' },
  undo: { inverse: buildViewCreateInverse },
};

interface ListLevelSnapshot {
  id: string;
  level: number;
  fk_model_id: string;
  fk_link_column_id?: string;
  enable_nested_records?: unknown;
  fk_self_link_column_id?: string;
  wrap_headers?: unknown;
  meta?: unknown;
  columns: Array<Record<string, unknown>>;
}

interface ListParentSnapshot {
  meta?: unknown;
  show_empty_parents?: unknown;
  row_height?: number;
  fk_prefix_column_id?: string;
}

interface ListUpdateExtra {
  oldTitle?: string;
  prevList?: ListParentSnapshot;
  prevLevelsFull?: ListLevelSnapshot[];
}

export const ListViewUpdateContract: OperationContract<
  typeof listUpdateSchema,
  ListUpdateExtra,
  ListView | undefined
> = {
  name: OperationName.listViewUpdate,
  entity: MetaTable.VIEWS,
  schema: listUpdateSchema,
  entry: {
    entity_id: (params) => params.listViewId,
    entity_title: (params) => params.list?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.listViewId);
      const listRow = (await ListView.get(context, params.listViewId)) as
        | (Partial<ListView> & {
            show_empty_parents?: unknown;
            row_height?: number;
            fk_prefix_column_id?: string;
          })
        | null
        | undefined;

      const forward =
        (params.list as Record<string, unknown> | undefined) ?? {};
      const SNAPSHOT_KEYS = [
        'meta',
        'show_empty_parents',
        'row_height',
        'fk_prefix_column_id',
      ] as const;
      let prevList: ListParentSnapshot | undefined;
      if (listRow) {
        const snap: Record<string, unknown> = {};
        for (const key of SNAPSHOT_KEYS) {
          if (!(key in forward)) continue;
          const prevVal = (listRow as Record<string, unknown>)[key];
          if (prevVal === null || prevVal === undefined) continue;
          snap[key] = prevVal;
        }
        if (Object.keys(snap).length > 0) prevList = snap as ListParentSnapshot;
      }

      let prevLevelsFull: ListLevelSnapshot[] | undefined;
      if ((params.list as { levels?: unknown[] })?.levels !== undefined) {
        prevLevelsFull = await snapshotListLevels(context, params.listViewId);
      }

      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          ...(prevList ? { prevList } : {}),
          ...(prevLevelsFull ? { prevLevelsFull } : {}),
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevList;
      const prevLevelsFull = resolved?.extra?.prevLevelsFull;

      if (prevLevelsFull) {
        return {
          name: OperationName.listViewLevelsRestore,
          params: {
            viewId: params.listViewId,
            list: prev,
            levels: prevLevelsFull,
          },
        };
      }

      if (!prev) return null;
      return {
        name: OperationName.listViewUpdate,
        params: { listViewId: params.listViewId, list: prev },
      };
    },
  },
};

async function snapshotListLevels(
  context: NcContext,
  viewId: string,
): Promise<ListLevelSnapshot[]> {
  const ncMeta = Noco.ncMeta;
  const levels = await ListViewLevel.list(context, viewId);
  const snapshots: ListLevelSnapshot[] = [];
  for (const lvl of levels) {
    const columns = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.LIST_VIEW_COLUMNS,
      { condition: { fk_level_id: lvl.id } },
    );
    snapshots.push({
      id: lvl.id,
      level: lvl.level as number,
      fk_model_id: lvl.fk_model_id as string,
      fk_link_column_id: lvl.fk_link_column_id,
      enable_nested_records: lvl.enable_nested_records,
      fk_self_link_column_id: lvl.fk_self_link_column_id,
      wrap_headers: lvl.wrap_headers,
      meta: lvl.meta,
      columns: columns as Array<Record<string, unknown>>,
    });
  }
  return snapshots;
}

export const ListViewLevelsRestoreContract: OperationContract<
  typeof listViewLevelsRestoreSchema,
  Record<string, any>,
  void
> = {
  name: OperationName.listViewLevelsRestore,
  entity: MetaTable.LIST_VIEW_LEVELS,
  schema: listViewLevelsRestoreSchema,
  entry: {
    entity_id: (params) => params.viewId,
    description: () => 'Restore list view levels',
  },
};

export const TimelineViewCreateContract: OperationContract<
  typeof timelineCreateSchema,
  Record<string, any>,
  TimelineView | undefined
> = {
  name: OperationName.timelineViewCreate,
  entity: MetaTable.VIEWS,
  schema: timelineCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.timeline?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: {
    id_field: 'timeline',
    dependencies: (params) =>
      colDeps(
        params.timeline?.fk_from_column_id,
        params.timeline?.fk_to_column_id,
        params.timeline?.fk_cover_image_col_id,
      ),
  },
  undo: { inverse: buildViewCreateInverse },
};

interface TimelineUpdateExtra {
  oldTitle?: string;
  prevTimeline?: { title?: string; timeline_range?: unknown; meta?: unknown };
}

export const TimelineViewUpdateContract: OperationContract<
  typeof timelineUpdateSchema,
  TimelineUpdateExtra,
  TimelineView | undefined
> = {
  name: OperationName.timelineViewUpdate,
  entity: MetaTable.VIEWS,
  schema: timelineUpdateSchema,
  entry: {
    entity_id: (params) => params.timelineViewId,
    entity_title: (params) => params.timeline?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.timelineViewId);
      const timelineRow = await TimelineView.get(
        context,
        params.timelineViewId,
      );
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevTimeline: timelineRow
            ? pickFields(timelineRow, [
                'title',
                'timeline_range',
                'meta',
              ] as const)
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevTimeline;
      if (!prev) return null;
      return {
        name: OperationName.timelineViewUpdate,
        params: { timelineViewId: params.timelineViewId, timeline: prev },
      };
    },
  },
};

export const MapViewCreateContract: OperationContract<
  typeof mapCreateSchema,
  Record<string, any>,
  MapView | undefined
> = {
  name: OperationName.mapViewCreate,
  entity: MetaTable.VIEWS,
  schema: mapCreateSchema,
  entry: {
    entity_id: 'id',
    entity_title: (params) => params.map?.title,
    parent_id: 'tableId',
    description: viewActions.add,
    before: (context, params) => resolveCreateCtx(context, params.tableId),
  },
  sandbox: {
    id_field: 'map',
    dependencies: (params, result) =>
      colDeps(params.map?.fk_geo_data_col_id, result?.fk_geo_data_col_id),
  },
  undo: { inverse: buildViewCreateInverse },
};

interface MapUpdateExtra {
  oldTitle?: string;
  prevMap?: { fk_geo_data_col_id?: string; meta?: unknown };
}

export const MapViewUpdateContract: OperationContract<
  typeof mapUpdateSchema,
  MapUpdateExtra,
  MapView | undefined
> = {
  name: OperationName.mapViewUpdate,
  entity: MetaTable.VIEWS,
  schema: mapUpdateSchema,
  entry: {
    entity_id: (params) => params.mapViewId,
    entity_title: (params) => params.map?.title,
    description: renameOrEdit,
    before: async (context, params) => {
      const base = await resolveUpdateCtx(context, params.mapViewId);
      const mapRow = await MapView.get(context, params.mapViewId);
      return {
        ...base,
        extra: {
          ...(base.extra ?? {}),
          prevMap: mapRow
            ? pickFields(mapRow, ['fk_geo_data_col_id', 'meta'] as const)
            : undefined,
        },
      };
    },
  },
  undo: {
    inverse: (_context, params, _result, resolved) => {
      const prev = resolved?.extra?.prevMap;
      if (!prev) return null;
      return {
        name: OperationName.mapViewUpdate,
        params: { mapViewId: params.mapViewId, map: prev },
      };
    },
  },
};

// Generic create-handler — registers `<viewType>ViewCreate` with redo-from-trash
// short-circuit + title-conflict resolution. Body key isn't statically known
// (8 view types), so we narrow via a structural envelope.
function registerViewCreate(
  contract: OperationContract,
  bodyKey: string,
  forward: (context: NcContext, params: any) => Promise<unknown>,
  baseTrashSvc: BaseTrashService,
): void {
  OperationRegistry.register(contract, async (context, params, meta) => {
    const req = makeReplayReq(meta.originalReq, meta.createdBy);

    // Redo of a view create (regular OR duplicate via `copy_from_id`): the
    // undo soft-deleted the view, so a fresh create with the same id would
    // collide. Detect the trashed id and restore from trash instead.
    if (isReplay() && meta.entityId) {
      const trashEntry = await BaseTrash.getByResourceId(
        context,
        'view',
        meta.entityId,
      );
      if (trashEntry?.id) {
        return baseTrashSvc.restore(context, {
          trashId: trashEntry.id,
          user: req.user,
          req,
        });
      }
    }

    const env = params as { tableId: string } & Record<
      string,
      { id?: string; title?: string } | undefined
    >;
    const body = env[bodyKey];
    if (body?.title) {
      await overrideConflictingViewByTitle(
        context,
        env.tableId,
        body.title,
        body.id,
      );
    }
    return forward(context, { ...params, req });
  });
}

export function registerViewTypeHandlers(
  gridSvc: GridsService,
  formSvc: FormsService,
  gallerySvc: GalleriesService,
  kanbanSvc: KanbansService,
  calendarSvc: CalendarsService,
  listSvc: ListsService,
  timelineSvc: TimelinesService,
  mapSvc: MapsService,
  baseTrashSvc: BaseTrashService,
): void {
  registerViewCreate(
    GridViewCreateContract,
    'grid',
    (context, params) => gridSvc.gridViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(GridViewUpdateContract, (context, params) =>
    gridSvc.gridViewUpdate(context, params),
  );

  registerViewCreate(
    FormViewCreateContract,
    'body',
    (context, params) => formSvc.formViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(FormViewUpdateContract, (context, params) =>
    formSvc.formViewUpdate(context, params),
  );

  registerViewCreate(
    GalleryViewCreateContract,
    'gallery',
    (context, params) => gallerySvc.galleryViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(GalleryViewUpdateContract, (context, params) =>
    gallerySvc.galleryViewUpdate(context, params),
  );

  registerViewCreate(
    KanbanViewCreateContract,
    'kanban',
    (context, params) => kanbanSvc.kanbanViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(KanbanViewUpdateContract, (context, params) =>
    kanbanSvc.kanbanViewUpdate(context, params),
  );

  registerViewCreate(
    CalendarViewCreateContract,
    'calendar',
    (context, params) => calendarSvc.calendarViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(CalendarViewUpdateContract, (context, params) =>
    calendarSvc.calendarViewUpdate(context, params),
  );

  registerViewCreate(
    ListViewCreateContract,
    'list',
    (context, params) => listSvc.listViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(ListViewUpdateContract, (context, params) =>
    listSvc.listViewUpdate(context, params),
  );
  registerForward(ListViewLevelsRestoreContract, (context, params) =>
    listSvc.restoreListViewLevels(
      context,
      params as Parameters<typeof listSvc.restoreListViewLevels>[1],
    ),
  );

  registerViewCreate(
    TimelineViewCreateContract,
    'timeline',
    (context, params) => timelineSvc.timelineViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(TimelineViewUpdateContract, (context, params) =>
    timelineSvc.timelineViewUpdate(context, params),
  );

  registerViewCreate(
    MapViewCreateContract,
    'map',
    (context, params) => mapSvc.mapViewCreate(context, params),
    baseTrashSvc,
  );
  registerForward(MapViewUpdateContract, (context, params) =>
    mapSvc.mapViewUpdate(context, params),
  );
}
