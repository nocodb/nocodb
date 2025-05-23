import { z } from 'zod'

// Helper for nullable datetime
const datetimeSchema = z.string().datetime({ offset: false }).nullable().optional()

// nc_base_users_v2
export const ncBaseUsersV2Schema = z.object({
  base_id: z.string().max(20).nonempty(),
  fk_user_id: z.string().max(20).nonempty(),
  roles: z.string().nullable(),
  starred: z.boolean().nullable(),
  pinned: z.boolean().nullable(),
  group: z.string().max(255).nullable(),
  color: z.string().max(255).nullable(),
  order: z.number().nullable(),
  hidden: z.number().nullable(),
  opened_date: datetimeSchema,
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  invited_by: z.string().max(20).nullable(),
})
export type NcBaseUsersV2 = z.infer<typeof ncBaseUsersV2Schema>

// nc_bases_v2
export const ncBasesV2Schema = z.object({
  id: z.string().max(128),
  title: z.string().max(255).nullable(),
  prefix: z.string().max(255).nullable(),
  status: z.string().max(255).nullable(),
  description: z.string().nullable(),
  meta: z.string().nullable(),
  color: z.string().max(255).nullable(),
  uuid: z.string().max(255).nullable(),
  password: z.string().max(255).nullable(),
  roles: z.string().max(255).nullable(),
  deleted: z.boolean().default(false),
  is_meta: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcBasesV2 = z.infer<typeof ncBasesV2Schema>

// nc_calendar_view_columns_v2
export const ncCalendarViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  source_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  show: z.boolean().nullable(),
  bold: z.boolean().nullable(),
  underline: z.boolean().nullable(),
  italic: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcCalendarViewColumnsV2 = z.infer<typeof ncCalendarViewColumnsV2Schema>

// nc_calendar_view_range_v2
export const ncCalendarViewRangeV2Schema = z.object({
  id: z.string().max(20),
  fk_view_id: z.string().max(20).nullable(),
  fk_to_column_id: z.string().max(20).nullable(),
  label: z.string().max(40).nullable(),
  fk_from_column_id: z.string().max(20).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcCalendarViewRangeV2 = z.infer<typeof ncCalendarViewRangeV2Schema>

// nc_calendar_view_v2
export const ncCalendarViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  source_id: z.string().max(20).nullable(),
  title: z.string().max(255).nullable(),
  fk_cover_image_col_id: z.string().max(20).nullable(),
  meta: z.string().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcCalendarViewV2 = z.infer<typeof ncCalendarViewV2Schema>

// nc_col_barcode_v2
export const ncColBarcodeV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  fk_barcode_value_column_id: z.string().max(20).nullable(),
  barcode_format: z.string().max(15).nullable(),
  deleted: z.boolean().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcColBarcodeV2 = z.infer<typeof ncColBarcodeV2Schema>

// nc_col_button_v2
export const ncColButtonV2Schema = z.object({
  id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  type: z.string().max(255).nullable(),
  label: z.string().nullable(),
  theme: z.string().max(255).nullable(),
  color: z.string().max(255).nullable(),
  icon: z.string().max(255).nullable(),
  formula: z.string().nullable(),
  formula_raw: z.string().nullable(),
  error: z.string().max(255).nullable(),
  parsed_tree: z.string().nullable(),
  fk_webhook_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  fk_integration_id: z.string().max(20).nullable(),
  model: z.string().max(255).nullable(),
  output_column_ids: z.string().nullable(),
  fk_workspace_id: z.string().max(20).nullable(),
})
export type NcColButtonV2 = z.infer<typeof ncColButtonV2Schema>

// nc_col_formula_v2
export const ncColFormulaV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  formula: z.string().nonempty(),
  formula_raw: z.string().nullable(),
  error: z.string().nullable(),
  deleted: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  parsed_tree: z.string().nullable(),
  base_id: z.string().max(20).nullable(),
})
export type NcColFormulaV2 = z.infer<typeof ncColFormulaV2Schema>

// nc_col_long_text_v2
export const ncColLongTextV2Schema = z.object({
  id: z.string().max(20),
  fk_workspace_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_model_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  fk_integration_id: z.string().max(20).nullable(),
  model: z.string().max(255).nullable(),
  prompt: z.string().nullable(),
  prompt_raw: z.string().nullable(),
  error: z.string().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcColLongTextV2 = z.infer<typeof ncColLongTextV2Schema>

// nc_col_lookup_v2
export const ncColLookupV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  fk_relation_column_id: z.string().max(20).nullable(),
  fk_lookup_column_id: z.string().max(20).nullable(),
  deleted: z.boolean().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcColLookupV2 = z.infer<typeof ncColLookupV2Schema>

// nc_col_qrcode_v2
export const ncColQrcodeV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  fk_qr_value_column_id: z.string().max(20).nullable(),
  deleted: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcColQrcodeV2 = z.infer<typeof ncColQrcodeV2Schema>

// nc_col_relations_v2
export const ncColRelationsV2Schema = z.object({
  id: z.string().max(20),
  ref_db_alias: z.string().max(255).nullable(),
  type: z.string().max(255).nullable(),
  virtual: z.boolean().nullable(),
  db_type: z.string().max(255).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  fk_related_model_id: z.string().max(20).nullable(),
  fk_child_column_id: z.string().max(20).nullable(),
  fk_parent_column_id: z.string().max(20).nullable(),
  fk_mm_model_id: z.string().max(20).nullable(),
  fk_mm_child_column_id: z.string().max(20).nullable(),
  fk_mm_parent_column_id: z.string().max(20).nullable(),
  ur: z.string().max(255).nullable(),
  dr: z.string().max(255).nullable(),
  fk_index_name: z.string().max(255).nullable(),
  deleted: z.boolean().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  fk_target_view_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
})
export type NcColRelationsV2 = z.infer<typeof ncColRelationsV2Schema>

// nc_col_rollup_v2
export const ncColRollupV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  fk_relation_column_id: z.string().max(20).nullable(),
  fk_rollup_column_id: z.string().max(20).nullable(),
  rollup_function: z.string().max(255).nullable(),
  deleted: z.boolean().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcColRollupV2 = z.infer<typeof ncColRollupV2Schema>

// nc_col_select_options_v2
export const ncColSelectOptionsV2Schema = z.object({
  id: z.string().max(20),
  fk_column_id: z.string().max(20).nullable(),
  title: z.string().max(255).nullable(),
  color: z.string().max(255).nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  base_id: z.string().max(20).nullable(),
})
export type NcColSelectOptionsV2 = z.infer<typeof ncColSelectOptionsV2Schema>

// nc_columns_v2
export const ncColumnsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_model_id: z.string().max(20).nullable(),
  title: z.string().max(255).nullable(),
  column_name: z.string().max(255).nullable(),
  uidt: z.string().max(255).nullable(),
  dt: z.string().max(255).nullable(),
  np: z.string().max(255).nullable(),
  ns: z.string().max(255).nullable(),
  clen: z.string().max(255).nullable(),
  cop: z.string().max(255).nullable(),
  pk: z.boolean().nullable(),
  pv: z.boolean().nullable(),
  rqd: z.boolean().nullable(),
  un: z.boolean().nullable(),
  ct: z.string().nullable(),
  ai: z.boolean().nullable(),
  unique: z.boolean().nullable(),
  cdf: z.string().nullable(),
  cc: z.string().nullable(),
  csn: z.string().max(255).nullable(),
  dtx: z.string().max(255).nullable(),
  dtxp: z.string().nullable(),
  dtxs: z.string().max(255).nullable(),
  au: z.boolean().nullable(),
  validate: z.string().nullable(),
  virtual: z.boolean().nullable(),
  deleted: z.boolean().nullable(),
  system: z.boolean().default(false),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
  description: z.string().nullable(),
  readonly: z.boolean().default(false),
  custom_index_name: z.string().max(64).nullable(),
})
export type NcColumnsV2 = z.infer<typeof ncColumnsV2Schema>

// nc_data_reflection
export const ncDataReflectionSchema = z.object({
  id: z.string().max(20),
  fk_workspace_id: z.string().max(20).nullable(),
  username: z.string().max(255).nullable(),
  password: z.string().max(255).nullable(),
  database: z.string().max(255).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcDataReflection = z.infer<typeof ncDataReflectionSchema>

// nc_disabled_models_for_role_v2
export const ncDisabledModelsForRoleV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  role: z.string().max(45).nullable(),
  disabled: z.boolean().default(true),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcDisabledModelsForRoleV2 = z.infer<typeof ncDisabledModelsForRoleV2Schema>

// nc_extensions
export const ncExtensionsSchema = z.object({
  id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  fk_user_id: z.string().max(20).nullable(),
  extension_id: z.string().max(255).nullable(),
  title: z.string().max(255).nullable(),
  kv_store: z.string().nullable(),
  meta: z.string().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcExtensions = z.infer<typeof ncExtensionsSchema>

// nc_filter_exp_v2
export const ncFilterExpV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_hook_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  fk_parent_id: z.string().max(20).nullable(),
  logical_op: z.string().max(255).nullable(),
  comparison_op: z.string().max(255).nullable(),
  value: z.string().nullable(),
  is_group: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  comparison_sub_op: z.string().max(255).nullable(),
  fk_link_col_id: z.string().max(20).nullable(),
  fk_value_col_id: z.string().max(20).nullable(),
  fk_parent_column_id: z.string().max(20).nullable(),
})
export type NcFilterExpV2 = z.infer<typeof ncFilterExpV2Schema>

// nc_form_view_columns_v2
export const ncFormViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  label: z.string().nullable(),
  help: z.string().nullable(),
  description: z.string().nullable(),
  required: z.boolean().nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
  enable_scanner: z.boolean().nullable(),
})
export type NcFormViewColumnsV2 = z.infer<typeof ncFormViewColumnsV2Schema>

// nc_form_view_v2
export const ncFormViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  heading: z.string().max(255).nullable(),
  subheading: z.string().nullable(),
  success_msg: z.string().nullable(),
  redirect_url: z.string().nullable(),
  redirect_after_secs: z.string().max(255).nullable(),
  email: z.string().max(255).nullable(),
  submit_another_form: z.boolean().nullable(),
  show_blank_form: z.boolean().nullable(),
  uuid: z.string().max(255).nullable(),
  banner_image_url: z.string().nullable(),
  logo_url: z.string().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
})
export type NcFormViewV2 = z.infer<typeof ncFormViewV2Schema>

// nc_gallery_view_columns_v2
export const ncGalleryViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  label: z.string().max(255).nullable(),
  help: z.string().max(255).nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcGalleryViewColumnsV2 = z.infer<typeof ncGalleryViewColumnsV2Schema>

// nc_gallery_view_v2
export const ncGalleryViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  next_enabled: z.boolean().nullable(),
  prev_enabled: z.boolean().nullable(),
  cover_image_idx: z.number().nullable(),
  fk_cover_image_col_id: z.string().max(20).nullable(),
  cover_image: z.string().max(255).nullable(),
  restrict_types: z.string().max(255).nullable(),
  restrict_size: z.string().max(255).nullable(),
  restrict_number: z.string().max(255).nullable(),
  public: z.boolean().nullable(),
  dimensions: z.string().max(255).nullable(),
  responsive_columns: z.string().max(255).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
})
export type NcGalleryViewV2 = z.infer<typeof ncGalleryViewV2Schema>

// nc_grid_view_columns_v2
export const ncGridViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  label: z.string().max(255).nullable(),
  help: z.string().max(255).nullable(),
  width: z.string().max(255).default('200px'),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  group_by: z.boolean().nullable(),
  group_by_order: z.number().nullable(),
  group_by_sort: z.string().max(255).nullable(),
  aggregation: z.string().max(30).nullable(),
})
export type NcGridViewColumnsV2 = z.infer<typeof ncGridViewColumnsV2Schema>

// nc_grid_view_v2
export const ncGridViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
  row_height: z.number().nullable(),
})
export type NcGridViewV2 = z.infer<typeof ncGridViewV2Schema>

// nc_hooks_v2
export const ncHooksV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_model_id: z.string().max(20).nullable(),
  title: z.string().max(255).nullable(),
  description: z.string().max(255).nullable(),
  env: z.string().max(255).default('all'),
  type: z.string().max(255).nullable(),
  event: z.string().max(255).nullable(),
  operation: z.string().max(255).nullable(),
  async: z.boolean().default(false),
  payload: z.boolean().default(true),
  url: z.string().nullable(),
  headers: z.string().nullable(),
  condition: z.boolean().default(false),
  notification: z.string().nullable(),
  retries: z.number().default(0),
  retry_interval: z.number().default(60000),
  timeout: z.number().default(60000),
  active: z.boolean().default(true),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  version: z.string().max(255).nullable(),
})
export type NcHooksV2 = z.infer<typeof ncHooksV2Schema>

// nc_integrations_v2
export const ncIntegrationsV2Schema = z.object({
  id: z.string().max(20),
  title: z.string().max(128).nullable(),
  config: z.string().nullable(),
  meta: z.string().nullable(),
  type: z.string().max(20).nullable(),
  sub_type: z.string().max(20).nullable(),
  is_private: z.boolean().default(false),
  deleted: z.boolean().default(false),
  created_by: z.string().max(20).nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  is_default: z.boolean().default(false),
  is_encrypted: z.boolean().default(false),
})
export type NcIntegrationsV2 = z.infer<typeof ncIntegrationsV2Schema>

// nc_jobs
export const ncJobsSchema = z.object({
  id: z.string().max(20),
  job: z.string().max(255).nullable(),
  status: z.string().max(20).nullable(),
  result: z.string().nullable(),
  fk_user_id: z.string().max(20).nullable(),
  fk_workspace_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcJobs = z.infer<typeof ncJobsSchema>

// nc_kanban_view_columns_v2
export const ncKanbanViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  label: z.string().max(255).nullable(),
  help: z.string().max(255).nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcKanbanViewColumnsV2 = z.infer<typeof ncKanbanViewColumnsV2Schema>

// nc_kanban_view_v2
export const ncKanbanViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  uuid: z.string().max(255).nullable(),
  title: z.string().max(255).nullable(),
  public: z.boolean().nullable(),
  password: z.string().max(255).nullable(),
  show_all_fields: z.boolean().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  fk_grp_col_id: z.string().max(20).nullable(),
  fk_cover_image_col_id: z.string().max(20).nullable(),
  meta: z.string().nullable(),
})
export type NcKanbanViewV2 = z.infer<typeof ncKanbanViewV2Schema>

// nc_map_view_columns_v2
export const ncMapViewColumnsV2Schema = z.object({
  id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  project_id: z.string().max(128).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  label: z.string().max(255).nullable(),
  help: z.string().max(255).nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcMapViewColumnsV2 = z.infer<typeof ncMapViewColumnsV2Schema>

// nc_map_view_v2
export const ncMapViewV2Schema = z.object({
  fk_view_id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  uuid: z.string().max(255).nullable(),
  title: z.string().max(255).nullable(),
  fk_geo_data_col_id: z.string().max(20).nullable(),
  meta: z.string().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcMapViewV2 = z.infer<typeof ncMapViewV2Schema>

// nc_models_v2
export const ncModelsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  table_name: z.string().max(255).nullable(),
  title: z.string().max(255).nullable(),
  type: z.string().max(255).default('table'),
  meta: z.string().nullable(),
  schema: z.string().nullable(),
  enabled: z.boolean().default(true),
  mm: z.boolean().default(false),
  tags: z.string().max(255).nullable(),
  pinned: z.boolean().nullable(),
  deleted: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  description: z.string().nullable(),
  synced: z.boolean().default(false),
})
export type NcModelsV2 = z.infer<typeof ncModelsV2Schema>

// nc_shared_bases
export const ncSharedBasesSchema = z.object({
  id: z.number(),
  project_id: z.string().max(255).nullable(),
  db_alias: z.string().max(255).nullable(),
  roles: z.string().max(255).default('viewer'),
  shared_base_id: z.string().max(255).nullable(),
  enabled: z.boolean().default(true),
  password: z.string().max(255).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcSharedBases = z.infer<typeof ncSharedBasesSchema>

// nc_shared_views_v2
export const ncSharedViewsV2Schema = z.object({
  id: z.string().max(20),
  fk_view_id: z.string().max(20).nullable(),
  meta: z.string().nullable(),
  query_params: z.string().nullable(),
  view_id: z.string().max(255).nullable(),
  show_all_fields: z.boolean().nullable(),
  allow_copy: z.boolean().nullable(),
  password: z.string().max(255).nullable(),
  deleted: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcSharedViewsV2 = z.infer<typeof ncSharedViewsV2Schema>

// nc_sort_v2
export const ncSortV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_view_id: z.string().max(20).nullable(),
  fk_column_id: z.string().max(20).nullable(),
  direction: z.string().max(255).default('false'),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcSortV2 = z.infer<typeof ncSortV2Schema>

// nc_sources_v2
export const ncSourcesV2Schema = z.object({
  id: z.string().max(20),
  base_id: z.string().max(20).nullable(),
  alias: z.string().max(255).nullable(),
  config: z.string().nullable(),
  meta: z.string().nullable(),
  is_meta: z.boolean().nullable(),
  type: z.string().max(255).nullable(),
  inflection_column: z.string().max(255).nullable(),
  inflection_table: z.string().max(255).nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  enabled: z.boolean().default(true),
  order: z.number().nullable(),
  description: z.string().max(255).nullable(),
  erd_uuid: z.string().max(255).nullable(),
  deleted: z.boolean().default(false),
  is_schema_readonly: z.boolean().default(false),
  is_data_readonly: z.boolean().default(false),
  fk_integration_id: z.string().max(20).nullable(),
  is_local: z.boolean().default(false),
  is_encrypted: z.boolean().default(false),
})
export type NcSourcesV2 = z.infer<typeof ncSourcesV2Schema>

// nc_sync_configs
export const ncSyncConfigsSchema = z.object({
  id: z.string().max(20),
  fk_workspace_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_integration_id: z.string().max(20).nullable(),
  fk_model_id: z.string().max(20).nullable(),
  sync_type: z.string().max(255).nullable(),
  sync_trigger: z.string().max(255).nullable(),
  sync_trigger_cron: z.string().max(255).nullable(),
  sync_trigger_secret: z.string().max(255).nullable(),
  sync_job_id: z.string().max(255).nullable(),
  last_sync_at: datetimeSchema,
  next_sync_at: datetimeSchema,
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
})
export type NcSyncConfigs = z.infer<typeof ncSyncConfigsSchema>

// nc_views_v2
export const ncViewsV2Schema = z.object({
  id: z.string().max(20),
  source_id: z.string().max(20).nullable(),
  base_id: z.string().max(20).nullable(),
  fk_model_id: z.string().max(20).nullable(),
  title: z.string().max(255).nullable(),
  type: z.number().nullable(),
  is_default: z.boolean().nullable(),
  show_system_fields: z.boolean().nullable(),
  lock_type: z.string().max(255).default('collaborative'),
  uuid: z.string().max(255).nullable(),
  password: z.string().max(255).nullable(),
  show: z.boolean().nullable(),
  order: z.number().nullable(),
  created_at: datetimeSchema,
  updated_at: datetimeSchema,
  meta: z.string().nullable(),
  description: z.string().nullable(),
  created_by: z.string().max(20).nullable(),
  owned_by: z.string().max(20).nullable(),
})
export type NcViewsV2 = z.infer<typeof ncViewsV2Schema>

// sync_metadata
export const syncMetadataSchema = z.object({
  workspace_id: z.string().max(50).nonempty(),
  base_id: z.string().max(50).nonempty(),
  last_event_id: z.string().max(50).nullable(),
  last_sync_timestamp: datetimeSchema,
})
export type SyncMetadata = z.infer<typeof syncMetadataSchema>
