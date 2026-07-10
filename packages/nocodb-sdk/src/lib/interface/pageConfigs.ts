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
}

interface InterfaceVizCommon {
  id: string;
  /** Per-viz refinements — compose (AND) with the page-level filters. */
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[];
  visible_field_ids?: string[];
  color_by?: InterfaceRecordColorConfig | null;
  click_into_details?: boolean;
  /** Reusable record-detail page (layout = RECORD_DETAIL) for this table. */
  fk_detail_page_id?: string | null;
}

export interface InterfaceVizEditability {
  edit_inline?: boolean;
  add_delete_inline?: boolean;
}

export interface InterfaceGridVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.GRID;
  row_height?: 'small' | 'medium' | 'large' | 'extra_large';
  show_field_descriptions?: boolean;
  wrap_headers?: boolean;
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
}

export interface InterfaceGalleryVizConfig extends InterfaceVizCommon {
  type: InterfaceVisualizationTypes.GALLERY;
  image_field_id?: string | null;
  aspect_ratio?: string | null;
  fit_image?: boolean;
  style?: 'rich' | 'compact';
  title_field_id?: string | null;
  title_size?: 'small' | 'large';
  columns_per_row?: 'auto' | number;
  display_field_names?: boolean;
}

export interface InterfaceKanbanVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.KANBAN;
  stacking_field_id: string;
  image_field_id?: string | null;
  fit_image?: boolean;
  wrap_cell_values?: boolean;
  hide_empty_stacks?: boolean;
}

/** Aligns with the nocohub List view meta (levels over link fields). */
export interface InterfaceListLevelConfig {
  id: string;
  /** Link field (HM/MM) from this level's table to the level below. */
  fk_link_column_id?: string | null;
  fk_model_id?: string | null;
  filters?: InterfaceFilterGroup | null;
  sorts?: InterfaceSortConfig[];
  visible_field_ids?: string[];
}

export interface InterfaceListVizConfig
  extends InterfaceVizCommon,
    InterfaceVizEditability {
  type: InterfaceVisualizationTypes.LIST;
  levels?: InterfaceListLevelConfig[];
  prefix_field_id?: string | null;
  row_height?: 'small' | 'medium' | 'large';
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
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
  row_height?: 'small' | 'medium' | 'large';
  wrap_labels?: boolean;
  record_width?: 'timescale_filled' | 'fixed';
  group_by?: Array<{ fk_column_id: string; direction?: 'asc' | 'desc' }>;
  initial_view?: {
    position?: 'today' | 'earliest' | 'latest';
    timescale?:
      | 'day'
      | 'week'
      | 'two_weeks'
      | 'month'
      | 'quarter'
      | 'year';
    set_for_all_visits?: boolean;
  };
}

export type InterfaceVisualizationConfig =
  | InterfaceGridVizConfig
  | InterfaceGalleryVizConfig
  | InterfaceKanbanVizConfig
  | InterfaceListVizConfig
  | InterfaceCalendarVizConfig
  | InterfaceTimelineVizConfig;

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
  allow_row_height?: boolean;
  /** References a reusable form page; renders the "+ Add record" button. */
  add_record_form_page_id?: string | null;
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
    add_record_form_page_id?: string | null;
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
// Layout → config mapping
// ────────────────────────────────────────────────────────────────────────────

export interface InterfacePageConfigMap {
  [InterfacePageLayoutTypes.TABLE]: InterfaceTablePageConfig;
  [InterfacePageLayoutTypes.RECORD_REVIEW]: InterfaceRecordReviewPageConfig;
  [InterfacePageLayoutTypes.DASHBOARD]: InterfaceDashboardPageConfig;
  [InterfacePageLayoutTypes.FORM]: InterfaceFormPageConfig;
  [InterfacePageLayoutTypes.OVERVIEW]: InterfaceOverviewPageConfig;
  [InterfacePageLayoutTypes.RECORD_DETAIL]: InterfaceRecordDetailPageConfig;
}

export type InterfacePageConfigFor<L extends InterfacePageLayoutTypes> =
  InterfacePageConfigMap[L];

export type AnyInterfacePageConfig =
  InterfacePageConfigMap[InterfacePageLayoutTypes];
