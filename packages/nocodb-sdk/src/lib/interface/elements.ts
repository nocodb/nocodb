/**
 * Shared element vocabulary for Interface page configs.
 *
 * These shapes recur across layouts (table pages, record review, dashboards,
 * record-detail pages and forms). All config JSON fields are snake_case by
 * convention — matching entity rows, API payloads and view sub-meta JSON.
 */

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

export type InterfaceRecordColorConfig =
  | { mode: 'select_field'; fk_column_id: string }
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

export interface InterfaceButtonOpenRecordForm extends InterfaceButtonBase {
  action: InterfaceButtonActionTypes.OPEN_RECORD_FORM;
  /** References a reusable form page (layout = FORM). */
  fk_form_page_id: string;
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

export interface InterfaceFieldElementRules {
  /** Conditional visibility — no rules means always visible. */
  visibility?: InterfaceFilterGroup | null;
  /** Form context only ↓ */
  default_value?: unknown;
  required?: boolean;
  character_limit?: number | null;
  /** Allow-lists (select options / linked records / user fields). */
  allowed_option_ids?: string[] | null;
  allowed_record_ids?: string[] | null;
  allowed_user_ids?: string[] | null;
}

export interface InterfaceFieldElementConfig {
  id: string;
  fk_column_id: string;
  /** Label override — defaults to the base field name. */
  label?: string | null;
  show_label?: boolean;
  helper_text?: string | null;
  permissions?: InterfaceFieldPermissions;
  allow_inline_editing?: boolean;
  /** Select-type fields: allow end users to create new options. */
  allow_add_new_option?: boolean;
  appearance?: {
    size?: 'default' | 'lg' | 'xl';
    /** Per-type style variant, e.g. single select: 'field' | 'list' | 'stepper'. */
    style?: string;
  };
  rules?: InterfaceFieldElementRules;
}

export interface InterfaceFieldGroupConfig {
  id: string;
  title?: string;
  description?: string;
  fields: InterfaceFieldElementConfig[];
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
  groups: InterfaceFieldGroupConfig[];
  appearance?: {
    title_size?: 'lg' | 'xl';
    full_width?: boolean;
  };
  group_nav?: {
    tab_navigation?: boolean;
    collapsible_groups?: boolean;
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
}
