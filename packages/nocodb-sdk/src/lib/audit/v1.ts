import { RelationTypes, UITypes } from '~/lib';

enum AuditV1OperationTypes {
  USER_SIGNUP = 'USER_SIGNUP',
  USER_SIGNIN = 'USER_SIGNIN',
  USER_INVITE = 'USER_INVITE',

  WORKSPACE_USER_INVITE = 'WORKSPACE_USER_INVITE',
  WORKSPACE_USER_UPDATE = 'WORKSPACE_USER_UPDATE',
  WORKSPACE_USER_DELETE = 'WORKSPACE_USER_DELETE',

  USER_PASSWORD_CHANGE = 'USER_PASSWORD_CHANGE',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  USER_PASSWORD_FORGOT = 'USER_PASSWORD_FORGOT',
  USER_EMAIL_VERIFY = 'USER_EMAIL_VERIFY',

  BASE_USER_INVITE = 'BASE_USER_INVITE',
  BASE_USER_UPDATE = 'BASE_USER_UPDATE',
  BASE_USER_INVITE_RESEND = 'BASE_USER_INVITE_RESEND',

  TABLE_CREATE = 'TABLE_CREATE',
  TABLE_DELETE = 'TABLE_DELETE',

  COLUMN_CREATE = 'FIELD_CREATE',
  COLUMN_UPDATE = 'FIELD_UPDATE',
  COLUMN_DELETE = 'FIELD_DELETE',
  COLUMN_RENAME = 'FIELD_RENAME',

  ORG_USER_INVITE = 'ORG_USER_INVITE',
  ORG_USER_INVITE_RESEND = 'ORG_USER_INVITE_RESEND',

  DATA_INSERT = 'DATA_INSERT',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',

  DATA_BULK_INSERT = 'DATA_BULK_INSERT',
  DATA_BULK_UPDATE = 'DATA_BULK_UPDATE',
  DATA_BULK_DELETE = 'DATA_BULK_DELETE',
  DATA_BULK_ALL_DELETE = 'DATA_BULK_ALL_DELETE',
  DATA_BULK_ALL_UPDATE = 'DATA_BULK_ALL_UPDATE',

  DATA_LINK = 'DATA_LINK',
  DATA_UNLINK = 'DATA_UNLINK',

  WORKSPACE_CREATE = 'WORKSPACE_CREATE',
  WORKSPACE_UPDATE = 'WORKSPACE_UPDATE',
  WORKSPACE_DELETE = 'WORKSPACE_DELETE',
  WORKSPACE_RENAME = 'WORKSPACE_RENAME',

  BASE_CREATE = 'BASE_CREATE',
  BASE_UPDATE = 'BASE_UPDATE',
  BASE_DELETE = 'BASE_DELETE',
  BASE_RENAME = 'BASE_RENAME',

  VIEW_CREATE = 'VIEW_CREATE',
  VIEW_UPDATE = 'VIEW_UPDATE',
  VIEW_DELETE = 'VIEW_DELETE',
  VIEW_RENAME = 'VIEW_RENAME',

  HOOK_CREATE = 'HOOK_CREATE',
  HOOK_UPDATE = 'HOOK_UPDATE',
  HOOK_DELETE = 'HOOK_DELETE',

  HOOK_FILTER_CREATE = 'HOOK_FILTER_CREATE',
  HOOK_FILTER_UPDATE = 'HOOK_FILTER_UPDATE',
  HOOK_FILTER_DELETE = 'HOOK_FILTER_DELETE',

  VIEW_FILTER_CREATE = 'VIEW_FILTER_CREATE',
  VIEW_FILTER_UPDATE = 'VIEW_FILTER_UPDATE',
  VIEW_FILTER_DELETE = 'VIEW_FILTER_DELETE',

  LINK_FILTER_CREATE = 'LINK_FILTER_CREATE',
  LINK_FILTER_UPDATE = 'LINK_FILTER_UPDATE',
  LINK_FILTER_DELETE = 'LINK_FILTER_DELETE',

  VIEW_SORT_CREATE = 'VIEW_SORT_CREATE',
  VIEW_SORT_UPDATE = 'VIEW_SORT_UPDATE',
  VIEW_SORT_DELETE = 'VIEW_SORT_DELETE',

  SHARED_BASE_CREATE = 'SHARED_BASE_CREATE',
  SHARED_BASE_DELETE = 'SHARED_BASE_DELETE',

  SOURCE_CREATE = 'SOURCE_CREATE',
  SOURCE_UPDATE = 'SOURCE_UPDATE',
  SOURCE_DELETE = 'SOURCE_DELETE',
  SOURCE_RENAME = 'SOURCE_RENAME',

  SHARED_VIEW_DELETE = 'SHARED_VIEW_DELETE',
  SHARED_VIEW_CREATE = 'SHARED_VIEW_CREATE',
  SHARED_VIEW_UPDATE = 'SHARED_VIEW_UPDATE',

  API_TOKEN_DELETE = 'API_TOKEN_DELETE',
  API_TOKEN_CREATE = 'API_TOKEN_CREATE',

  BASE_DUPLICATE = 'BASE_DUPLICATE',
  BASE_DUPLICATE_ERROR = 'BASE_DUPLICATE_ERROR',

  TABLE_DUPLICATE = 'TABLE_DUPLICATE',
  TABLE_DUPLICATE_ERROR = 'TABLE_DUPLICATE_ERROR',

  COLUMN_DUPLICATE = 'FIELD_DUPLICATE',
  COLUMN_DUPLICATE_ERROR = 'FIELD_DUPLICATE_ERROR',

  VIEW_DUPLICATE = 'VIEW_DUPLICATE',
  VIEW_DUPLICATE_ERROR = 'VIEW_DUPLICATE_ERROR',

  FORM_COLUMN_UPDATE = 'FORM_FIELD_UPDATE',
  USER_SIGNOUT = 'USER_SIGNOUT',
  TABLE_UPDATE = 'TABLE_UPDATE',
  TABLE_RENAME = 'TABLE_RENAME',
  VIEW_COLUMN_UPDATE = 'VIEW_FIELD_UPDATE',
  UI_ACL = 'UI_ACL',
  AIRTABLE_IMPORT = 'AIRTABLE_IMPORT',
  AIRTABLE_IMPORT_ERROR = 'AIRTABLE_IMPORT_ERROR',

  INTEGRATION_CREATE = 'INTEGRATION_CREATE',
  INTEGRATION_UPDATE = 'INTEGRATION_UPDATE',
  INTEGRATION_DELETE = 'INTEGRATION_DELETE',

  SNAPSHOT_DELETE = 'SNAPSHOT_DELETE',
  SNAPSHOT_CREATE = 'SNAPSHOT_CREATE',
  SNAPSHOT_RESTORE = 'SNAPSHOT_RESTORE',

  DATA_IMPORT = 'DATA_IMPORT',
  DATA_EXPORT = 'DATA_EXPORT',
  USER_PROFILE_UPDATE = 'USER_PROFILE_UPDATE',
}

export const auditV1OperationTypesAlias = Object.values(
  AuditV1OperationTypes
).reduce((acc, key) => {
  // Convert snake_case or UPPER_SNAKE_CASE to readable format
  const readableKey = key
    .replace(/_/g, ' ') // Replace underscores with spaces
    .toLowerCase() // Convert to lowercase
    .replace(/\b[a-z]/g, (char) => char.toUpperCase()); // Capitalize each word
  acc[key] = readableKey;
  return acc;
}, {} as Record<string, string>);

/**
 * For audit logs table filter usecase only
 */
export interface AuditV1OperationsCategoryItemType {
  label: string;
  value: string;
  types: Array<AuditV1OperationTypes>;
}

/**
 * For audit logs table filter usecase only
 */
export const auditV1OperationsCategory: Record<
  string,
  AuditV1OperationsCategoryItemType
> = {
  DATA: {
    label: 'general.data',
    value: 'DATA',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) => key.startsWith('DATA_') || key.startsWith('AIRTABLE_')
    ),
  },
  FIELD: {
    label: 'objects.column',
    value: 'FIELD',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) =>
        key.startsWith('FIELD_') ||
        key.startsWith('FORM_COLUMN_') ||
        key.startsWith('VIEW_COLUMN_') ||
        key.startsWith('LINK_FILTER_')
    ),
  },
  VIEW: {
    label: 'objects.view',
    value: 'VIEW',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) => key.startsWith('VIEW_') && !key.startsWith('VIEW_COLUMN_')
    ),
  },
  TABLE: {
    label: 'objects.table',
    value: 'TABLE',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('TABLE_')
    ),
  },
  BASE: {
    label: 'objects.project',
    value: 'BASE',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) =>
        key.startsWith('BASE_') ||
        key.startsWith('SNAPSHOT_') ||
        key.startsWith('UI_ACL')
    ),
  },
  SOURCE: {
    label: 'general.source',
    value: 'SOURCE',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('SOURCE_')
    ),
  },
  SHARED: {
    label: 'general.shared',
    value: 'SHARED',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('SHARED_')
    ),
  },
  USER: {
    label: 'objects.user',
    value: 'USER',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('USER_')
    ),
  },
  WORKSPACE: {
    label: 'objects.workspace',
    value: 'WORKSPACE',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('WORKSPACE_')
    ),
  },
  HOOK: {
    label: 'objects.webhook',
    value: 'HOOK',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('HOOK_')
    ),
  },
  INTEGRATION: {
    label: 'general.integration',
    value: 'INTEGRATION',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('INTEGRATION_')
    ),
  },
  API: {
    label: 'title.apiTokens',
    value: 'API',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('API_')
    ),
  },
  ORG: {
    label: 'general.organization',
    value: 'ORG',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('ORG_')
    ),
  },
};

export type BulkAuditV1OperationTypes =
  | AuditV1OperationTypes.DATA_BULK_INSERT
  | AuditV1OperationTypes.DATA_BULK_UPDATE
  | AuditV1OperationTypes.DATA_BULK_DELETE;

export interface UserSigninPayload {}

export interface UserSignupPayload {}

export interface UserInvitePayload {
  user_id: string;
  user_email: string;
  user_name?: string;
}

export interface UserPasswordChangePayload {}

export interface UserPasswordResetPayload {}

export interface UserPasswordForgotPayload {}

export interface UserEmailVerifyPayload {}

export interface BaseUserInvitePayload {
  user_email: string;
  user_id: string;
  base_role: string;
  user_name?: string;
  base_title: string;
}

export interface BaseUserDeletePayload {
  user_email: string;
  user_id: string;
  user_role: string;
  user_name?: string;
  base_title: string;
}

export interface BaseUserInviteResendPayload {
  user_id: string;
  user_email: string;
  base_role: string;
  user_name?: string;
  base_title: string;
}

export interface BaseUserRoleUpdatePayload extends UpdatePayload {
  user_id: string;
  user_email: string;
  base_role: string;
  user_name?: string;
  base_title: string;
}

export interface UserProfileUpdatePayload extends UpdatePayload {
  user_id: string;
  user_email: string;
}

export interface TableCreatePayload {
  table_title: string;
}

export interface TableDeletePayload {
  table_title: string;
}

export interface ColumnCreatePayload {
  field_id: string;
  field_title: string;
  field_type: UITypes;
  required?: boolean;
  options?: any;
}

export interface ColumnUpdatePayload extends UpdatePayload {
  field_id: string;
  field_title: string;
  options?: any;
}

export interface ColumnRenamePayload {
  field_id: string;
  old_field_title: string;
  new_field_title: string;
}

export interface ViewColumnUpdatePayload extends UpdatePayload {
  view_type: string;
  field_id: string;
  view_id: string;
  view_title: string;
  field_title: string;
  show: boolean;
  system: boolean;
}

export interface ColumnDeletePayload {
  field_id: string;
  field_title: string;
  field_type: UITypes;
  required?: boolean;
  options?: any;
}

export interface OrgUserInvitePayload {
  fk_user_id: string;
  email: string;
  role: string;
}

export interface OrgUserInviteResendPayload {
  fk_user_id: string;
  email: string;
}

export interface DataInsertPayload {
  data: any;
  column_meta: Record<string, ColumnMeta>;
}

export interface DataUpdatePayload {
  old_data: any;
  data: any;
  column_meta: Record<string, ColumnMeta>;
}

export interface DataDeletePayload {
  data: any;
  column_meta: Record<string, ColumnMeta>;
}

// todo: replace with proper type
export type ColumnMeta = Record<string, unknown>;

export interface DataBulkInsertPayload {}

export interface DataBulkInsertPayloadRecord {}

export interface DataBulkUpdatePayload {}

export interface DataBulkDeletePayload {}
export interface DataBulkDeletePayloadRecord {
  data: Record<string, unknown>;
  column_meta: Record<string, ColumnMeta>;
}

/*
export interface DataBulkInsertPayload {
  data: any[];
}

export interface DataBulkUpdatePayload {
  old_data: any[];
  data: any[];
  no_of_records: number;
}

export interface DataBulkDeletePayload {
  data: any[];
  no_of_records: number;
}

* */

export interface DataLinkPayload {
  table_title: string;
  ref_table_title: string;
  link_field_title: string;
  link_field_id: string;
  row_id: unknown;
  ref_row_id: unknown;
  display_value: unknown;
  ref_display_value: unknown;
  type: RelationTypes;
}

export interface DataUnlinkPayload {
  table_title: string;
  ref_table_title: string;
  link_field_title: string;
  link_field_id: string;
  row_id: unknown;
  ref_row_id: unknown;
  display_value: unknown;
  ref_display_value: unknown;
  type: RelationTypes;
}

export interface UpdatePayload {
  modifications?: Record<string, unknown>;
  previous_state: Record<string, unknown>;
  [key: string]: unknown;
}

export interface UpdateDestructedPayload {
  [key: string]: unknown;
  previous_state: Record<string, unknown>;
}

/* Workspace */
export interface WorkspaceCreatePayload {
  workspace_title: string;
}

export interface WorkspaceUpdatePayload extends UpdatePayload {
  workspace_title: string;
}

export interface ViewFieldUpdatePayload extends UpdatePayload {
  view_title: string;
}

export interface WorkspaceDeletePayload {
  workspace_title: string;
}

export interface WorkspaceRenamePayload {
  new_workspace_title: string;
  old_workspace_title: string;
}

export interface WorkspaceDuplicatePayload {
  duplicated_workspace_title: string;
  source_workspace_title: string;
}

/* Base */
export interface BaseCreatePayload {
  base_title: string;
}

export interface BaseUpdatePayload extends UpdatePayload {
  base_title: string;
}

export interface BaseDeletePayload {
  base_title: string;
}

export interface BaseRenamePayload {
  new_base_title: string;
  old_base_title: string;
  error?: string;
}

export interface TableRenamePayload {
  new_table_title: string;
  old_table_title: string;
  error?: string;
}

export interface WorkspaceInvitePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  user_role: string;
}

export interface WorkspaceUserUpdatePayload extends UpdatePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_role: string;
  user_id: string;
}

export interface WorkspaceUserDeletePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  user_role: string;
}

export interface BaseDuplicatePayload {
  duplicated_base_title: string;
  duplicated_base_id: string;
  source_base_title?: string;
  source_base_id?: string;
  error?: string;
  options?: unknown;
}

export interface ColumnDuplicatePayload {
  source_field_title: string;
  source_field_id: string;
  duplicated_field_title?: string;
  duplicated_field_id?: string;
  error?: string;
  options?: unknown;
}

export interface TableDuplicatePayload {
  source_table_title: string;
  source_table_id: string;
  duplicated_table_title?: string;
  duplicated_table_id?: string;
  error?: string;
  options: unknown;
}

/* View */
export interface ViewCreatePayload {
  view_title: string;
  view_id: string;
  view_type: string;
  view_owner_id: string;
  view_owner_email: string;
}

export interface SharedViewCreatePayload {
  view_title: string;
  view_id: string;
  view_type: string;
}

export interface TableUpdatePayload extends UpdatePayload {
  table_title: string;
}

export interface ViewUpdatePayload extends UpdatePayload {
  view_title: string;
  view_id: string;
  view_type: string;
  view_owner_id: string;
  view_owner_email: string;
}

export interface SharedViewUpdatePayload extends UpdatePayload {
  view_title: string;
  view_id: string;
  view_type: string;
}

export interface ViewDeletePayload {
  view_title: string;
  view_id: string;
  view_type: string;
  view_owner_id: string;
  view_owner_email: string;
}

export interface SharedViewDeletePayload {
  view_title: string;
  view_id: string;
  view_type: string;
}

export interface ViewRenamePayload {
  new_view_title: string;
  old_view_title: string;
  view_id: string;
  view_type: string;
}

export interface ViewDuplicatePayload {
  duplicated_view_title: string;
  duplicated_view_id: string;
  source_view_title: string;
  source_view_id: string;
  view_type: string;
  error?: string;
}

export interface ModelRoleVisibilityPayload {
  view_title: string;
  view_id: string;
  role: string;
  disabled: boolean;
}

export interface SharedViewCreatePayload {
  view_title: string;
  view_id: string;
}

export interface SharedViewUpdatePayload extends UpdatePayload {
  view_title: string;
  view_id: string;
}

export interface SharedViewDeletePayload {
  view_title: string;
  view_id: string;
}

/* Hook */
export interface HookCreatePayload {
  hook_id: string;
  hook_title: string;
}

export interface HookUpdatePayload extends UpdatePayload {
  hook_id: string;
  hook_title: string;
}

export interface HookDeletePayload {
  hook_id: string;
  hook_title: string;
}

/* Filter */
export type FilterPayload =
  | {
      view_title: string;
      view_id: string;
      view_type: string;
    }
  | {
      hook_title: string;
      hook_id: string;
    }
  | {
      link_field_title: string;
      link_field_id: string;
    };

export type FilterCreatePayload = FilterPayload & {
  filter_id: string;
  filter_field_id?: string;
  filter_comparison_op?: string;
  filter_field_title?: string;
  is_group?: boolean;
  logical_operator?: string;
};

export type FilterUpdatePayload = UpdatePayload &
  FilterPayload & {
    filter_id: string;
    filter_field_id?: string;
    filter_comparison_op?: string;
    filter_field_title?: string;
    is_group?: boolean;
    logical_operator?: string;
  };

export type FilterDeletePayload = FilterPayload & {
  filter_id: string;
  filter_field_id: string;
  filter_field_title: string;
};

/* Bulk All operations */
export interface DataBulkAllPayload {
  conditions: any[];
  column_meta?: Record<string, ColumnMeta>;
}

export interface DataBulkUpdateAllPayload extends DataBulkAllPayload {
  data: Record<string, unknown>;
  old_data: Record<string, unknown>;
  column_meta: Record<string, ColumnMeta>;
}

export interface DataBulkDeleteAllPayload extends DataBulkAllPayload {}

/* Sort */
export interface SortCreatePayload {
  sort_field_id: string;
  sort_field_title: string;
  view_id: string;
  view_title: string;
  sort_id: string;
}

export interface SortUpdatePayload extends UpdatePayload {
  sort_field_id: string;
  sort_field_title: string;
  view_id: string;
  view_title: string;
  sort_id: string;
}

export interface SortDeletePayload {
  sort_id: string;
  sort_field_id: string;
  sort_field_title: string;
  view_id: string;
  view_title: string;
}

export interface FieldCreatePayload {
  field_title: string;
  op: string;
  filter_id: string;
}

export interface FieldUpdatePayload {
  field_title: string;
  updated_properties: any;
  filter_id: string;
}

export interface FieldDeletePayload {
  field_title: string;
}

export interface APITokenCreatePayload {
  token_id: string;
  token_title: string;
}

export interface APITokenDeletePayload {
  token_id: string;
  token_title: string;
}

export interface SharedBasePayload {
  base_title: string;
  uuid: string;

  custom_url_id?: string;
  custom_url?: string;
}

export interface SharedBasePayloadType {
  base_title: string;
}

/* Source */
export interface SourceCreatePayload {
  source_title: string;
  source_id: string;
  source_integration_id: string;
  source_integration_title: string;
  is_data_readonly: boolean;
  is_schema_readonly: boolean;
}

export interface SourceUpdatePayload extends UpdatePayload {
  source_title: string;
  source_id: string;
  source_integration_id: string;
  source_integration_title: string;
  is_data_readonly: boolean;
  is_schema_readonly: boolean;
}

export interface SourceDeletePayload {
  source_title: string;
  source_id: string;
  source_integration_id: string;
  source_integration_title: string;
  is_data_readonly: boolean;
  is_schema_readonly: boolean;
}

export interface AirtableImportPayload {
  airtable_sync_id: string;
}

export interface AirtableImportFailPayload {
  airtable_sync_id: string;
  error: string;
}

// Integration
export interface IntegrationCreatePayload {
  integration_id: string;
  integration_title: string;
  integration_type: string;
}

export interface IntegrationUpdatePayload extends UpdatePayload {
  integration_id: string;
  integration_title: string;
  integration_type: string;
}

export interface IntegrationDeletePayload {
  integration_id: string;
  integration_title: string;
  integration_type: string;
}

export interface SnapshotPayload {
  snapshot_title: string;
  snapshot_id: string;
  base_title: string;
  snapshot_base_id: string;
}
export interface SnapshotRestorePayload {
  snapshot_title: string;
  snapshot_id: string;
  base_title: string;
  target_base_id: string;
  target_base_title: string;
  snapshot_base_id: string;
}

export interface DataExportPayload {
  view_id: string;
  view_title: string;
  table_id: string;
  table_title: string;
  export_type: 'excel' | 'csv';
}

export interface DataImportPayload {
  view_id: string;
  view_title: string;
  table_id: string;
  table_title: string;
  import_type: 'excel' | 'csv';
}

export interface AuditV1<T = any> {
  // auto generated
  id?: string;
  created_at?: string;
  updated_at?: string;
  // required
  user: string;
  ip: string;
  fk_user_id: string;
  user_agent: string;
  fk_workspace_id: string | null;
  base_id: string | null;
  source_id: string | null;
  fk_model_id: string | null;
  row_id: string | null;
  op_type: AuditV1OperationTypes;
  details: T;
  version: 1;
  fk_parent_id?: string;
}

const descriptionTemplates = {
  [AuditV1OperationTypes.USER_SIGNUP]: (audit: AuditV1<UserSignupPayload>) =>
    `User '${audit.user}' signed up`,
  [AuditV1OperationTypes.USER_SIGNIN]: (audit: AuditV1<UserSigninPayload>) =>
    `User '${audit.user}' signed in`,
  [AuditV1OperationTypes.USER_INVITE]: (audit: AuditV1<UserInvitePayload>) =>
    `User '${audit.user}' invited '${audit.details.user_email}'`,
  [AuditV1OperationTypes.USER_PASSWORD_CHANGE]: (
    audit: AuditV1<UserPasswordChangePayload>
  ) => `User '${audit.user}' changed password`,
  [AuditV1OperationTypes.USER_PASSWORD_RESET]: (
    audit: AuditV1<UserPasswordResetPayload>
  ) => `User '${audit.user}' reset password`,
  [AuditV1OperationTypes.USER_PASSWORD_FORGOT]: (
    audit: AuditV1<UserPasswordForgotPayload>
  ) => `User '${audit.user}' forgot password`,
  [AuditV1OperationTypes.USER_EMAIL_VERIFY]: (
    audit: AuditV1<UserEmailVerifyPayload>
  ) => `User '${audit.user}' verified email`,
  [AuditV1OperationTypes.BASE_USER_INVITE]: (
    audit: AuditV1<BaseUserInvitePayload>
  ) => `User '${audit.user}' invited '${audit.details.user_email}' to base`,
  [AuditV1OperationTypes.BASE_USER_INVITE_RESEND]: (
    audit: AuditV1<BaseUserInviteResendPayload>
  ) => `User '${audit.user}' resent invite to '${audit.details.user_email}'`,
  [AuditV1OperationTypes.BASE_USER_UPDATE]: (
    audit: AuditV1<BaseUserRoleUpdatePayload>
  ) => `User '${audit.user}' updated role of '${audit.details.user_email}'`,
  [AuditV1OperationTypes.TABLE_CREATE]: (audit: AuditV1<TableCreatePayload>) =>
    `User '${audit.user}' created table '${audit.details.table_title}'`,
  [AuditV1OperationTypes.TABLE_DELETE]: (audit: AuditV1<TableDeletePayload>) =>
    `User '${audit.user}' deleted table '${audit.details.table_title}'`,
  [AuditV1OperationTypes.ORG_USER_INVITE]: (
    audit: AuditV1<OrgUserInvitePayload>
  ) => `User '${audit.user}' invited '${audit.details.email}' to organization`,
  [AuditV1OperationTypes.ORG_USER_INVITE_RESEND]: (
    audit: AuditV1<OrgUserInviteResendPayload>
  ) => `User '${audit.user}' resent invite to '${audit.details.email}'`,
  [AuditV1OperationTypes.DATA_INSERT]: (audit: AuditV1<DataInsertPayload>) =>
    `Record with ID [${audit.row_id}] has been inserted`,
  [AuditV1OperationTypes.DATA_UPDATE]: (audit: AuditV1<DataUpdatePayload>) =>
    `Record with ID [${audit.row_id}] has been updated`,
  [AuditV1OperationTypes.DATA_DELETE]: (audit: AuditV1<DataDeletePayload>) =>
    `Record with ID [${audit.row_id}] has been deleted`,

  /*  [AuditV1OperationTypes.DATA_BULK_INSERT]: (
    audit: AuditV1<DataBulkInsertPayload>
  ) =>
    `${audit.details.data.length} ${
      audit.details.data.length > 1 ? 'records have been' : 'record has been'
    } inserted`,
  [AuditV1OperationTypes.DATA_BULK_UPDATE]: (
    audit: AuditV1<DataBulkUpdatePayload>
  ) =>
    `${audit.details.data.length} ${
      audit.details.data.length > 1 ? 'records have been' : 'record has been'
    } updated`,
  [AuditV1OperationTypes.DATA_BULK_DELETE]: (
    audit: AuditV1<DataBulkDeletePayload>
  ) =>
    `${audit.details.data.length} ${
      audit.details.data.length > 1 ? 'records have been' : 'record has been'
    } deleted`,*/

  [AuditV1OperationTypes.DATA_LINK]: (audit: AuditV1<DataLinkPayload>) =>
    `Record [id:${audit.details.ref_row_id}] has been linked with record [id:${audit.details.row_id}] in ${audit.details.table_title}`,
  [AuditV1OperationTypes.DATA_UNLINK]: (audit: AuditV1<DataUnlinkPayload>) =>
    `Record [id:${audit.details.ref_row_id}] has been unlinked from record [id:${audit.details.row_id}] in ${audit.details.table_title}`,
  [AuditV1OperationTypes.WORKSPACE_CREATE]: (
    audit: AuditV1<WorkspaceCreatePayload>
  ) => `Workspace '${audit.details.workspace_title}' has been created`,
  [AuditV1OperationTypes.WORKSPACE_UPDATE]: (
    audit: AuditV1<WorkspaceUpdatePayload>
  ) => `Workspace '${audit.details.workspace_title}' has been updated`,
  [AuditV1OperationTypes.WORKSPACE_DELETE]: (
    audit: AuditV1<WorkspaceDeletePayload>
  ) => `Workspace '${audit.details.workspace_title}' has been deleted`,
  [AuditV1OperationTypes.WORKSPACE_RENAME]: (
    audit: AuditV1<WorkspaceRenamePayload>
  ) =>
    `Workspace '${audit.details.old_workspace_title}' has been renamed to '${audit.details.new_workspace_title}'`,
  [AuditV1OperationTypes.BASE_CREATE]: (audit: AuditV1<BaseCreatePayload>) =>
    `Base '${audit.details.base_title}' has been created`,
  [AuditV1OperationTypes.BASE_UPDATE]: (audit: AuditV1<BaseUpdatePayload>) =>
    `Base '${audit.details.base_title}' has been updated`,
  [AuditV1OperationTypes.BASE_DELETE]: (audit: AuditV1<BaseDeletePayload>) =>
    `Base '${audit.details.base_title}' has been deleted`,
  [AuditV1OperationTypes.BASE_RENAME]: (audit: AuditV1<BaseRenamePayload>) =>
    `Base '${audit.details.old_base_title}' has been renamed to '${audit.details.new_base_title}'`,
  [AuditV1OperationTypes.BASE_DUPLICATE]: (
    audit: AuditV1<BaseDuplicatePayload>
  ) => `Base '${audit.details.source_base_title}' has been duplicated`,
  [AuditV1OperationTypes.VIEW_CREATE]: (audit: AuditV1<ViewCreatePayload>) =>
    `${audit.details.view_type.replace(/^\w/, (m) => m.toUpperCase())} '${
      audit.details.view_title
    }' has been created`,
  [AuditV1OperationTypes.VIEW_UPDATE]: (audit: AuditV1<ViewUpdatePayload>) =>
    `${audit.details.view_type.replace(/^\w/, (m) => m.toUpperCase())} '${
      audit.details.view_title
    }' has been updated`,
  [AuditV1OperationTypes.VIEW_DELETE]: (audit: AuditV1<ViewDeletePayload>) =>
    `${audit.details.view_type.replace(/^\w/, (m) => m.toUpperCase())} '${
      audit.details.view_title
    }' has been deleted`,
  [AuditV1OperationTypes.VIEW_RENAME]: (audit: AuditV1<ViewRenamePayload>) =>
    `${audit.details.view_type.replace(/^\w/, (m) => m.toUpperCase())} '${
      audit.details.old_view_title
    }' has been renamed to '${audit.details.new_view_title}'`,
  [AuditV1OperationTypes.VIEW_DUPLICATE]: (m: AuditV1<ViewDuplicatePayload>) =>
    `${m.details.view_type.replace(/^\w/, (m) => m.toUpperCase())} '${
      m.details.source_view_title
    }' has been duplicated`,
  [AuditV1OperationTypes.COLUMN_CREATE]: (audit: AuditV1<ViewCreatePayload>) =>
    `Field '${audit.details.view_title}' has been created`,
  [AuditV1OperationTypes.COLUMN_UPDATE]: (audit: AuditV1<ViewUpdatePayload>) =>
    `Field '${audit.details.view_title}' has been updated`,
  [AuditV1OperationTypes.COLUMN_DELETE]: (audit: AuditV1<ViewDeletePayload>) =>
    `Field '${audit.details.view_title}' has been deleted`,
  [AuditV1OperationTypes.COLUMN_RENAME]: (audit: AuditV1<ViewRenamePayload>) =>
    `Field '${audit.details.old_view_title}' has been renamed to '${audit.details.new_view_title}'`,
  [AuditV1OperationTypes.COLUMN_DUPLICATE]: (
    audit: AuditV1<ColumnDuplicatePayload>
  ) => `Field '${audit.details.source_field_title}' has been duplicated`,
  [AuditV1OperationTypes.HOOK_CREATE]: (audit: AuditV1<HookCreatePayload>) =>
    `Hook '${audit.details.hook_title}' has been created`,
  [AuditV1OperationTypes.HOOK_UPDATE]: (audit: AuditV1<HookUpdatePayload>) =>
    `Hook '${audit.details.hook_title}' has been updated`,
  [AuditV1OperationTypes.HOOK_DELETE]: (audit: AuditV1<HookDeletePayload>) =>
    `Hook '${audit.details.hook_title}' has been deleted`,
  [AuditV1OperationTypes.HOOK_FILTER_CREATE]: (
    audit: AuditV1<FilterCreatePayload>
  ) =>
    `Filter with column '${audit.details.filter_field_id}' and operation '${audit.details.filter_comparison_op}' has been created`,
};

function auditDescription(audit: AuditV1) {
  return descriptionTemplates[audit.op_type](audit);
}

export { AuditV1OperationTypes, auditDescription };
