/**
 * Shared element vocabulary for Interface page configs.
 *
 * These shapes recur across layouts (table pages, record review, dashboards,
 * record-detail pages and forms). All config JSON fields are snake_case by
 * convention — matching entity rows, API payloads and view sub-meta JSON.
 */

import type { Validation } from '../form';

/**
 * Filter tree stored inside page configs.
 *
 * Shape mirrors the ad-hoc `filterArrJson` Filter tree the data layer already
 * accepts (`conditionV2`), so backends can apply config filters at query time
 * without persisting `nc_filter_exp` rows (filters must live inside the
 * draft/published config snapshot).
 */
export interface InterfaceFilterLeaf {
  fk_column_id: string;
  comparison_op: string;
  comparison_sub_op?: string | null;
  value?: unknown;
  logical_op?: 'and' | 'or';
}

export interface InterfaceFilterGroup {
  is_group: true;
  logical_op?: 'and' | 'or';
  children: InterfaceFilterNode[];
}

export type InterfaceFilterNode = InterfaceFilterLeaf | InterfaceFilterGroup;

export const isInterfaceFilterGroup = (
  node: InterfaceFilterNode
): node is InterfaceFilterGroup =>
  (node as InterfaceFilterGroup).is_group === true;

export interface InterfaceSortConfig {
  fk_column_id: string;
  direction: 'asc' | 'desc';
}

/** Record coloring — select-field based or conditional. */
export interface InterfaceRecordColorCondition {
  id: string;
  color: string;
  filters: InterfaceFilterGroup;
}

/** Background-fill tint strength for record colouring. */
export type InterfaceRecordColorFillIntensity = 'light' | 'medium' | 'bold';

export type InterfaceRecordColorConfig =
  | {
      mode: 'select_field';
      fk_column_id: string;
      /**
       * Fill the whole record with a tint of the colour instead of a
       * left-edge accent. Absent = accent only.
       */
      background_fill?: InterfaceRecordColorFillIntensity;
    }
  | { mode: 'conditions'; conditions: InterfaceRecordColorCondition[] };

// ────────────────────────────────────────────────────────────────────────────
// Buttons
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceButtonActionTypes {
  EXTERNAL_URL = 'external_url',
  INTERFACE_PAGE = 'interface_page',
  OPEN_RECORD_FORM = 'open_record_form',
  UPDATE_RECORD = 'update_record',
  COPY_RECORD_LINK = 'copy_record_link',
  DELETE_RECORD = 'delete_record',
}

export interface InterfaceButtonConfirmation {
  title?: string;
  message?: string;
  button_label?: string;
}

interface InterfaceButtonBase {
  id: string;
  label?: string;
  color?: string;
  require_confirmation?: boolean;
  confirmation?: InterfaceButtonConfirmation;
  /** Conditional visibility — no rules means always visible. */
  visibility?: InterfaceFilterGroup | null;
}

export interface InterfaceButtonExternalUrl extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.EXTERNAL_URL;
  url: string;
  open_in_new_tab?: boolean;
}

export interface InterfaceButtonInterfacePage extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.INTERFACE_PAGE;
  fk_page_id: string;
  open_in_new_tab?: boolean;
}

/**
 * Record-insert action — opens the referenced record-detail page (layout =
 * RECORD_DETAIL) as an expanded-record modal bound to a new draft row. Field
 * visibility/editability comes from the record-detail config; the same page
 * serves expanded existing records (click-into-details).
 */
export interface InterfaceButtonOpenRecordForm extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.OPEN_RECORD_FORM;
  /** References a reusable record-detail page (layout = RECORD_DETAIL). */
  fk_detail_page_id: string;
}

/** Record-scoped — valid only inside record-detail / record-review contexts. */
export interface InterfaceButtonUpdateRecord extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.UPDATE_RECORD;
  updates: Array<{ fk_column_id: string; value: unknown }>;
  move_to_next_after?: boolean;
  appearance_after?: {
    color?: string;
    label?: string;
    show_check_icon?: boolean;
  };
}

export interface InterfaceButtonCopyRecordLink extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.COPY_RECORD_LINK;
}

/** Confirmation is forced on for delete — enforced by validation. */
export interface InterfaceButtonDeleteRecord extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.DELETE_RECORD;
}

export type InterfaceButtonConfig =
  | InterfaceButtonExternalUrl
  | InterfaceButtonInterfacePage
  | InterfaceButtonOpenRecordForm
  | InterfaceButtonUpdateRecord
  | InterfaceButtonCopyRecordLink
  | InterfaceButtonDeleteRecord;

/** Navigation-only button actions — the subset allowed outside record scope. */
export const INTERFACE_NAV_BUTTON_ACTIONS = [
  InterfaceButtonActionTypes.EXTERNAL_URL,
  InterfaceButtonActionTypes.INTERFACE_PAGE,
  InterfaceButtonActionTypes.OPEN_RECORD_FORM,
] as const;

// ────────────────────────────────────────────────────────────────────────────
// User filters (end-user facing filter elements)
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceUserFilterTypes {
  NONE = 'none',
  TABS = 'tabs',
  DROPDOWN = 'dropdown',
}

export interface InterfaceUserFilterTab {
  id: string;
  title: string;
  filters?: InterfaceFilterGroup | null;
  /**
   * TABLE pages only — id of a visualization defined on the same page to
   * activate when this tab is selected. Optional; unset keeps the current
   * visualization. Ignored by other layouts hosting tabs (dashboard groups,
   * record review), which have no visualizations.
   */
  default_viz_id?: string | null;
}

export enum InterfaceUserFilterDropdownConditions {
  IS = 'is',
  IS_NOT = 'is_not',
  IS_EMPTY = 'is_empty',
  IS_NOT_EMPTY = 'is_not_empty',
}

export interface InterfaceUserFilterDropdown {
  id: string;
  name?: string;
  /** Single-select (or select-like) field driving the dropdown options. */
  fk_column_id: string;
  condition: InterfaceUserFilterDropdownConditions;
  /** One of the field's option values; null/undefined = "Not set". */
  default_value?: string | null;
}

export type InterfaceUserFilterConfig =
  | { type: InterfaceUserFilterTypes.NONE }
  | {
      type: InterfaceUserFilterTypes.TABS;
      tabs: InterfaceUserFilterTab[];
      include_all_records?: boolean;
      all_records_label?: string | null;
      /** TABLE pages only — the "All records" tab's `default_viz_id` twin (that tab is synthetic, it has no tab object). */
      all_records_default_viz_id?: string | null;
    }
  | {
      type: InterfaceUserFilterTypes.DROPDOWN;
      dropdowns: InterfaceUserFilterDropdown[];
    };

// ────────────────────────────────────────────────────────────────────────────
// Field elements & groups (record-detail pages and forms)
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceFieldPermissions {
  VIEW_ONLY = 'view_only',
  EDITABLE = 'editable',
}

/**
 * Per-option overlay for select fields — mirrors the classic form view's
 * `meta.limitOptions`. Carries each option's display `order` (float, midpoint
 * insertion — never renumbered contiguously) and `show` visibility. The array
 * is a partial overlay keyed by option title; the source of truth for which
 * options exist stays the column's `colOptions`.
 */
export interface InterfaceLimitOption {
  /**
   * The option's `title`, not its row id — every `Column.update` re-inserts
   * the option rows and every export/import mints fresh ids, while titles are
   * uniqueness-enforced per column and are what row data stores.
   */
  key: string;
  order: number;
  show: boolean;
}

export interface InterfaceFieldElementRules {
  /** Conditional visibility — no rules means always visible. */
  visibility?: InterfaceFilterGroup | null;
  /** Form context only ↓ */
  default_value?: unknown;
  required?: boolean;
  character_limit?: number | null;
  /**
   * Type-specific validators (number/date/time/text/select/attachment) — reuses
   * the classic form's `Validation[]`; enforced client-side on submit.
   */
  validators?: Validation[] | null;
  /**
   * Rich select-option overlay — per-option display order + visibility
   * (form-view "Limit options" parity: drag to reorder, eye to hide).
   * Absent = no limiting (all options shown).
   */
  limit_options?: InterfaceLimitOption[] | null;
}

export interface InterfaceFieldElementConfig {
  id: string;
  fk_column_id: string;
  /**
   * Hidden from the rendered form while KEEPING the whole element config
   * (labels, rules, validators…) — the fields panel's eye toggles this, so
   * hide/re-show is lossless (form-view parity).
   */
  hidden?: boolean;
  /** Label override — defaults to the base field name. */
  label?: string | null;
  show_label?: boolean;
  helper_text?: string | null;
  permissions?: InterfaceFieldPermissions;
  allow_inline_editing?: boolean;
  /** Select-type fields: allow end users to create new options. */
  allow_add_new_option?: boolean;
  /** Links/LTAR fields only: clicking a linked record expands it into the
   *  LINKED table's record-detail sheet — absent = DISABLED. */
  click_into_details?: boolean;
  /** Record-detail page (layout = RECORD_DETAIL) of the LINKED table. */
  fk_detail_page_id?: string | null;
  appearance?: {
    size?: 'default' | 'lg' | 'xl';
    /** Per-type style variant, e.g. single select: 'field' | 'list' | 'stepper'. */
    style?: string;
    /** Horizontal cap within the field's layout row — absent = full. */
    width?: 'third' | 'half' | 'full';
  };
  rules?: InterfaceFieldElementRules;
}

/** One layout row of a group — 1..n fields share it left→right (Airtable sectionGridRow). */
export interface InterfaceFieldRowConfig {
  id: string;
  fields: InterfaceFieldElementConfig[];
}

export interface InterfaceFieldGroupConfig {
  id: string;
  title?: string;
  description?: string;
  /** Row layout (preferred) — each row holds 1..n side-by-side fields. */
  rows?: InterfaceFieldRowConfig[];
  /** Legacy flat list — normalized to one-field-per-row on read; writers emit `rows`. */
  fields?: InterfaceFieldElementConfig[];
  appearance?: {
    show_title?: boolean;
    show_description?: boolean;
    show_background_color?: boolean;
    background_color?: string | null;
    field_labels?: 'side' | 'top';
  };
  user_actions?: {
    /** Off = every field in this group becomes non-editable. */
    allow_inline_editing?: boolean;
    buttons?: InterfaceButtonConfig[];
  };
  /** Conditional group visibility. */
  visibility?: InterfaceFilterGroup | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Record detail (shared shape: record-review right pane, record-detail pages,
// click-into-details from visualizations, chart drill-down)
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceEditFieldsModes {
  OFF = 'off',
  INLINE = 'inline',
  FORM = 'form',
}

export interface InterfaceRecordDetailConfig {
  /** Defaults to the table's display field. */
  title_field_id?: string | null;
  /** Shown under the title when the page opens as a record-creation modal. */
  description?: string;
  groups: InterfaceFieldGroupConfig[];
  appearance?: {
    title_size?: 'lg' | 'xl';
    full_width?: boolean;
  };
  group_nav?: {
    tab_navigation?: boolean;
    collapsible_groups?: boolean;
  };
  /** Create-modal chrome — used when the page opens as a record-creation form. */
  submission?: {
    /** Defaults to "Create". */
    button_label?: string;
    success_message?: string;
  };
  user_actions?: {
    edit_fields?: InterfaceEditFieldsModes;
    /** Required when edit_fields = FORM — references a form page (action: update). */
    edit_form_page_id?: string | null;
    comments?: boolean;
    revision_history?: boolean;
    allow_print?: boolean;
    buttons?: InterfaceButtonConfig[];
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Record forms (create/update) — one config, two render modes (page | modal)
// ────────────────────────────────────────────────────────────────────────────

export enum InterfaceFormActions {
  CREATE = 'create',
  UPDATE = 'update',
}

export interface InterfaceFormSubmissionConfig {
  /** Defaults to "Submit". */
  button_label?: string;
  success_message?: string;
  show_submit_another?: boolean;
  /** Base collaborators notified on each submission. */
  notify_user_ids?: string[];
}

export interface InterfaceFormConfig {
  action?: InterfaceFormActions;
  description?: string;
  /** Attachment refs — nav-page render mode only. */
  cover_image?: string | null;
  logo?: string | null;
  groups: InterfaceFieldGroupConfig[];
  submission?: InterfaceFormSubmissionConfig;
  /** Visitor-facing actions — default hidden/opt-in. */
  user_actions?: {
    allow_print?: boolean;
  };
}
