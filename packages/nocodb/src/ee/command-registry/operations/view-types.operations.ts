import { z } from 'zod';
import type { NcContext } from '~/interface/config';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
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
import { viewActions } from '~/decorators/trace-command-descriptions';

// ─── Shared schemas ───────────────────────────────────────────────────────────

const viewCreateBodySchema = z.object({}).passthrough();

// ─── Shared resolveCtx helpers ───────────────────────────────────────────────

async function resolveCreateCtx(context: any, tableId: string) {
  const table = await Model.get(context, tableId);
  return { parentEntityTitle: table?.title };
}

async function resolveUpdateCtx(context: any, viewId: string) {
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

const renameOrEdit = (ctx: any) =>
  ctx.extra?.oldTitle && ctx.extra.oldTitle !== ctx.entityTitle
    ? viewActions.rename(ctx)
    : viewActions.edit(ctx);

const buildViewCreateInverse = (_ctx: any, _p: any, r: any) => {
  const newId = (r as { id?: string } | undefined)?.id;
  if (!newId) return null;
  return {
    name: OperationName.viewDelete,
    version: 1,
    params: { viewId: newId },
  };
};

// ─── Grid ─────────────────────────────────────────────────────────────────────

const gridCreateSchema = z.object({
  tableId: z.string(),
  grid: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const GridViewCreateContract: OperationContract<
  typeof gridCreateSchema
> = {
  name: OperationName.gridViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: gridCreateSchema,
  idField: 'grid',
  entityId: 'id',
  entityTitle: (p) => (p.grid as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const gridUpdateSchema = z.object({
  viewId: z.string(),
  grid: viewCreateBodySchema,
});

interface GridUpdateExtra {
  oldTitle?: string;
  prevGrid?: { row_height?: number; meta?: unknown };
}

export const GridViewUpdateContract: OperationContract<
  typeof gridUpdateSchema,
  GridUpdateExtra
> = {
  name: OperationName.gridViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: gridUpdateSchema,
  entityId: (p) => p.viewId,
  entityTitle: (p) => (p.grid as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.viewId);
    const gridRow = await GridView.get(context, param.viewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevGrid: gridRow
          ? { row_height: gridRow.row_height, meta: gridRow.meta }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevGrid;
    if (!prev) return null;
    return {
      name: OperationName.gridViewUpdate,
      version: 1,
      params: { viewId: p.viewId, grid: prev },
    };
  },
};

// ─── Form ─────────────────────────────────────────────────────────────────────

const formCreateSchema = z.object({
  tableId: z.string(),
  body: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const FormViewCreateContract: OperationContract<
  typeof formCreateSchema
> = {
  name: OperationName.formViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: formCreateSchema,
  idField: 'body',
  entityId: 'id',
  entityTitle: (p) => (p.body as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const formUpdateSchema = z.object({
  formViewId: z.string(),
  form: viewCreateBodySchema,
});

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
  FormUpdateExtra
> = {
  name: OperationName.formViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: formUpdateSchema,
  entityId: (p) => p.formViewId,
  entityTitle: (p) => (p.form as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.formViewId);
    const formRow = await FormView.get(context, param.formViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevForm: formRow
          ? {
              title: formRow.title,
              heading: formRow.heading,
              subheading: formRow.subheading,
              success_msg: formRow.success_msg,
              redirect_url: formRow.redirect_url,
              redirect_after_secs: formRow.redirect_after_secs,
              email: formRow.email,
              banner_image_url: formRow.banner_image_url,
              logo_url: formRow.logo_url,
              submit_another_form: formRow.submit_another_form,
              show_blank_form: formRow.show_blank_form,
              meta: formRow.meta,
              starts_at: (formRow as { starts_at?: string }).starts_at,
              expires_at: (formRow as { expires_at?: string }).expires_at,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevForm;
    if (!prev) return null;
    return {
      name: OperationName.formViewUpdate,
      version: 1,
      params: { formViewId: p.formViewId, form: prev },
    };
  },
};

// ─── Gallery ──────────────────────────────────────────────────────────────────

const galleryCreateSchema = z.object({
  tableId: z.string(),
  gallery: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const GalleryViewCreateContract: OperationContract<
  typeof galleryCreateSchema
> = {
  name: OperationName.galleryViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: galleryCreateSchema,
  idField: 'gallery',
  entityId: 'id',
  entityTitle: (p) => (p.gallery as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const galleryUpdateSchema = z.object({
  galleryViewId: z.string(),
  gallery: viewCreateBodySchema,
});

interface GalleryUpdateExtra {
  oldTitle?: string;
  prevGallery?: { fk_cover_image_col_id?: string; meta?: unknown };
}

export const GalleryViewUpdateContract: OperationContract<
  typeof galleryUpdateSchema,
  GalleryUpdateExtra
> = {
  name: OperationName.galleryViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: galleryUpdateSchema,
  entityId: (p) => p.galleryViewId,
  entityTitle: (p) => (p.gallery as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.galleryViewId);
    const galleryRow = await GalleryView.get(context, param.galleryViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevGallery: galleryRow
          ? {
              fk_cover_image_col_id: galleryRow.fk_cover_image_col_id,
              meta: galleryRow.meta,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevGallery;
    if (!prev) return null;
    return {
      name: OperationName.galleryViewUpdate,
      version: 1,
      params: { galleryViewId: p.galleryViewId, gallery: prev },
    };
  },
};

// ─── Kanban ───────────────────────────────────────────────────────────────────

const kanbanCreateSchema = z.object({
  tableId: z.string(),
  kanban: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const KanbanViewCreateContract: OperationContract<
  typeof kanbanCreateSchema
> = {
  name: OperationName.kanbanViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: kanbanCreateSchema,
  idField: 'kanban',
  entityId: 'id',
  entityTitle: (p) => (p.kanban as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const kanbanUpdateSchema = z.object({
  kanbanViewId: z.string(),
  kanban: viewCreateBodySchema,
});

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
  KanbanUpdateExtra
> = {
  name: OperationName.kanbanViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: kanbanUpdateSchema,
  entityId: (p) => p.kanbanViewId,
  entityTitle: (p) => (p.kanban as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.kanbanViewId);
    const kanbanRow = await KanbanView.get(context, param.kanbanViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevKanban: kanbanRow
          ? {
              fk_grp_col_id: kanbanRow.fk_grp_col_id,
              fk_cover_image_col_id: kanbanRow.fk_cover_image_col_id,
              meta: kanbanRow.meta,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevKanban;
    if (!prev) return null;
    return {
      name: OperationName.kanbanViewUpdate,
      version: 1,
      params: { kanbanViewId: p.kanbanViewId, kanban: prev },
    };
  },
};

// ─── Calendar ─────────────────────────────────────────────────────────────────

const calendarCreateSchema = z.object({
  tableId: z.string(),
  calendar: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const CalendarViewCreateContract: OperationContract<
  typeof calendarCreateSchema
> = {
  name: OperationName.calendarViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: calendarCreateSchema,
  idField: 'calendar',
  entityId: 'id',
  entityTitle: (p) => (p.calendar as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const calendarUpdateSchema = z.object({
  calendarViewId: z.string(),
  calendar: viewCreateBodySchema,
});

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
  CalendarUpdateExtra
> = {
  name: OperationName.calendarViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: calendarUpdateSchema,
  entityId: (p) => p.calendarViewId,
  entityTitle: (p) => (p.calendar as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.calendarViewId);
    const calendarRow = await CalendarView.get(context, param.calendarViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevCalendar: calendarRow
          ? {
              title: calendarRow.title,
              fk_cover_image_col_id: calendarRow.fk_cover_image_col_id,
              calendar_range: calendarRow.calendar_range,
              meta: calendarRow.meta,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevCalendar;
    if (!prev) return null;
    return {
      name: OperationName.calendarViewUpdate,
      version: 1,
      params: { calendarViewId: p.calendarViewId, calendar: prev },
    };
  },
};

// ─── List ─────────────────────────────────────────────────────────────────────

const listCreateSchema = z.object({
  tableId: z.string(),
  list: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const ListViewCreateContract: OperationContract<
  typeof listCreateSchema
> = {
  name: OperationName.listViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: listCreateSchema,
  idField: 'list',
  entityId: 'id',
  entityTitle: (p) => (p.list as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const listUpdateSchema = z.object({
  listViewId: z.string(),
  list: viewCreateBodySchema,
});

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
  ListUpdateExtra
> = {
  name: OperationName.listViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: listUpdateSchema,
  entityId: (p) => p.listViewId,
  entityTitle: (p) => (p.list as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.listViewId);
    const listRow = (await ListView.get(context, param.listViewId)) as
      | (Partial<ListView> & {
          show_empty_parents?: unknown;
          row_height?: number;
          fk_prefix_column_id?: string;
        })
      | null
      | undefined;

    const forward = (param.list as Record<string, unknown> | undefined) ?? {};
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
    if ((param.list as { levels?: unknown[] })?.levels !== undefined) {
      prevLevelsFull = await snapshotListLevels(context, param.listViewId);
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
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevList;
    const prevLevelsFull = resolved?.extra?.prevLevelsFull;

    if (prevLevelsFull) {
      return {
        name: OperationName.listViewLevelsRestore,
        version: 1,
        params: {
          viewId: p.listViewId,
          list: prev,
          levels: prevLevelsFull,
        },
      };
    }

    if (!prev) return null;
    return {
      name: OperationName.listViewUpdate,
      version: 1,
      params: { listViewId: p.listViewId, list: prev },
    };
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

const listLevelsRestoreSchema = z.object({
  viewId: z.string(),
  list: z.record(z.unknown()).optional(),
  levels: z.array(z.record(z.unknown())),
});

export const ListViewLevelsRestoreContract: OperationContract<
  typeof listLevelsRestoreSchema
> = {
  name: OperationName.listViewLevelsRestore,
  version: 1,
  entity: MetaTable.LIST_VIEW_LEVELS,
  schema: listLevelsRestoreSchema,
  entityId: (p) => p.viewId,
  description: () => 'Restore list view levels',
};

// ─── Timeline ────────────────────────────────────────────────────────────────

const timelineCreateSchema = z.object({
  tableId: z.string(),
  timeline: viewCreateBodySchema,
  ownedBy: z.string().optional(),
});

export const TimelineViewCreateContract: OperationContract<
  typeof timelineCreateSchema
> = {
  name: OperationName.timelineViewCreate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: timelineCreateSchema,
  idField: 'timeline',
  entityId: 'id',
  entityTitle: (p) => (p.timeline as any)?.title,
  parentId: 'tableId',
  description: viewActions.add,
  resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
  buildInverse: buildViewCreateInverse,
};

const timelineUpdateSchema = z.object({
  timelineViewId: z.string(),
  timeline: viewCreateBodySchema,
});

interface TimelineUpdateExtra {
  oldTitle?: string;
  prevTimeline?: { title?: string; timeline_range?: unknown; meta?: unknown };
}

export const TimelineViewUpdateContract: OperationContract<
  typeof timelineUpdateSchema,
  TimelineUpdateExtra
> = {
  name: OperationName.timelineViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: timelineUpdateSchema,
  entityId: (p) => p.timelineViewId,
  entityTitle: (p) => (p.timeline as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.timelineViewId);
    const timelineRow = await TimelineView.get(context, param.timelineViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevTimeline: timelineRow
          ? {
              title: timelineRow.title,
              timeline_range: timelineRow.timeline_range,
              meta: timelineRow.meta,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevTimeline;
    if (!prev) return null;
    return {
      name: OperationName.timelineViewUpdate,
      version: 1,
      params: { timelineViewId: p.timelineViewId, timeline: prev },
    };
  },
};

// ─── Map ──────────────────────────────────────────────────────────────────────

const mapCreateSchema = z.object({
  tableId: z.string(),
  map: viewCreateBodySchema,
});

export const MapViewCreateContract: OperationContract<typeof mapCreateSchema> =
  {
    name: OperationName.mapViewCreate,
    version: 1,
    entity: MetaTable.VIEWS,
    schema: mapCreateSchema,
    idField: 'map',
    entityId: 'id',
    entityTitle: (p) => (p.map as any)?.title,
    parentId: 'tableId',
    description: viewActions.add,
    resolveCtx: (context, param) => resolveCreateCtx(context, param.tableId),
    buildInverse: buildViewCreateInverse,
  };

const mapUpdateSchema = z.object({
  mapViewId: z.string(),
  map: viewCreateBodySchema,
});

interface MapUpdateExtra {
  oldTitle?: string;
  prevMap?: { fk_geo_data_col_id?: string; meta?: unknown };
}

export const MapViewUpdateContract: OperationContract<
  typeof mapUpdateSchema,
  MapUpdateExtra
> = {
  name: OperationName.mapViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: mapUpdateSchema,
  entityId: (p) => p.mapViewId,
  entityTitle: (p) => (p.map as any)?.title,
  description: renameOrEdit,
  resolveCtx: async (context, param) => {
    const base = await resolveUpdateCtx(context, param.mapViewId);
    const mapRow = await MapView.get(context, param.mapViewId);
    return {
      ...base,
      extra: {
        ...(base.extra ?? {}),
        prevMap: mapRow
          ? {
              fk_geo_data_col_id: mapRow.fk_geo_data_col_id,
              meta: mapRow.meta,
            }
          : undefined,
      },
    };
  },
  buildInverse: (_ctx, p, _r, resolved) => {
    const prev = resolved?.extra?.prevMap;
    if (!prev) return null;
    return {
      name: OperationName.mapViewUpdate,
      version: 1,
      params: { mapViewId: p.mapViewId, map: prev },
    };
  },
};
