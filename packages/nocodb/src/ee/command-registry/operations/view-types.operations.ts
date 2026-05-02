import { z } from 'zod';
import type { OperationContract } from 'src/command-registry/types';
import { OperationName } from '~/command-registry/op-names';
import { MetaTable } from '~/utils/globals';
import { Model, View } from '~/models';
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
};

const gridUpdateSchema = z.object({
  viewId: z.string(),
  grid: viewCreateBodySchema,
});

export const GridViewUpdateContract: OperationContract<
  typeof gridUpdateSchema
> = {
  name: OperationName.gridViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: gridUpdateSchema,
  entityId: (p) => p.viewId,
  entityTitle: (p) => (p.grid as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) => resolveUpdateCtx(context, param.viewId),
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
};

const formUpdateSchema = z.object({
  formViewId: z.string(),
  form: viewCreateBodySchema,
});

export const FormViewUpdateContract: OperationContract<
  typeof formUpdateSchema
> = {
  name: OperationName.formViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: formUpdateSchema,
  entityId: (p) => p.formViewId,
  entityTitle: (p) => (p.form as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) => resolveUpdateCtx(context, param.formViewId),
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
};

const galleryUpdateSchema = z.object({
  galleryViewId: z.string(),
  gallery: viewCreateBodySchema,
});

export const GalleryViewUpdateContract: OperationContract<
  typeof galleryUpdateSchema
> = {
  name: OperationName.galleryViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: galleryUpdateSchema,
  entityId: (p) => p.galleryViewId,
  entityTitle: (p) => (p.gallery as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) =>
    resolveUpdateCtx(context, param.galleryViewId),
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
};

const kanbanUpdateSchema = z.object({
  kanbanViewId: z.string(),
  kanban: viewCreateBodySchema,
});

export const KanbanViewUpdateContract: OperationContract<
  typeof kanbanUpdateSchema
> = {
  name: OperationName.kanbanViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: kanbanUpdateSchema,
  entityId: (p) => p.kanbanViewId,
  entityTitle: (p) => (p.kanban as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) => resolveUpdateCtx(context, param.kanbanViewId),
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
};

const calendarUpdateSchema = z.object({
  calendarViewId: z.string(),
  calendar: viewCreateBodySchema,
});

export const CalendarViewUpdateContract: OperationContract<
  typeof calendarUpdateSchema
> = {
  name: OperationName.calendarViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: calendarUpdateSchema,
  entityId: (p) => p.calendarViewId,
  entityTitle: (p) => (p.calendar as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) =>
    resolveUpdateCtx(context, param.calendarViewId),
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
};

const listUpdateSchema = z.object({
  listViewId: z.string(),
  list: viewCreateBodySchema,
});

export const ListViewUpdateContract: OperationContract<
  typeof listUpdateSchema
> = {
  name: OperationName.listViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: listUpdateSchema,
  entityId: (p) => p.listViewId,
  entityTitle: (p) => (p.list as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) => resolveUpdateCtx(context, param.listViewId),
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
};

const timelineUpdateSchema = z.object({
  timelineViewId: z.string(),
  timeline: viewCreateBodySchema,
});

export const TimelineViewUpdateContract: OperationContract<
  typeof timelineUpdateSchema
> = {
  name: OperationName.timelineViewUpdate,
  version: 1,
  entity: MetaTable.VIEWS,
  schema: timelineUpdateSchema,
  entityId: (p) => p.timelineViewId,
  entityTitle: (p) => (p.timeline as any)?.title,
  description: renameOrEdit,
  resolveCtx: (context, param) =>
    resolveUpdateCtx(context, param.timelineViewId),
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
  };

const mapUpdateSchema = z.object({
  mapViewId: z.string(),
  map: viewCreateBodySchema,
});

export const MapViewUpdateContract: OperationContract<typeof mapUpdateSchema> =
  {
    name: OperationName.mapViewUpdate,
    version: 1,
    entity: MetaTable.VIEWS,
    schema: mapUpdateSchema,
    entityId: (p) => p.mapViewId,
    entityTitle: (p) => (p.map as any)?.title,
    description: renameOrEdit,
    resolveCtx: (context, param) => resolveUpdateCtx(context, param.mapViewId),
  };
