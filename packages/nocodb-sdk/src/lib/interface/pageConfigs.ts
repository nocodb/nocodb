/**
 * Per-layout page config shapes (draft + published), discriminated by
 * `InterfacePageLayoutTypes`. Stored as JSON in `nc_interface_pages.config` /
 * `published_config`. All fields snake_case.
 */
import type {
  InterfaceButtonConfig,
  InterfaceFilterGroup,
  InterfaceFormConfig,
  InterfaceRecordColorConfig,
  InterfaceRecordDetailConfig,
  InterfaceSortConfig,
  InterfaceUserFilterConfig,
} from './elements';
import { InterfacePageLayoutTypes } from './enums';

// ────────────────────────────────────────────────────────────────────────────
// Visualizations (table pages; also embeddable in dashboard groups)
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceVisualizationTypes {
  GRID = 'grid',
  GALLERY = 'gallery',
  KANBAN = 'kanban',
  LIST = 'list',
  CALENDAR = 'calendar',
  TIMELINE = 'timeline',
  GANTT = 'gantt',
}

/**
 * Per-column overrides curated from the viz's `Field` pane (label, inline
 * editability). Keyed by column id on `InterfaceVizCommon.field_configs`;
 * absent entries fall back to the column's own title / the viz-level defaults.
 */
export interface InterfaceVizFieldConfig {
  /** Header label override — falls back to the source column's title. */
  label?: string;
  /** Column is editable inline in the runtime list/grid (refines the
   *  viz-level `edit_inline`). Absent = inherit the viz default. */
  edit_inline?: boolean;
  /** Links/LTAR columns only: clicking a linked record expands it into the
   *  LINKED table's record-detail sheet — absent = DISABLED. */
  click_into_details?: boolean;
  /** Record-detail page (layout = RECORD_DETAIL) of the LINKED table. */
  fk_detail_page_id?: string | null;
  /** Grid footer / group-header summary aggregation for this column ('sum',
   *  'avg', … — the Aggregations families). Absent/'none' = no summary. */
  aggregation?: string;
  /** Rendered column width as a CSS px string ('240px') — the shape
   *  `GridColumnType.width` carries, so it can be stamped straight onto the
   *  synthetic meta. Written by the grid's own header resize; interface-only
   *  (the source table's grid views keep their own widths). Absent = the
   *  renderer default. */
  width?: string;
}

interface InterfaceVizCommon {
  id: string;
  /** Per-viz refinements — compose (AND) with the page-level filters. */
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[];
  visible_field_ids?: string[];
  /**
   * Display ORDER of the viz's columns, independent of visibility — written by
   * the builder's Fields pane (every viz type) and, on grids, by the column
   * header drag as well. Interface-only; the source table's grid views keep
   * their own order. Listed ids come first in this order; anything unlisted (a
   * newly added column, a field revealed later) follows in table order. Kept
   * separate from `visible_field_ids` on purpose: that array normalizes to
   * `undefined` when everything is visible, which would drop the order — and
   * materializing it would opt the viz out of auto-showing new columns.
   */
  field_order?: string[];
  /** Per-column overrides (label, inline-edit), keyed by column id. */
  field_configs?: Record<string, InterfaceVizFieldConfig>;
  color_by?: InterfaceRecordColorConfig | null;
  /** Row click opens the record-detail sheet — absent = DISABLED; enabling
   *  always binds a real RECORD_DETAIL page (no synthesized default). */
  click_into_details?: boolean;
  /** Reusable record-detail page (layout = RECORD_DETAIL) for this table. */
  fk_detail_page_id?: string | null;
}

export interface InterfaceVizEditability {
  edit_inline?: boolean;
  add_delete_inline?: boolean;
}

/**
 * Group-key ordering for a grid viz's `group_by` — by the group VALUE
 * (`asc`/`desc`) or by the group's RECORD COUNT (`count-asc`/`count-desc`),
 * matching the grid view's `group_by_sort`. Grid only: the other grouping
 * vizzes order groups client-side (list) or have no direction control, so
 * they'd silently ignore — or misapply — a count direction.
 */
export type InterfaceGridGroupByDirection =
  | 'asc'
  | 'desc'
  | 'count-asc'
  | 'count-desc';

export interface InterfaceGridGroupByConfig {
  fk_column_id: string;
  direction?: InterfaceGridGroupByDirection;
}

export interface InterfaceGridVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.GRID;
  row_height?: 'small' | 'medium' | 'large' | 'extra_large';
  show_field_descriptions?: boolean;
  group_by?: InterfaceGridGroupByConfig[];
  /** Drop the null/uncategorized group when grouping (mirrors the grid view's `hide_empty_groups` meta). */
  hide_empty_groups?: boolean;
}

/**
 * Gallery surface theme — presentation only (never fields, ordering or the
 * record-color meaning). `card` (cover on top, details below) is the default
 * when the field is absent.
 */
export type InterfaceGalleryVizTheme = 'card' | 'poster';

export interface InterfaceGalleryVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.GALLERY;
  theme?: InterfaceGalleryVizTheme;
  image_field_id?: string | null;
  aspect_ratio?: string | null;
  fit_image?: boolean;
  style?: 'rich' | 'compact';
  title_field_id?: string | null;
  title_size?: 'small' | 'large';
  /** Explicit column count (1-6) pins the card grid; 'auto' fits by width. */
  columns_per_row?: 'auto' | number;
  display_field_names?: boolean;
  /** Skip blank (non-virtual) fields on cards — no empty label/value gaps. */
  hide_empty_card_fields?: boolean;
}

/**
 * Kanban surface theme — presentation only (never fields, ordering or the
 * record-color meaning). `board` (flat surface, colour-filled cards) is the
 * default when the field is absent.
 */
export type InterfaceKanbanVizTheme = 'board' | 'columns' | 'tint' | 'compact';

export interface InterfaceKanbanVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.KANBAN;
  stacking_field_id: string;
  theme?: InterfaceKanbanVizTheme;
  image_field_id?: string | null;
  fit_image?: boolean;
  hide_empty_stacks?: boolean;
  display_field_names?: boolean;
  /** Skip blank (non-virtual) fields on cards — no empty label/value gaps. */
  hide_empty_card_fields?: boolean;
}

/**
 * Aligns with the nocohub List view meta (levels over link fields).
 * `InterfaceListVizConfig.levels` is ordered bottom-up: index 0 is the page's
 * source table (the records), each higher entry a parent table.
 */
export interface InterfaceListLevelConfig {
  id: string;
  /** Link field (HM/OM) on this level's table pointing to the level below. */
  fk_link_column_id?: string | null;
  fk_model_id?: string | null;
  /**
   * Caption shown above this level's sections in the renderer — defaults to
   * the reverse (child-side) link field's title when unset. Meaningless on
   * the leaf level (index 0), which renders rows, not sections.
   */
  label?: string;
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[];
  visible_field_ids?: string[];
  /**
   * Display ORDER of THIS level's columns — the parent-level twin of the
   * viz-level `field_order` (the LEAF rides that one, since its curation is the
   * viz's own). Same semantics: listed ids first, unlisted ids after in table
   * order, independent of visibility.
   */
  field_order?: string[];
  /**
   * Per-table "Click into record details" for parent levels — the leaf level
   * (index 0) rides the viz-level `click_into_details`/`fk_detail_page_id`
   * instead. Absent = disabled (parent rows stay inert).
   */
  click_into_details?: boolean;
  /** RECORD_DETAIL layout of THIS level's table — null/absent = default layout. */
  fk_detail_page_id?: string | null;
  /**
   * Nested records — leaf level (index 0) only. Renders the leaf's rows as a
   * depth-first tree over a self-link. Mirrors the List view's level config;
   * meaningless on parent levels.
   */
  enable_nested_records?: boolean;
  /**
   * Self-link column (leaf table → itself) driving the nested tree. Single-
   * parent shapes only (HM/BT/OM/MO) — matches `resolveNestedConfig` in the
   * backend's list-datas.service.
   */
  fk_self_link_column_id?: string | null;
}

export interface InterfaceListVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.LIST;
  levels?: InterfaceListLevelConfig[];
  prefix_field_id?: string | null;
  row_height?: 'small' | 'medium' | 'large' | 'extra_large';
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
  /** Column headers wrap to multiple lines instead of truncating. */
  wrap_headers?: boolean;
  /** Info affordance with the column description on each column header. */
  show_field_descriptions?: boolean;
  /** Sections start collapsed; expanding is the viewer's explicit action. */
  collapse_all_default?: boolean;
  /**
   * Keep parent sections with no matching children visible. Mirrors the List
   * view meta flag of the same name — absent = show (`!== false` semantics).
   */
  show_empty_parents?: boolean;
}

export interface InterfaceDateRangeConfig {
  start_field_id: string;
  end_field_id?: string | null;
}

export interface InterfaceCalendarVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.CALENDAR;
  date_ranges: InterfaceDateRangeConfig[];
  label_field_ids?: string[];
  label_image_field_id?: string | null;
  fit_image?: boolean;
  /** Event-display theme — mirrors the calendar view's `event_display_theme`. */
  event_display_theme?: 'bordered' | 'dot' | 'solid' | 'minimal' | 'pill';
  /** Per-field text formatting on the event cards (keyed by column id). */
  field_formats?: Record<
    string,
    { bold?: boolean; italic?: boolean; underline?: boolean }
  >;
  initial_view?: {
    position?: 'today' | 'earliest' | 'latest';
    timescale?: 'day' | 'week' | 'month';
    date_height?: 'compact' | 'expanded';
    show_weekends?: boolean;
    /** Always reset position/timescale on every visit. */
    set_for_all_visits?: boolean;
  };
}

export interface InterfaceTimelineVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.TIMELINE;
  date_ranges: InterfaceDateRangeConfig[];
  label_field_ids?: string[];
  label_image_field_id?: string | null;
  /** Per-field text formatting on the bar labels (keyed by column id). */
  field_formats?: Record<
    string,
    { bold?: boolean; italic?: boolean; underline?: boolean }
  >;
  row_height?: 'small' | 'medium' | 'large' | 'extra_large';
  wrap_labels?: boolean;
  record_width?: 'timescale_filled' | 'fixed';
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
  initial_view?: {
    position?: 'today' | 'earliest' | 'latest';
    timescale?: 'day' | 'week' | 'two_weeks' | 'month' | 'quarter' | 'year';
    set_for_all_visits?: boolean;
  };
}

export interface InterfaceGanttVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.GANTT;
  date_ranges: InterfaceDateRangeConfig[];
  label_field_ids?: string[];
  label_image_field_id?: string | null;
  /** Per-field text formatting on the bar labels (keyed by column id). */
  field_formats?: Record<
    string,
    { bold?: boolean; italic?: boolean; underline?: boolean }
  >;
  row_height?: 'small' | 'medium' | 'large' | 'extra_large';
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
  /** Render dependency arrows from the table-level DateDependency rule. */
  show_dependencies?: boolean;
  initial_view?: {
    position?: 'today' | 'earliest' | 'latest';
    timescale?: 'day' | 'week' | 'two_weeks' | 'month' | 'quarter' | 'year';
    set_for_all_visits?: boolean;
  };
}

export type InterfaceVisualizationConfig =
  | InterfaceGridVizConfig
  | InterfaceGalleryVizConfig
  | InterfaceKanbanVizConfig
  | InterfaceListVizConfig
  | InterfaceCalendarVizConfig
  | InterfaceTimelineVizConfig
  | InterfaceGanttVizConfig;

// ────────────────────────────────────────────────────────────────────────────
// Layout: OVERVIEW (landing page — the only layout without a source table)
// ────────────────────────────────────────────────────────────────────────────

export type InterfaceOverviewBookmark =
  | {
      id: string;
      type: 'page';
      /** Title resolves LIVE from the target page — never denormalized. */
      fk_page_id: string;
      description?: string;
      open_in_new_tab?: boolean;
    }
  | {
      id: string;
      type: 'url';
      title: string;
      url: string;
      open_in_new_tab?: boolean;
    };

/** Max 8 bookmarks/group. */
export interface InterfaceOverviewBlock {
  id: string;
  type?: 'bookmarks' | 'text';
  title?: string;
  /** Rich text. For `text` blocks this is the body ("Click to add text"). */
  description?: string;
  /** Bookmark cards tint themselves with the target page color (main area). */
  show_bookmark_color?: boolean;
  bookmarks: InterfaceOverviewBookmark[];
}

export interface InterfaceOverviewPageConfig {
  description?: string;
  cover_image?: string | null;
  logo?: string | null;
  show_sidebar?: boolean;
  blocks: InterfaceOverviewBlock[];
  sidebar_blocks: InterfaceOverviewBlock[];
}

// ────────────────────────────────────────────────────────────────────────────
// Layout: TABLE (multi-visualization page)
// ────────────────────────────────────────────────────────────────────────────

export interface InterfaceTablePageUserActions {
  allow_sort?: boolean;
  allow_search?: boolean;
  allow_filter?: boolean;
  /** Page-wide "where applicable" flags — honored by vizzes that support them. */
  allow_group_by?: boolean;
  allow_row_height?: boolean;
  buttons?: InterfaceButtonConfig[];
}

export interface InterfaceAdvancedActionsConfig {
  allow_print?: boolean;
  allow_csv_export?: boolean;
  allow_csv_import?: boolean;
}

export interface InterfaceTablePageConfig {
  description?: string;
  show_description?: boolean;
  /** Page-level builder filter — composes (AND) with per-viz filters. */
  filters?: InterfaceFilterGroup | null;
  /** ≥1 — end-user switcher shows when more than one. */
  visualizations: InterfaceVisualizationConfig[];
  default_visualization_id?: string | null;
  user_filters?: InterfaceUserFilterConfig;
  user_actions?: InterfaceTablePageUserActions;
  advanced?: InterfaceAdvancedActionsConfig;
}

// ────────────────────────────────────────────────────────────────────────────
// Layout: RECORD_REVIEW (record list pane + inlined detail pane)
// ────────────────────────────────────────────────────────────────────────────

export interface InterfaceRecordReviewListConfig {
  title?: string;
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[];
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
  item: {
    color_by?: InterfaceRecordColorConfig | null;
    image_field_id?: string | null;
    title_field_id?: string | null;
    field_1_id?: string | null;
    field_2_id?: string | null;
  };
  user_filters?: InterfaceUserFilterConfig;
  user_actions?: {
    allow_sort?: boolean;
    allow_filter?: boolean;
    allow_group?: boolean;
    buttons?: InterfaceButtonConfig[];
  };
  advanced?: InterfaceAdvancedActionsConfig;
}

export interface InterfaceRecordReviewPageConfig {
  /**
   * Page-level field allowlist from the creation wizard — scopes every
   * downstream context (list item fields, detail fields, filters).
   * Server-side projection boundary.
   */
  allowed_field_ids?: string[];
  list: InterfaceRecordReviewListConfig;
  detail: InterfaceRecordDetailConfig;
}

// ────────────────────────────────────────────────────────────────────────────
// Layout: DASHBOARD (groups of widgets)
// ────────────────────────────────────────────────────────────────────────────

/**
 * One widget inside a dashboard-page group. `type`/`config` reuse the existing
 * EE widget vocabulary (`WidgetTypes`, chart/metric configs from
 * `lib/dashboard`) so the dialect data handlers, renderers and config editors
 * work unchanged — the backend synthesizes a Widget-shaped object from this
 * entry when serving `interfaceWidgetDataGet`.
 */
export interface InterfaceDashboardWidgetConfig {
  id: string;
  title: string;
  description?: string | null;
  /** WidgetTypes value ('metric' | 'chart' | ...). */
  type: string;
  /** Widget-type-specific config (ChartWidgetConfig / MetricWidgetConfig / ...). */
  config?: Record<string, unknown> | null;
  /** Defaults to the group's source table. */
  fk_model_id?: string | null;
  fk_view_id?: string | null;
  /**
   * Widget-level filters — inline (NOT nc_filter_exp rows), composed with the
   * group's root filters at query time.
   */
  filters?: InterfaceFilterGroup | null;
  /** grid-layout-plus placement inside the group. */
  position?: { x: number; y: number; w: number; h: number };
  /** Dependency-validation flag (mirrors widget.error). */
  error?: boolean;
}

/**
 * Dashboard widgets with this `type` embed a full visualization (the table
 * page vocabulary — grid/gallery/kanban/…) inside a group. The viz config
 * rides in `widget.config.viz`; the data/meta ops address it by the WIDGET
 * id (there is no second viz id space), and the widget-level `filters`
 * (the same surface chart/metric widgets use) take precedence over any
 * filters embedded in the viz config itself.
 */
export const INTERFACE_VIEW_WIDGET_TYPE = 'view';

/** `config` payload of a `type: 'view'` dashboard widget. */
export interface InterfaceDashboardViewWidgetConfig {
  viz: InterfaceVisualizationConfig;
}

export interface InterfaceDashboardGroupConfig {
  id: string;
  title?: string;
  show_title?: boolean;
  description?: string | null;
  /** Each group binds its OWN source table. */
  fk_model_id: string;
  /** Root filters for every widget in this group. */
  filters?: InterfaceFilterGroup | null;
  appearance?: {
    width?: 'stretch' | 'fixed';
    use_background_color?: boolean;
    background_color?: string | null;
  };
  user_filters?: InterfaceUserFilterConfig;
  user_actions?: {
    allow_filter?: boolean;
    buttons?: InterfaceButtonConfig[];
  };
  widgets?: InterfaceDashboardWidgetConfig[];
}

export interface InterfaceDashboardPageConfig {
  allow_print?: boolean;
  groups: InterfaceDashboardGroupConfig[];
}

// ────────────────────────────────────────────────────────────────────────────
// Layouts: FORM / RECORD_DETAIL — page-level aliases of the shared shapes
// ────────────────────────────────────────────────────────────────────────────

export type InterfaceFormPageConfig = InterfaceFormConfig;

export type InterfaceRecordDetailPageConfig = InterfaceRecordDetailConfig;

// ────────────────────────────────────────────────────────────────────────────
// Layout: CUSTOM (sandboxed custom-code page — @nocodb/blocks interface mode)
// ────────────────────────────────────────────────────────────────────────────

interface InterfaceCustomPropertyBase {
  key: string;
  label: string;
}

/** Builder-exposed custom props a custom-code element can declare. */
export type InterfaceCustomPropertyConfig =
  | (InterfaceCustomPropertyBase & {
      type: 'boolean';
      default_value: boolean;
    })
  | (InterfaceCustomPropertyBase & {
      type: 'string';
      default_value?: string;
    })
  | (InterfaceCustomPropertyBase & {
      type: 'enum';
      possible_values: { value: string; label: string }[];
      default_value?: string;
    })
  | (InterfaceCustomPropertyBase & {
      type: 'field';
      table_key: string;
      allowed_field_ids?: string[];
      default_value?: string;
    })
  | (InterfaceCustomPropertyBase & {
      type: 'table';
      default_value?: string;
    });

/** Each source binds its OWN table (like DASHBOARD groups). */
export interface InterfaceCustomSourceConfig {
  id: string;
  fk_model_id: string;
  allowed_field_ids?: string[];
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[] | null;
  edit_records_inline?: boolean;
  add_delete_records_inline?: boolean;
  click_into_record_details?: boolean;
  fk_detail_page_id?: string | null;
}

export interface InterfaceCustomPageConfig {
  description?: string;
  show_description?: boolean;
  dev_url?: string | null;
  custom_props_schema?: InterfaceCustomPropertyConfig[];
  /** Size-capped (50KB serialized) — rides every config commit. */
  custom_props?: Record<string, unknown>;
  /** Size-capped (50KB serialized) — rides every config commit. */
  kv_store?: Record<string, unknown>;
  sources: InterfaceCustomSourceConfig[];
  user_filters?: InterfaceUserFilterConfig;
  user_actions?: {
    edit_records_inline?: boolean;
    add_delete_records_inline?: boolean;
    click_into_record_details?: boolean;
    allow_sort?: boolean;
    allow_search?: boolean;
    allow_filter?: boolean;
    buttons?: InterfaceButtonConfig[];
  };
  advanced?: InterfaceAdvancedActionsConfig;
}

// ────────────────────────────────────────────────────────────────────────────
// Layout → config mapping
// ────────────────────────────────────────────────────────────────────────────

export interface InterfacePageConfigMap {
  [InterfacePageLayoutTypes.TABLE]: InterfaceTablePageConfig;
  [InterfacePageLayoutTypes.RECORD_REVIEW]: InterfaceRecordReviewPageConfig;
  [InterfacePageLayoutTypes.DASHBOARD]: InterfaceDashboardPageConfig;
  [InterfacePageLayoutTypes.FORM]: InterfaceFormPageConfig;
  [InterfacePageLayoutTypes.OVERVIEW]: InterfaceOverviewPageConfig;
  [InterfacePageLayoutTypes.RECORD_DETAIL]: InterfaceRecordDetailPageConfig;
  [InterfacePageLayoutTypes.CUSTOM]: InterfaceCustomPageConfig;
}

export type InterfacePageConfigFor<L extends InterfacePageLayoutTypes> =
  InterfacePageConfigMap[L];

export type AnyInterfacePageConfig =
  InterfacePageConfigMap[InterfacePageLayoutTypes];
