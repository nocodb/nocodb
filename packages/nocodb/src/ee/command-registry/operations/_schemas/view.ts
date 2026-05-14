import { z } from 'zod';

const LOCK_TYPES = ['collaborative', 'locked', 'personal'] as const;
const boolType = z.union([z.boolean(), z.literal(0), z.literal(1)]);

/**
 * Columns shared by every view type — sourced from `MetaTable.VIEWS`.
 * Per-view schemas spread these via `.extend(...)`.
 */
const viewBaseFields = {
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  /** TS enum at runtime: FORM=1, GALLERY=2, GRID=3, KANBAN=4, MAP=5,
   *  CALENDAR=6, LIST=7, TIMELINE=8. Server sets this; clients shouldn't
   *  mutate, but updates that re-snapshot a row will round-trip it. */
  type: z.number().int().nonnegative().optional(),
  lock_type: z.enum(LOCK_TYPES).nullable().optional(),
  show: boolType.optional(),
  show_system_fields: boolType.optional(),
  is_default: boolType.optional(),
  order: z.number().optional(),
  uuid: z.string().nullable().optional(),
  password: z.string().nullable().optional(),
  meta: z
    .union([z.record(z.unknown()), z.string()])
    .nullable()
    .optional(),
  attachment_mode_column_id: z.string().nullable().optional(),
  expanded_record_mode: z.string().nullable().optional(),
  fk_custom_url_id: z.string().nullable().optional(),
  fk_model_id: z.string().nullable().optional(),
  owned_by: z.string().nullable().optional(),
  /** Replay-time injection (idField). */
  id: z.string().optional(),
  /** Create-time only — View.insert seeds the new view from this source. */
  copy_from_id: z.string().nullable().optional(),
};

export const viewBaseBodySchema = z.object(viewBaseFields).strict();

export const gridBodySchema = z
  .object({
    ...viewBaseFields,
    row_height: z.number().int().nullable().optional(),
  })
  .strict();

export const gridCreateSchema = z
  .object({
    tableId: z.string(),
    grid: gridBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const gridUpdateSchema = z
  .object({
    viewId: z.string(),
    grid: gridBodySchema,
  })
  .strict();

// ── Form ─────────────────────────────────────────────────────────

export const formBodySchema = z
  .object({
    ...viewBaseFields,
    /** FORM_VIEW.heading — string 255. */
    heading: z.string().nullable().optional(),
    subheading: z.string().nullable().optional(),
    success_msg: z.string().nullable().optional(),
    redirect_url: z.string().nullable().optional(),
    /** redirect_after_secs is `string` in DB (column type), but in practice
     *  carries a number-as-string. Kept as string per migration. */
    redirect_after_secs: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    submit_another_form: boolType.optional(),
    show_blank_form: boolType.optional(),
    banner_image_url: z.string().nullable().optional(),
    logo_url: z.string().nullable().optional(),
    /** Recently added on the SDK form contract; carried on the body. */
    starts_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
  })
  .strict();

export const formCreateSchema = z
  .object({
    tableId: z.string(),
    body: formBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const formUpdateSchema = z
  .object({
    formViewId: z.string(),
    form: formBodySchema,
  })
  .strict();

// ── Gallery ──────────────────────────────────────────────────────

export const galleryBodySchema = z
  .object({
    ...viewBaseFields,
    next_enabled: boolType.optional(),
    prev_enabled: boolType.optional(),
    cover_image_idx: z.number().int().nullable().optional(),
    fk_cover_image_col_id: z.string().nullable().optional(),
    cover_image: z.string().nullable().optional(),
    restrict_types: z.string().nullable().optional(),
    restrict_size: z.string().nullable().optional(),
    restrict_number: z.string().nullable().optional(),
    public: boolType.optional(),
    dimensions: z.string().nullable().optional(),
    responsive_columns: z.string().nullable().optional(),
  })
  .strict();

export const galleryCreateSchema = z
  .object({
    tableId: z.string(),
    gallery: galleryBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const galleryUpdateSchema = z
  .object({
    galleryViewId: z.string(),
    gallery: galleryBodySchema,
  })
  .strict();

// ── Kanban ───────────────────────────────────────────────────────

export const kanbanBodySchema = z
  .object({
    ...viewBaseFields,
    show_all_fields: boolType.optional(),
    fk_grp_col_id: z.string().nullable().optional(),
    fk_cover_image_col_id: z.string().nullable().optional(),
    public: boolType.optional(),
  })
  .strict();

export const kanbanCreateSchema = z
  .object({
    tableId: z.string(),
    kanban: kanbanBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const kanbanUpdateSchema = z
  .object({
    kanbanViewId: z.string(),
    kanban: kanbanBodySchema,
  })
  .strict();

// ── Calendar ─────────────────────────────────────────────────────

const calendarRangeSchema = z
  .object({
    id: z.string().optional(),
    fk_view_id: z.string().optional(),
    fk_from_column_id: z.string().nullable().optional(),
    fk_to_column_id: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
  })
  .strict();

export const calendarBodySchema = z
  .object({
    ...viewBaseFields,
    fk_cover_image_col_id: z.string().nullable().optional(),
    /** SDK CalendarReqType carries `calendar_range` for create/update. */
    calendar_range: z.array(calendarRangeSchema).optional(),
  })
  .strict();

export const calendarCreateSchema = z
  .object({
    tableId: z.string(),
    calendar: calendarBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const calendarUpdateSchema = z
  .object({
    calendarViewId: z.string(),
    calendar: calendarBodySchema,
  })
  .strict();

// ── Map ──────────────────────────────────────────────────────────

export const mapBodySchema = z
  .object({
    ...viewBaseFields,
    fk_geo_data_col_id: z.string().nullable().optional(),
  })
  .strict();

export const mapCreateSchema = z
  .object({
    tableId: z.string(),
    map: mapBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const mapUpdateSchema = z
  .object({
    mapViewId: z.string(),
    map: mapBodySchema,
  })
  .strict();

// ── List & Timeline ──────────────────────────────────────────────
// Both use the shared base; per-type fields are added by the inner
// service paths and not part of the API surface that contracts validate.

const listLevelInputSchema = z
  .object({
    /** Replay-injected for round-trip across undo/redo and sandbox merge. */
    id: z.string().optional(),

    level: z.number().int(),
    fk_model_id: z.string(),
    fk_link_column_id: z.string().nullable().optional(),
    enable_nested_records: boolType.nullable().optional(),
    fk_self_link_column_id: z.string().nullable().optional(),
    wrap_headers: boolType.nullable().optional(),
    meta: z
      .union([z.record(z.unknown()), z.string()])
      .nullable()
      .optional(),
  })
  .strict();

export const listBodySchema = z
  .object(viewBaseFields)
  .extend({
    show_empty_parents: boolType.nullable().optional(),
    row_height: z.number().int().nullable().optional(),
    fk_prefix_column_id: z.string().nullable().optional(),
    levels: z.array(listLevelInputSchema).optional(),
  })
  .strict();

export const listCreateSchema = z
  .object({
    tableId: z.string(),
    list: listBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const listUpdateSchema = z
  .object({
    listViewId: z.string(),
    list: listBodySchema,
  })
  .strict();

const timelineRangeSchema = z
  .object({
    id: z.string().optional(),
    fk_view_id: z.string().optional(),
    fk_from_column_id: z.string().nullable().optional(),
    fk_to_column_id: z.string().nullable().optional(),
    label: z.string().nullable().optional(),
  })
  .strict();

export const timelineBodySchema = z
  .object({
    ...viewBaseFields,
    fk_from_column_id: z.string().nullable().optional(),
    fk_to_column_id: z.string().nullable().optional(),
    fk_cover_image_col_id: z.string().nullable().optional(),
    /** SDK TimelineReqType — array form on create/update. */
    timeline_range: z.array(timelineRangeSchema).optional(),
  })
  .strict();

export const timelineCreateSchema = z
  .object({
    tableId: z.string(),
    timeline: timelineBodySchema,
    ownedBy: z.string().optional(),
  })
  .strict();

export const timelineUpdateSchema = z
  .object({
    timelineViewId: z.string(),
    timeline: timelineBodySchema,
  })
  .strict();

const viewUpdateBodySchema = z
  .object({
    title: z.string().optional(),
    description: z.string().nullable().optional(),
    uuid: z.string().nullable().optional(),
    password: z.string().nullable().optional(),
    lock_type: z.enum(LOCK_TYPES).nullable().optional(),
    meta: z
      .union([z.record(z.unknown()), z.string()])
      .nullable()
      .optional(),
    order: z.number().nonnegative().optional(),
    show_system_fields: boolType.optional(),
    owned_by: z.string().nullable().optional(),
    /** EE-only fields surfaced via `View.update` when isEE = true. */
    expanded_record_mode: z.string().nullable().optional(),
    attachment_mode_column_id: z.string().nullable().optional(),
    fk_custom_url_id: z.string().nullable().optional(),
    fk_view_section_id: z.string().nullable().optional(),
    /** ROW_COLORING_MODE enum value. Service handles `null` for cleared mode. */
    row_coloring_mode: z.string().nullable().optional(),
  })
  .strict();

export const viewUpdateSchema = z
  .object({
    viewId: z.string(),
    view: viewUpdateBodySchema,
  })
  .strict();

export const viewDeleteSchema = z
  .object({
    viewId: z.string(),
    /** Hard delete instead of trashing — used by the service when the view
     *  has no trashable artifacts (e.g. shared external view). */
    skipTrash: z.boolean().optional(),
  })
  .strict();

// ── List view levels restoration (inverse-only) ──────────────────
//
// `listViewLevelsRestore` is the inverse target of a list-view edit that
// changed the level structure (e.g. add / remove / reorder hierarchies).
// The forward op snapshots the parent list-view body + every per-level
// row before mutating; this contract replays that snapshot.

/** Snapshot of a single per-level row, mirrors `LIST_VIEW_LEVELS` columns. */
const listLevelSnapshotSchema = z
  .object({
    id: z.string(),
    level: z.number().int(),
    fk_model_id: z.string(),
    fk_link_column_id: z.string().nullable().optional(),
    enable_nested_records: boolType.nullable().optional(),
    fk_self_link_column_id: z.string().nullable().optional(),
    wrap_headers: boolType.nullable().optional(),
    meta: z
      .union([z.record(z.unknown()), z.string()])
      .nullable()
      .optional(),
    /** Per-level columns (LIST_VIEW_COLUMNS rows) bundled with the level. */
    columns: z.array(z.record(z.unknown())),
    /** Per-level sorts (SORT rows where fk_level_id = level.id). */
    sorts: z.array(z.record(z.unknown())).optional(),
    /** Per-level filter tree (FILTER_EXP rows where fk_level_id = level.id;
     *  flat list including all descendants — re-inserted in topological
     *  order on restore so fk_parent_id references resolve). */
    filters: z.array(z.record(z.unknown())).optional(),
  })
  .strict();

/** Snapshot of the parent list-view (LIST_VIEW table). */
const listViewParentSnapshotSchema = z
  .object({
    meta: z
      .union([z.record(z.unknown()), z.string()])
      .nullable()
      .optional(),
    show_empty_parents: boolType.nullable().optional(),
    row_height: z.number().int().nullable().optional(),
    fk_prefix_column_id: z.string().nullable().optional(),
  })
  .strict();

export const listViewLevelsRestoreSchema = z
  .object({
    viewId: z.string(),
    /** Optional — only present when the parent row was also changed. */
    list: listViewParentSnapshotSchema.optional(),
    levels: z.array(listLevelSnapshotSchema),
  })
  .strict();
