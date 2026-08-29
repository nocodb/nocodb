import { RelationTypes } from '~/lib/globals';
import UITypes from '~/lib/UITypes';

enum AuditV1OperationTypes {
  USER_SIGNUP = 'USER_SIGNUP',
  USER_SIGNIN = 'USER_SIGNIN',
  USER_SIGNIN_FAILED = 'USER_SIGNIN_FAILED',
  USER_INVITE = 'USER_INVITE',

  WORKSPACE_USER_INVITE = 'WORKSPACE_USER_INVITE',
  WORKSPACE_USER_UPDATE = 'WORKSPACE_USER_UPDATE',
  WORKSPACE_USER_DELETE = 'WORKSPACE_USER_DELETE',
  WORKSPACE_TEAM_INVITE = 'WORKSPACE_TEAM_INVITE',
  WORKSPACE_TEAM_UPDATE = 'WORKSPACE_TEAM_UPDATE',
  WORKSPACE_TEAM_DELETE = 'WORKSPACE_TEAM_DELETE',

  SCIM_USER_PROVISION = 'SCIM_USER_PROVISION',
  SCIM_USER_UPDATE = 'SCIM_USER_UPDATE',
  SCIM_USER_DEACTIVATE = 'SCIM_USER_DEACTIVATE',
  SCIM_USER_REACTIVATE = 'SCIM_USER_REACTIVATE',
  SCIM_USER_DELETE = 'SCIM_USER_DELETE',
  SCIM_GROUP_PROVISION = 'SCIM_GROUP_PROVISION',
  SCIM_GROUP_UPDATE = 'SCIM_GROUP_UPDATE',
  SCIM_GROUP_REPLACE = 'SCIM_GROUP_REPLACE',
  SCIM_GROUP_DELETE = 'SCIM_GROUP_DELETE',
  SCIM_CONFIG_CREATE = 'SCIM_CONFIG_CREATE',
  SCIM_CONFIG_UPDATE = 'SCIM_CONFIG_UPDATE',
  SCIM_CONFIG_DISABLE = 'SCIM_CONFIG_DISABLE',
  SCIM_CONFIG_DELETE = 'SCIM_CONFIG_DELETE',
  SCIM_CONFIG_TOKEN_REGENERATE = 'SCIM_CONFIG_TOKEN_REGENERATE',
  SSO_CLIENT_CREATE = 'SSO_CLIENT_CREATE',
  SSO_CLIENT_UPDATE = 'SSO_CLIENT_UPDATE',
  SSO_CLIENT_DELETE = 'SSO_CLIENT_DELETE',
  ORG_DOMAIN_ADD = 'ORG_DOMAIN_ADD',
  ORG_DOMAIN_UPDATE = 'ORG_DOMAIN_UPDATE',
  ORG_DOMAIN_DELETE = 'ORG_DOMAIN_DELETE',
  ORG_DOMAIN_VERIFY = 'ORG_DOMAIN_VERIFY',

  WHITE_LABEL_UPDATE = 'WHITE_LABEL_UPDATE',

  USER_PASSWORD_CHANGE = 'USER_PASSWORD_CHANGE',
  USER_PASSWORD_RESET = 'USER_PASSWORD_RESET',
  USER_PASSWORD_FORGOT = 'USER_PASSWORD_FORGOT',
  USER_EMAIL_VERIFY = 'USER_EMAIL_VERIFY',

  USER_MFA_SETUP = 'USER_MFA_SETUP',
  USER_MFA_ENABLED = 'USER_MFA_ENABLED',
  USER_MFA_DISABLED = 'USER_MFA_DISABLED',
  USER_MFA_VERIFY = 'USER_MFA_VERIFY',
  USER_MFA_BACKUP_CODE_USED = 'USER_MFA_BACKUP_CODE_USED',

  BASE_USER_INVITE = 'BASE_USER_INVITE',
  BASE_USER_UPDATE = 'BASE_USER_UPDATE',
  BASE_USER_INVITE_RESEND = 'BASE_USER_INVITE_RESEND',
  BASE_TEAM_INVITE = 'BASE_TEAM_INVITE',
  BASE_TEAM_UPDATE = 'BASE_TEAM_UPDATE',
  BASE_TEAM_DELETE = 'BASE_TEAM_DELETE',

  TABLE_CREATE = 'TABLE_CREATE',
  TABLE_DELETE = 'TABLE_DELETE',

  COLUMN_CREATE = 'FIELD_CREATE',
  COLUMN_UPDATE = 'FIELD_UPDATE',
  COLUMN_DELETE = 'FIELD_DELETE',
  COLUMN_RENAME = 'FIELD_RENAME',

  ORG_USER_INVITE = 'ORG_USER_INVITE',
  ORG_USER_INVITE_RESEND = 'ORG_USER_INVITE_RESEND',
  ORG_USER_ADD = 'ORG_USER_ADD',
  ORG_USER_REMOVE = 'ORG_USER_REMOVE',
  ORG_USER_ROLE_UPDATE = 'ORG_USER_ROLE_UPDATE',
  ORG_WORKSPACE_ADD = 'ORG_WORKSPACE_ADD',
  ORG_WORKSPACE_REMOVE = 'ORG_WORKSPACE_REMOVE',

  DATA_INSERT = 'DATA_INSERT',
  DATA_UPDATE = 'DATA_UPDATE',
  DATA_DELETE = 'DATA_DELETE',

  DATA_BULK_INSERT = 'DATA_BULK_INSERT',
  DATA_BULK_UPDATE = 'DATA_BULK_UPDATE',
  DATA_BULK_DELETE = 'DATA_BULK_DELETE',
  DATA_BULK_ALL_DELETE = 'DATA_BULK_ALL_DELETE',
  DATA_BULK_ALL_UPDATE = 'DATA_BULK_ALL_UPDATE',

  DATA_CASCADE_UPDATE = 'DATA_CASCADE_UPDATE',

  // Trash / soft-delete operations
  DATA_SOFT_DELETE = 'DATA_SOFT_DELETE',
  DATA_BULK_SOFT_DELETE = 'DATA_BULK_SOFT_DELETE',
  DATA_RESTORE = 'DATA_RESTORE',
  DATA_BULK_RESTORE = 'DATA_BULK_RESTORE',
  DATA_PERMANENT_DELETE = 'DATA_PERMANENT_DELETE',
  DATA_BULK_PERMANENT_DELETE = 'DATA_BULK_PERMANENT_DELETE',

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

  WIDGET_FILTER_CREATE = 'WIDGET_FILTER_CREATE',
  WIDGET_FILTER_UPDATE = 'WIDGET_FILTER_UPDATE',
  WIDGET_FILTER_DELETE = 'WIDGET_FILTER_DELETE',

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
  API_TOKEN_UPDATE = 'API_TOKEN_UPDATE',

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
  VIEW_COLUMN_CREATE = 'VIEW_FIELD_CREATE',
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
  SNAPSHOT_SCHEDULE_UPDATE = 'SNAPSHOT_SCHEDULE_UPDATE',

  DATA_IMPORT = 'DATA_IMPORT',
  DATA_EXPORT = 'DATA_EXPORT',
  USER_PROFILE_UPDATE = 'USER_PROFILE_UPDATE',

  SCRIPT_CREATE = 'SCRIPT_CREATE',
  SCRIPT_UPDATE = 'SCRIPT_UPDATE',
  SCRIPT_DELETE = 'SCRIPT_DELETE',

  SCRIPT_DUPLICATE = 'SCRIPT_DUPLICATE',

  DASHBOARD_CREATE = 'DASHBOARD_CREATE',
  DASHBOARD_UPDATE = 'DASHBOARD_UPDATE',
  DASHBOARD_DELETE = 'DASHBOARD_DELETE',

  DASHBOARD_DUPLICATE = 'DASHBOARD_DUPLICATE',
  DASHBOARD_DUPLICATE_ERROR = 'DASHBOARD_DUPLICATE_ERROR',

  SHARED_DASHBOARD_CREATE = 'SHARED_DASHBOARD_CREATE',
  SHARED_DASHBOARD_DELETE = 'SHARED_DASHBOARD_DELETE',
  SHARED_DASHBOARD_UPDATE = 'SHARED_DASHBOARD_UPDATE',

  WIDGET_CREATE = 'WIDGET_CREATE',
  WIDGET_UPDATE = 'WIDGET_UPDATE',
  WIDGET_DELETE = 'WIDGET_DELETE',
  WIDGET_DUPLICATE = 'WIDGET_DUPLICATE',

  INTERFACE_CREATE = 'INTERFACE_CREATE',
  INTERFACE_UPDATE = 'INTERFACE_UPDATE',
  INTERFACE_DELETE = 'INTERFACE_DELETE',
  INTERFACE_DUPLICATE = 'INTERFACE_DUPLICATE',
  INTERFACE_PUBLISH = 'INTERFACE_PUBLISH',

  INTERFACE_PAGE_CREATE = 'INTERFACE_PAGE_CREATE',
  INTERFACE_PAGE_UPDATE = 'INTERFACE_PAGE_UPDATE',
  INTERFACE_PAGE_DELETE = 'INTERFACE_PAGE_DELETE',
  INTERFACE_PAGE_DUPLICATE = 'INTERFACE_PAGE_DUPLICATE',

  SHARED_INTERFACE_PAGE_CREATE = 'SHARED_INTERFACE_PAGE_CREATE',
  SHARED_INTERFACE_PAGE_UPDATE = 'SHARED_INTERFACE_PAGE_UPDATE',
  SHARED_INTERFACE_PAGE_DELETE = 'SHARED_INTERFACE_PAGE_DELETE',

  INTERFACE_DATA_EXPORT = 'INTERFACE_DATA_EXPORT',

  INTERFACE_USER_INVITE = 'INTERFACE_USER_INVITE',
  INTERFACE_USER_UPDATE = 'INTERFACE_USER_UPDATE',
  INTERFACE_USER_DELETE = 'INTERFACE_USER_DELETE',

  PERMISSION_CREATE = 'PERMISSION_CREATE',
  PERMISSION_UPDATE = 'PERMISSION_UPDATE',
  PERMISSION_DELETE = 'PERMISSION_DELETE',

  TEAM_CREATE = 'TEAM_CREATE',
  TEAM_UPDATE = 'TEAM_UPDATE',
  TEAM_DELETE = 'TEAM_DELETE',
  TEAM_MOVE = 'TEAM_MOVE',
  TEAM_MEMBER_ADD = 'TEAM_MEMBER_ADD',
  TEAM_MEMBER_UPDATE = 'TEAM_MEMBER_UPDATE',
  TEAM_MEMBER_DELETE = 'TEAM_MEMBER_DELETE',

  WORKFLOW_CREATE = 'WORKFLOW_CREATE',
  WORKFLOW_UPDATE = 'WORKFLOW_UPDATE',
  WORKFLOW_DELETE = 'WORKFLOW_DELETE',

  WORKFLOW_DUPLICATE = 'WORKFLOW_DUPLICATE',

  RECORD_TEMPLATE_CREATE = 'RECORD_TEMPLATE_CREATE',
  RECORD_TEMPLATE_UPDATE = 'RECORD_TEMPLATE_UPDATE',
  RECORD_TEMPLATE_DELETE = 'RECORD_TEMPLATE_DELETE',
  RECORD_TEMPLATE_USE = 'RECORD_TEMPLATE_USE',

  RLS_POLICY_CREATE = 'RLS_POLICY_CREATE',
  RLS_POLICY_UPDATE = 'RLS_POLICY_UPDATE',
  RLS_POLICY_DELETE = 'RLS_POLICY_DELETE',

  DOC_AI_COMPLETION = 'DOC_AI_COMPLETION',

  DOCUMENT_CREATE = 'DOCUMENT_CREATE',
  DOCUMENT_UPDATE = 'DOCUMENT_UPDATE',
  DOCUMENT_DELETE = 'DOCUMENT_DELETE',

  DOCUMENT_REVISION_RESTORE = 'DOCUMENT_REVISION_RESTORE',

  DOCUMENT_PUBLIC_SHARE_CREATE = 'DOCUMENT_PUBLIC_SHARE_CREATE',
  DOCUMENT_PUBLIC_SHARE_UPDATE = 'DOCUMENT_PUBLIC_SHARE_UPDATE',
  DOCUMENT_PUBLIC_SHARE_DELETE = 'DOCUMENT_PUBLIC_SHARE_DELETE',

  DOCUMENT_COMMENT_CREATE = 'DOCUMENT_COMMENT_CREATE',
  DOCUMENT_COMMENT_UPDATE = 'DOCUMENT_COMMENT_UPDATE',
  DOCUMENT_COMMENT_DELETE = 'DOCUMENT_COMMENT_DELETE',

  DATE_DEPENDENCY_UPDATE = 'DATE_DEPENDENCY_UPDATE',
  DATE_DEPENDENCY_DELETE = 'DATE_DEPENDENCY_DELETE',
}

export const auditV1OperationTypesAlias = Object.values(
  AuditV1OperationTypes
).reduce((acc, key) => {
  // Convert snake_case or UPPER_SNAKE_CASE to readable format
  // Capitalize each word
  acc[key] = key
    .replace(/_/g, ' ') // Replace underscores with spaces
    .toLowerCase() // Convert to lowercase
    .replace(/\b[a-z]/g, (char) => char.toUpperCase());
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
  TEAM: {
    label: 'objects.team',
    value: 'TEAM',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('TEAM_')
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
  SCIM: {
    label: 'general.scim',
    value: 'SCIM',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('SCIM_')
    ),
  },
  SSO: {
    label: 'title.sso',
    value: 'SSO',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('SSO_')
    ),
  },
  SCRIPT: {
    label: 'general.script',
    value: 'SCRIPT',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('SCRIPT_')
    ),
  },
  DASHBOARD: {
    label: 'objects.dashboard',
    value: 'DASHBOARD',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) => key.startsWith('DASHBOARD_') || key.startsWith('WIDGET_')
    ),
  },
  INTERFACE: {
    label: 'general.interface',
    value: 'INTERFACE',
    types: Object.values(AuditV1OperationTypes).filter(
      (key) =>
        key.startsWith('INTERFACE_') || key.startsWith('SHARED_INTERFACE_')
    ),
  },
  WORKFLOW: {
    label: 'objects.workflow',
    value: 'WORKFLOW',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('WORKFLOW_')
    ),
  },
  DOCUMENT: {
    label: 'objects.document',
    value: 'DOCUMENT',
    types: Object.values(AuditV1OperationTypes).filter((key) =>
      key.startsWith('DOCUMENT_')
    ),
  },
};

export type BulkAuditV1OperationTypes =
  | AuditV1OperationTypes.DATA_BULK_INSERT
  | AuditV1OperationTypes.DATA_BULK_UPDATE
  | AuditV1OperationTypes.DATA_BULK_DELETE
  | AuditV1OperationTypes.DATA_BULK_SOFT_DELETE
  | AuditV1OperationTypes.DATA_BULK_RESTORE
  | AuditV1OperationTypes.DATA_BULK_PERMANENT_DELETE;

export interface UserSigninPayload {
  provider?: string;
  sso_client_type?: string;
}

export interface UserSigninFailedPayload {
  email?: string;
  provider?: string;
  reason?: string;
}

export interface UserSignupPayload {}

export interface UserInvitePayload {
  user_id: string;
  user_email: string;
  user_name?: string;
}

export interface UserPasswordChangePayload {}

export interface UserPasswordResetPayload {}

export interface UserMfaSetupPayload {}

export interface UserMfaEnabledPayload {}

export interface UserMfaDisabledPayload {}

export interface UserMfaVerifyPayload {
  method?: 'totp' | 'backup_code';
}

export interface UserMfaBackupCodeUsedPayload {}

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

export interface BaseTeamInvitePayload {
  base_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
}

export interface BaseTeamUpdatePayload extends UpdatePayload {
  base_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
}

export interface BaseTeamDeletePayload {
  base_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
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

export interface ViewColumnCreatePayload {
  view_type: string;
  field_id: string;
  view_id: string;
  view_title: string;
  field_title: string;
  show: boolean;
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

export interface DataCascadeUpdatePayload {
  source?: 'date_dependency';
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

export interface ScimUserProvisionPayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  scim_id: string;
}

export interface ScimUserUpdatePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  scim_id: string;
}

export interface ScimUserDeactivatePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  scim_id: string;
}

export interface ScimUserReactivatePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  scim_id: string;
}

export interface ScimUserDeletePayload {
  workspace_title: string;
  user_email: string;
  user_name?: string;
  user_id: string;
  scim_id: string;
}

export interface WorkspaceTeamInvitePayload {
  workspace_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
}

export interface WorkspaceTeamUpdatePayload extends UpdatePayload {
  workspace_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
}

export interface WorkspaceTeamDeletePayload {
  workspace_title: string;
  team_id: string;
  team_title: string;
  team_role: string;
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
    }
  | {
      widget_title: string;
      widget_id: string;
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

export interface APITokenUpdatePayload {
  token_id: string;
  token_title: string;
  scope_count?: number;
  permission_categories?: string[];
  has_expiry?: boolean;
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
export interface SnapshotSchedulePayload {
  base_title: string;
  enabled: boolean;
  frequency: string;
  cron_expression: string;
  timezone: string;
  keep_last: number;
  delete_after_days: number;
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
  export_type: 'excel' | 'csv' | 'json' | 'ics';
}

export interface DataImportPayload {
  view_id: string;
  view_title: string;
  table_id: string;
  table_title: string;
  import_type: 'excel' | 'csv';
}

export interface ScriptCreatePayload {
  script_title: string;
  script_id: string;
  script_content: string;
  script_description: string;
  script_config: string;
}

export interface ScriptUpdatePayload extends UpdatePayload {
  script_title: string;
  script_id: string;
}

export interface ScriptDeletePayload {
  script_title: string;
  script_id: string;
}

export interface ScriptDuplicatePayload {
  duplicated_script_title: string;
  duplicated_script_id: string;
  source_script_title: string;
  source_script_id: string;
  error?: string;
}

export interface DashboardCreatePayload {
  dashboard_title: string;
  dashboard_id: string;
  dashboard_description: string;
}

export interface DashboardUpdatePayload extends UpdatePayload {
  dashboard_title: string;
  dashboard_id: string;
  dashboard_description: string;
}

export interface DashboardDeletePayload {
  dashboard_title: string;
  dashboard_id: string;
}

export interface DashboardDuplicatePayload {
  duplicated_dashboard_title: string;
  duplicated_dashboard_id: string;
  source_dashboard_title: string;
  source_dashboard_id: string;
  error?: string;
}

export interface SharedDashboardCreatePayload {
  dashboard_title: string;
  dashboard_id: string;
}

export interface SharedDashboardUpdatePayload extends UpdatePayload {
  dashboard_title: string;
  dashboard_id: string;
}

export interface SharedDashboardDeletePayload {
  dashboard_title: string;
  dashboard_id: string;
}

export interface WidgetCreatePayload {
  widget_title: string;
  widget_id: string;
  widget_type: string;
  widget_description: string;
  widget_config: Record<string, any>;
}

export interface WidgetUpdatePayload extends UpdatePayload {
  widget_title: string;
  widget_id: string;
  widget_type: string;
}

export interface WidgetDeletePayload {
  widget_title: string;
  widget_id: string;
  widget_type: string;
}

export interface WidgetDuplicatePayload {
  duplicated_widget_title: string;
  duplicated_widget_id: string;
  source_widget_title: string;
  source_widget_id: string;
  error?: string;
}

export interface InterfaceCreatePayload {
  interface_title: string;
  interface_id: string;
}

export interface InterfaceUpdatePayload extends UpdatePayload {
  interface_title: string;
  interface_id: string;
}

export interface InterfaceDeletePayload {
  interface_title: string;
  interface_id: string;
}

export interface InterfaceDuplicatePayload {
  duplicated_interface_title: string;
  duplicated_interface_id: string;
  source_interface_title: string;
  source_interface_id: string;
}

export interface InterfacePublishPayload {
  interface_title: string;
  interface_id: string;
  /** Pages carried into the published snapshot by this publish. */
  published_page_count: number;
}

export interface InterfaceAuditTableRef {
  id: string;
  title: string;
}

/**
 * Identity carried by every page-scoped interface audit. An id alone is dead
 * weight in a log — the reader needs to know WHICH interface the page belongs
 * to and WHICH tables it reads, without resolving those entities by hand (some
 * of which may already be deleted by the time the log is read).
 */
export interface InterfacePageContext {
  page_title: string;
  page_id: string;
  page_layout: string;
  interface_id: string;
  interface_title: string;
  /**
   * EVERY table the page reads, not just its primary binding. A table or
   * record-review page binds one; a DASHBOARD binds one per widget and a LIST
   * visualization one per level — so this is a list. Absent for layouts that
   * read no table at all (overview).
   *
   * Capped at {@link INTERFACE_AUDIT_TABLE_LIMIT}; `table_count` is not.
   */
  tables?: InterfaceAuditTableRef[];
  /** Distinct tables the page reads — accurate even when `tables` is capped. */
  table_count?: number;
}

/** Keeps a wide dashboard from writing an unbounded list into every audit row. */
export const INTERFACE_AUDIT_TABLE_LIMIT = 20;

export type InterfacePageCreatePayload = InterfacePageContext;

/** One entry of {@link InterfacePageConfigDiff}. */
export interface InterfacePageConfigChange {
  op: 'added' | 'removed' | 'changed' | 'reordered';
  /** Id-keyed path, e.g. `visualizations[viz1].sorts[0].direction`. */
  path: string;
  from?: unknown;
  to?: unknown;
  /** Id space of this leaf, when the page schema declares one. */
  ref?: 'column' | 'model' | 'page';
  /** Resolved names for `from`/`to` when they hold ids. */
  from_title?: string;
  to_title?: string;
  /** Identity of an entity added or removed wholesale. */
  entity?: { id?: string; type?: string; title?: string };
  /** Stands in for `from`/`to` when the value was too large to embed. */
  summary?: string;
}

/**
 * The DELTA of a page's builder config — never the config itself, which is
 * the whole page and would be rewritten into `nc_audit` on every save.
 *
 * Computed against the layout's zod schema, so entity arrays match by id
 * (reordering a visualization doesn't rewrite every index) and id-valued
 * leaves are resolved to names.
 */
export interface InterfacePageConfigDiff {
  changes: InterfacePageConfigChange[];
  /** True total — `changes` is capped. */
  change_count: number;
  truncated: boolean;
}

export interface InterfacePageUpdatePayload
  extends InterfacePageContext,
    Partial<UpdatePayload> {
  config_changed: boolean;
  /**
   * Absent when the config didn't change, or when it was unreadable — in the
   * latter case `config_changed` still records that it did.
   */
  config_diff?: InterfacePageConfigDiff;
}

export type InterfacePageDeletePayload = InterfacePageContext;

/** Page context here describes the DUPLICATE; the source is named alongside. */
export interface InterfacePageDuplicatePayload extends InterfacePageContext {
  source_page_title: string;
  source_page_id: string;
}

export interface SharedInterfacePageCreatePayload
  extends InterfacePageContext {
  uuid: string;
  password_protected: boolean;
}

export interface SharedInterfacePageUpdatePayload
  extends InterfacePageContext {
  uuid: string;
  password_protected: boolean;
  /** The hash itself is never recorded — only that it was rotated/cleared. */
  password_changed: boolean;
}

export interface SharedInterfacePageDeletePayload
  extends InterfacePageContext {
  uuid: string;
}

export interface InterfaceDataExportPayload extends InterfacePageContext {
  table_id: string;
  table_title: string;
  export_type: 'csv';
  /** True when served through the public share-to-web link. */
  is_public_share: boolean;
}

/**
 * Interface access grants. The principal is either a user or a team, and the
 * grant targets either the whole interface (`page_id` absent) or a single page.
 */
export interface InterfaceGrantContext {
  interface_title: string;
  interface_id: string;
  principal_type: 'user' | 'team';
  principal_id: string;
  principal_title: string;
  /** Present only for page-level grants. */
  page_id?: string;
  page_title?: string;
}

export interface InterfaceUserInvitePayload extends InterfaceGrantContext {
  role: string;
}

export interface InterfaceUserUpdatePayload extends InterfaceGrantContext {
  role: string;
  old_role?: string | null;
}

export interface InterfaceUserDeletePayload extends InterfaceGrantContext {
  role?: string | null;
}

export interface PermissionCreatePayload {
  permission_id: string;
  permission: string;
  entity: string;
  entity_id: string;
  granted_type?: string;
  granted_role?: string;
  enforce_for_form?: boolean;
  enforce_for_automation?: boolean;
  subjects?: Array<{ type: 'user' | 'team'; id: string }>;
}

export interface PermissionUpdatePayload {
  permission_id: string;
  permission: string;
  entity: string;
  entity_id: string;
  granted_type?: string;
  granted_role?: string;
  enforce_for_form?: boolean;
  enforce_for_automation?: boolean;
  subjects?: Array<{ type: 'user' | 'team'; id: string }>;
}

export interface PermissionDeletePayload {
  permission_id: string;
  permission: string;
  entity: string;
  entity_id: string;
}

export interface RlsPolicyCreatePayload {
  policy_id: string;
  policy_title: string;
  table_id: string;
  access_level?: string;
}

export interface RlsPolicyUpdatePayload {
  policy_id: string;
  policy_title: string;
  access_level?: string;
}

export interface RlsPolicyDeletePayload {
  policy_id: string;
  table_id: string;
}

export interface DateDependencyUpdatePayload {
  table_id: string;
  table_title: string;
  /** Set when the rule is scoped to a single Gantt view rather than the
   * table-level default. A table can have one default rule + multiple
   * per-view overrides; surface the view identity so the audit log
   * disambiguates them. */
  gantt_view_id?: string;
  gantt_view_title?: string;
  date_dependency_id: string;
  is_new: boolean;
  start_date_field?: { id: string; title: string };
  end_date_field?: { id: string; title: string };
  duration_field?: { id: string; title: string };
  dependency_link_field?: { id: string; title: string };
  dependency_linkrow_role?: string;
  dependency_connection_type?: string;
  dependency_buffer_type?: string;
  dependency_buffer_days?: number;
  include_weekends?: boolean;
  is_active?: boolean;
}

export interface DateDependencyDeletePayload {
  table_id: string;
  table_title: string;
  /** Set when the deleted rule was scoped to a single Gantt view. */
  gantt_view_id?: string;
  gantt_view_title?: string;
}

export interface DocAiCompletionPayload {
  operation: 'write' | 'continue' | 'improve' | 'summarize' | 'translate';
}

export interface DocumentCreatePayload {
  document_title: string;
  document_id: string;
  parent_id?: string | null;
}

export interface DocumentUpdatePayload {
  document_title: string;
  document_id: string;
}

export interface DocumentDeletePayload {
  document_title: string;
  document_id: string;
}

export interface DocumentRevisionRestorePayload {
  document_title: string;
  document_id: string;
  revision_id: string;
  revision_created_at: string;
  revision_author?: string | null;
  revision_source: 'auto' | 'manual' | 'restore';
}

export interface DocumentPublicShareCreatePayload {
  document_title: string;
  document_id: string;
  uuid: string;
  include_subtree: boolean;
}

export interface DocumentPublicShareUpdatePayload {
  document_title: string;
  document_id: string;
  uuid: string;
  include_subtree: boolean;
}

export interface DocumentPublicShareDeletePayload {
  document_title: string;
  document_id: string;
  uuid: string;
}

export interface DocumentCommentCreatePayload {
  document_id: string;
  comment_id: string;
}

export interface DocumentCommentUpdatePayload {
  document_id: string;
  comment_id: string;
}

export interface DocumentCommentDeletePayload {
  document_id: string;
  comment_id: string;
}

export interface TeamCreatePayload {
  team_id: string;
  team_title: string;
  workspace_title?: string;
  base_title?: string;
  meta?: any;
}

export interface TeamUpdatePayload extends UpdatePayload {
  team_id: string;
  team_title: string;
  workspace_title?: string;
  base_title?: string;
  meta?: any;
}

export interface TeamDeletePayload {
  team_id: string;
  team_title: string;
  workspace_title?: string;
  base_title?: string;
  meta?: any;
}

export interface TeamMovePayload {
  team_id: string;
  team_title: string;
  old_parent_team_id?: string | null;
  old_parent_team_title?: string | null;
  new_parent_team_id?: string | null;
  new_parent_team_title?: string | null;
  workspace_title?: string;
}

export interface TeamMemberAddPayload {
  team_id: string;
  team_title: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  team_role: string;
  workspace_title?: string;
  base_title?: string;
}

export interface TeamMemberUpdatePayload extends UpdatePayload {
  team_id: string;
  team_title: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  team_role: string;
  workspace_title?: string;
  base_title?: string;
}

export interface TeamMemberDeletePayload {
  team_id: string;
  team_title: string;
  user_id: string;
  user_email: string;
  user_name?: string;
  team_role: string;
  workspace_title?: string;
  base_title?: string;
}

export interface WorkflowCreatePayload {
  workflow_title: string;
  workflow_id: string;
  workflow_description: string;
}

export interface WorkflowUpdatePayload extends UpdatePayload {
  workflow_title: string;
  workflow_id: string;
  workflow_description: string;
}

export interface WorkflowDeletePayload {
  workflow_title: string;
  workflow_id: string;
}

export interface WorkflowDuplicatePayload {
  duplicated_workflow_title: string;
  duplicated_workflow_id: string;
  source_workflow_title: string;
  source_workflow_id: string;
  error?: string;
}

export interface RecordTemplateCreatePayload {
  template_title: string;
  template_id: string;
  table_id: string;
}

export interface RecordTemplateUpdatePayload {
  template_title: string;
  template_id: string;
  table_id: string;
}

export interface RecordTemplateDeletePayload {
  template_title: string;
  template_id: string;
  table_id: string;
}

export interface RecordTemplateUsePayload {
  template_title: string;
  template_id: string;
  table_id: string;
  usage_count: number;
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
  fk_org_id?: string | null;
  base_id: string | null;
  source_id: string | null;
  fk_model_id: string | null;
  row_id: string | null;
  op_type: AuditV1OperationTypes;
  details: T;
  version: 1;
  fk_parent_id?: string;
  // Reference id for the originating entity — e.g. the shared view / form id
  // for anonymous (ANONYMOUS_USER) public submissions, for traceability.
  fk_ref_id?: string | null;
}

/**
 * ` on table 'X'` for a single-table page, ` across N tables` for a dashboard
 * or leveled list, empty for a page that reads none (overview).
 */
function interfaceTableSuffix(details: {
  tables?: InterfaceAuditTableRef[];
  table_count?: number;
}): string {
  const count = details.table_count ?? details.tables?.length ?? 0;
  if (!count) return '';
  if (count === 1 && details.tables?.[0])
    return ` on table '${details.tables[0].title}'`;
  return ` across ${count} tables`;
}

/** `page 'X' of ` — grants target either the whole interface or one page. */
function interfaceGrantScope(details: {
  page_title?: string;
  page_id?: string;
}): string {
  if (!details.page_id) return '';
  return `page '${details.page_title ?? details.page_id}' of `;
}

const descriptionTemplates = {
  [AuditV1OperationTypes.USER_SIGNUP]: (audit: AuditV1<UserSignupPayload>) =>
    `User '${audit.user}' signed up`,
  [AuditV1OperationTypes.USER_SIGNIN]: (audit: AuditV1<UserSigninPayload>) =>
    `User '${audit.user}' signed in${
      audit.details.provider ? ` via ${audit.details.provider}` : ''
    }`,
  [AuditV1OperationTypes.USER_SIGNIN_FAILED]: (
    audit: AuditV1<UserSigninFailedPayload>
  ) =>
    `Failed sign-in attempt${
      audit.details.email ? ` for '${audit.details.email}'` : ''
    }${audit.details.provider ? ` via ${audit.details.provider}` : ''}${
      audit.details.reason ? ` - ${audit.details.reason}` : ''
    }`,
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
  [AuditV1OperationTypes.USER_MFA_SETUP]: (
    audit: AuditV1<UserMfaSetupPayload>
  ) => `User '${audit.user}' initiated 2FA setup`,
  [AuditV1OperationTypes.USER_MFA_ENABLED]: (
    audit: AuditV1<UserMfaEnabledPayload>
  ) => `User '${audit.user}' enabled two-factor authentication`,
  [AuditV1OperationTypes.USER_MFA_DISABLED]: (
    audit: AuditV1<UserMfaDisabledPayload>
  ) => `User '${audit.user}' disabled two-factor authentication`,
  [AuditV1OperationTypes.USER_MFA_VERIFY]: (
    audit: AuditV1<UserMfaVerifyPayload>
  ) =>
    `User '${audit.user}' verified 2FA${
      audit.details?.method === 'backup_code' ? ' using backup code' : ''
    }`,
  [AuditV1OperationTypes.USER_MFA_BACKUP_CODE_USED]: (
    audit: AuditV1<UserMfaBackupCodeUsedPayload>
  ) => `User '${audit.user}' used a backup code to sign in`,
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
  [AuditV1OperationTypes.ORG_USER_ADD]: (audit: AuditV1<any>) =>
    `User '${audit.user}' added '${audit.details?.email}' to organization`,
  [AuditV1OperationTypes.ORG_USER_REMOVE]: (audit: AuditV1<any>) =>
    `User '${audit.user}' removed '${
      audit.details?.email || audit.details?.user_id
    }' from organization`,
  [AuditV1OperationTypes.ORG_USER_ROLE_UPDATE]: (audit: AuditV1<any>) =>
    `User '${audit.user}' updated role of '${audit.details?.email}' in organization`,
  [AuditV1OperationTypes.ORG_WORKSPACE_ADD]: (audit: AuditV1<any>) =>
    `User '${audit.user}' added workspace to organization`,
  [AuditV1OperationTypes.ORG_WORKSPACE_REMOVE]: (audit: AuditV1<any>) =>
    `User '${audit.user}' removed workspace from organization`,
  [AuditV1OperationTypes.SCIM_GROUP_PROVISION]: (audit: AuditV1<any>) =>
    `SCIM group '${audit.details?.team_title}' provisioned`,
  [AuditV1OperationTypes.SCIM_GROUP_UPDATE]: (audit: AuditV1<any>) =>
    `SCIM group '${audit.details?.team_title}' updated`,
  [AuditV1OperationTypes.SCIM_GROUP_REPLACE]: (audit: AuditV1<any>) =>
    `SCIM group '${audit.details?.team_title}' replaced`,
  [AuditV1OperationTypes.SCIM_GROUP_DELETE]: (audit: AuditV1<any>) =>
    `SCIM group '${audit.details?.team_title}' deleted`,
  [AuditV1OperationTypes.SCIM_CONFIG_CREATE]: (_audit: AuditV1<any>) =>
    `SCIM provisioning configured`,
  [AuditV1OperationTypes.SCIM_CONFIG_UPDATE]: (_audit: AuditV1<any>) =>
    `SCIM provisioning configuration updated`,
  [AuditV1OperationTypes.SCIM_CONFIG_DISABLE]: (_audit: AuditV1<any>) =>
    `SCIM provisioning disabled`,
  [AuditV1OperationTypes.SCIM_CONFIG_DELETE]: (_audit: AuditV1<any>) =>
    `SCIM provisioning configuration deleted`,
  [AuditV1OperationTypes.SCIM_CONFIG_TOKEN_REGENERATE]: (
    _audit: AuditV1<any>
  ) => `SCIM provisioning token regenerated`,
  [AuditV1OperationTypes.SSO_CLIENT_CREATE]: (audit: AuditV1<any>) =>
    `SSO client '${audit.details?.title}' created`,
  [AuditV1OperationTypes.SSO_CLIENT_UPDATE]: (audit: AuditV1<any>) =>
    `SSO client '${audit.details?.title}' updated`,
  [AuditV1OperationTypes.SSO_CLIENT_DELETE]: (audit: AuditV1<any>) =>
    `SSO client '${audit.details?.title}' deleted`,
  [AuditV1OperationTypes.ORG_DOMAIN_ADD]: (audit: AuditV1<any>) =>
    `Domain '${audit.details?.domain_name}' added to organization`,
  [AuditV1OperationTypes.ORG_DOMAIN_UPDATE]: (audit: AuditV1<any>) =>
    `Domain '${audit.details?.domain_name}' updated`,
  [AuditV1OperationTypes.ORG_DOMAIN_DELETE]: (audit: AuditV1<any>) =>
    `Domain '${audit.details?.domain_name}' removed from organization`,
  [AuditV1OperationTypes.ORG_DOMAIN_VERIFY]: (audit: AuditV1<any>) =>
    `Domain '${audit.details?.domain_name}' verification initiated`,
  [AuditV1OperationTypes.WHITE_LABEL_UPDATE]: (audit: AuditV1<any>) =>
    `White-label settings updated (${
      audit.details?.enabled ? 'enabled' : 'disabled'
    })`,
  [AuditV1OperationTypes.DATA_INSERT]: (audit: AuditV1<DataInsertPayload>) =>
    `Record with ID [${audit.row_id}] has been inserted`,
  [AuditV1OperationTypes.DATA_UPDATE]: (audit: AuditV1<DataUpdatePayload>) =>
    `Record with ID [${audit.row_id}] has been updated`,
  [AuditV1OperationTypes.DATA_DELETE]: (audit: AuditV1<DataDeletePayload>) =>
    `Record with ID [${audit.row_id}] has been deleted`,
  [AuditV1OperationTypes.DATA_CASCADE_UPDATE]: (
    _audit: AuditV1<DataCascadeUpdatePayload>
  ) => `Record was rescheduled to avoid overlap with a conflicting record`,
  [AuditV1OperationTypes.DATA_SOFT_DELETE]: (
    audit: AuditV1<DataDeletePayload>
  ) => `Record with ID [${audit.row_id}] has been moved to trash`,
  [AuditV1OperationTypes.DATA_RESTORE]: (audit: AuditV1<DataDeletePayload>) =>
    `Record with ID [${audit.row_id}] has been restored from trash`,
  [AuditV1OperationTypes.DATA_PERMANENT_DELETE]: (
    audit: AuditV1<DataDeletePayload>
  ) => `Record with ID [${audit.row_id}] has been permanently deleted`,
  [AuditV1OperationTypes.DATA_BULK_SOFT_DELETE]: (
    _audit: AuditV1<DataDeletePayload>
  ) => `Records have been moved to trash`,
  [AuditV1OperationTypes.DATA_BULK_RESTORE]: (
    _audit: AuditV1<DataDeletePayload>
  ) => `Records have been restored from trash`,
  [AuditV1OperationTypes.DATA_BULK_PERMANENT_DELETE]: (
    _audit: AuditV1<DataDeletePayload>
  ) => `Records have been permanently deleted`,

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
  [AuditV1OperationTypes.SCRIPT_CREATE]: (
    audit: AuditV1<ScriptCreatePayload>
  ) => `Script '${audit.details.script_title}' has been created`,
  [AuditV1OperationTypes.SCRIPT_UPDATE]: (
    audit: AuditV1<ScriptUpdatePayload>
  ) => `Script '${audit.details.script_title}' has been updated`,
  [AuditV1OperationTypes.SCRIPT_DELETE]: (
    audit: AuditV1<ScriptDeletePayload>
  ) => `Script '${audit.details.script_title}' has been deleted`,
  [AuditV1OperationTypes.SCRIPT_DUPLICATE]: (
    audit: AuditV1<ScriptDuplicatePayload>
  ) => `Script '${audit.details.source_script_title}' has been duplicated`,

  [AuditV1OperationTypes.DASHBOARD_CREATE]: (
    audit: AuditV1<DashboardCreatePayload>
  ) => `Dashboard '${audit.details.dashboard_title}' has been created`,
  [AuditV1OperationTypes.DASHBOARD_UPDATE]: (
    audit: AuditV1<DashboardUpdatePayload>
  ) => `Dashboard '${audit.details.dashboard_title}' has been updated`,
  [AuditV1OperationTypes.DASHBOARD_DELETE]: (
    audit: AuditV1<DashboardDeletePayload>
  ) => `Dashboard '${audit.details.dashboard_title}' has been deleted`,
  [AuditV1OperationTypes.DASHBOARD_DUPLICATE]: (
    audit: AuditV1<DashboardDuplicatePayload>
  ) =>
    `Dashboard '${audit.details.source_dashboard_title}' has been duplicated`,
  [AuditV1OperationTypes.SHARED_DASHBOARD_CREATE]: (
    audit: AuditV1<SharedDashboardCreatePayload>
  ) => `Shared dashboard '${audit.details.dashboard_title}' has been created`,
  [AuditV1OperationTypes.SHARED_DASHBOARD_DELETE]: (
    audit: AuditV1<SharedDashboardDeletePayload>
  ) => `Shared dashboard '${audit.details.dashboard_title}' has been deleted`,
  [AuditV1OperationTypes.SHARED_DASHBOARD_UPDATE]: (
    audit: AuditV1<SharedDashboardUpdatePayload>
  ) => `Shared dashboard '${audit.details.dashboard_title}' has been updated`,
  [AuditV1OperationTypes.WIDGET_CREATE]: (
    audit: AuditV1<WidgetCreatePayload>
  ) => `Widget '${audit.details.widget_title}' has been created`,
  [AuditV1OperationTypes.WIDGET_UPDATE]: (
    audit: AuditV1<WidgetUpdatePayload>
  ) => `Widget '${audit.details.widget_title}' has been updated`,
  [AuditV1OperationTypes.WIDGET_DELETE]: (
    audit: AuditV1<WidgetDeletePayload>
  ) => `Widget '${audit.details.widget_title}' has been deleted`,
  [AuditV1OperationTypes.WIDGET_DUPLICATE]: (
    audit: AuditV1<WidgetDuplicatePayload>
  ) => `Widget '${audit.details.duplicated_widget_title}' has been duplicated`,
  [AuditV1OperationTypes.INTERFACE_CREATE]: (
    audit: AuditV1<InterfaceCreatePayload>
  ) => `Interface '${audit.details.interface_title}' has been created`,
  [AuditV1OperationTypes.INTERFACE_UPDATE]: (
    audit: AuditV1<InterfaceUpdatePayload>
  ) => `Interface '${audit.details.interface_title}' has been updated`,
  [AuditV1OperationTypes.INTERFACE_DELETE]: (
    audit: AuditV1<InterfaceDeletePayload>
  ) => `Interface '${audit.details.interface_title}' has been deleted`,
  [AuditV1OperationTypes.INTERFACE_DUPLICATE]: (
    audit: AuditV1<InterfaceDuplicatePayload>
  ) =>
    `Interface '${audit.details.source_interface_title}' has been duplicated`,
  [AuditV1OperationTypes.INTERFACE_PUBLISH]: (
    audit: AuditV1<InterfacePublishPayload>
  ) =>
    `Interface '${audit.details.interface_title}' has been published with ${audit.details.published_page_count} page(s)`,
  [AuditV1OperationTypes.INTERFACE_PAGE_CREATE]: (
    audit: AuditV1<InterfacePageCreatePayload>
  ) =>
    `Interface page '${audit.details.page_title}' (${
      audit.details.page_layout
    }) has been created in interface '${
      audit.details.interface_title
    }'${interfaceTableSuffix(audit.details)}`,
  [AuditV1OperationTypes.INTERFACE_PAGE_UPDATE]: (
    audit: AuditV1<InterfacePageUpdatePayload>
  ) => {
    const count = audit.details.config_diff?.change_count ?? 0;
    return `Interface page '${audit.details.page_title}' in interface '${
      audit.details.interface_title
    }' has been updated${count ? ` (${count} config change(s))` : ''}`;
  },
  [AuditV1OperationTypes.INTERFACE_PAGE_DELETE]: (
    audit: AuditV1<InterfacePageDeletePayload>
  ) =>
    `Interface page '${audit.details.page_title}' has been deleted from interface '${audit.details.interface_title}'`,
  [AuditV1OperationTypes.INTERFACE_PAGE_DUPLICATE]: (
    audit: AuditV1<InterfacePageDuplicatePayload>
  ) =>
    `Interface page '${audit.details.source_page_title}' has been duplicated as '${audit.details.page_title}' in interface '${audit.details.interface_title}'`,
  [AuditV1OperationTypes.SHARED_INTERFACE_PAGE_CREATE]: (
    audit: AuditV1<SharedInterfacePageCreatePayload>
  ) =>
    `Interface page '${audit.details.page_title}' of interface '${
      audit.details.interface_title
    }' has been shared publicly${
      audit.details.password_protected ? ' with a password' : ''
    }${interfaceTableSuffix(audit.details)}`,
  [AuditV1OperationTypes.SHARED_INTERFACE_PAGE_UPDATE]: (
    audit: AuditV1<SharedInterfacePageUpdatePayload>
  ) =>
    `Public share settings of interface page '${audit.details.page_title}' of interface '${audit.details.interface_title}' have been updated`,
  [AuditV1OperationTypes.SHARED_INTERFACE_PAGE_DELETE]: (
    audit: AuditV1<SharedInterfacePageDeletePayload>
  ) =>
    `Public share of interface page '${audit.details.page_title}' of interface '${audit.details.interface_title}' has been revoked`,
  [AuditV1OperationTypes.INTERFACE_DATA_EXPORT]: (
    audit: AuditV1<InterfaceDataExportPayload>
  ) =>
    `User '${audit.user}' exported ${
      audit.details.export_type
    } from interface page '${audit.details.page_title}' of interface '${
      audit.details.interface_title
    }' (table '${audit.details.table_title}')${
      audit.details.is_public_share ? ' via the public share link' : ''
    }`,
  [AuditV1OperationTypes.INTERFACE_USER_INVITE]: (
    audit: AuditV1<InterfaceUserInvitePayload>
  ) =>
    `${audit.details.principal_type === 'team' ? 'Team' : 'User'} '${
      audit.details.principal_title
    }' has been granted '${audit.details.role}' on ${
      interfaceGrantScope(audit.details)
    }interface '${audit.details.interface_title}'`,
  [AuditV1OperationTypes.INTERFACE_USER_UPDATE]: (
    audit: AuditV1<InterfaceUserUpdatePayload>
  ) =>
    `${audit.details.principal_type === 'team' ? 'Team' : 'User'} '${
      audit.details.principal_title
    }' role on ${
      interfaceGrantScope(audit.details)
    }interface '${audit.details.interface_title}' has been changed${
      audit.details.old_role ? ` from '${audit.details.old_role}'` : ''
    } to '${audit.details.role}'`,
  [AuditV1OperationTypes.INTERFACE_USER_DELETE]: (
    audit: AuditV1<InterfaceUserDeletePayload>
  ) =>
    `${audit.details.principal_type === 'team' ? 'Team' : 'User'} '${
      audit.details.principal_title
    }' access to ${
      interfaceGrantScope(audit.details)
    }interface '${audit.details.interface_title}' has been revoked`,
  [AuditV1OperationTypes.PERMISSION_CREATE]: (
    audit: AuditV1<PermissionCreatePayload>
  ) =>
    `Permission '${audit.details.permission}' has been created for entity '${audit.details.entity}' with ID '${audit.details.entity_id}'`,
  [AuditV1OperationTypes.PERMISSION_UPDATE]: (
    audit: AuditV1<PermissionUpdatePayload>
  ) =>
    `Permission '${audit.details.permission}' has been updated for entity '${audit.details.entity}' with ID '${audit.details.entity_id}'`,
  [AuditV1OperationTypes.PERMISSION_DELETE]: (
    audit: AuditV1<PermissionDeletePayload>
  ) =>
    `Permission '${audit.details.permission}' has been deleted for entity '${audit.details.entity}' with ID '${audit.details.entity_id}'`,
  [AuditV1OperationTypes.WORKFLOW_CREATE]: (
    audit: AuditV1<WorkflowCreatePayload>
  ) => `Workflow '${audit.details.workflow_title}' has been created`,
  [AuditV1OperationTypes.WORKFLOW_UPDATE]: (
    audit: AuditV1<WorkflowUpdatePayload>
  ) => `Workflow '${audit.details.workflow_title}' has been updated`,
  [AuditV1OperationTypes.WORKFLOW_DELETE]: (
    audit: AuditV1<WorkflowDeletePayload>
  ) => `Workflow '${audit.details.workflow_title}' has been deleted`,
  [AuditV1OperationTypes.WORKFLOW_DUPLICATE]: (
    audit: AuditV1<WorkflowDuplicatePayload>
  ) =>
    `Workflow '${audit.details.duplicated_workflow_title}' has been duplicated`,
  [AuditV1OperationTypes.RECORD_TEMPLATE_CREATE]: (
    audit: AuditV1<RecordTemplateCreatePayload>
  ) => `Record template '${audit.details.template_title}' has been created`,
  [AuditV1OperationTypes.RECORD_TEMPLATE_UPDATE]: (
    audit: AuditV1<RecordTemplateUpdatePayload>
  ) => `Record template '${audit.details.template_title}' has been updated`,
  [AuditV1OperationTypes.RECORD_TEMPLATE_DELETE]: (
    audit: AuditV1<RecordTemplateDeletePayload>
  ) => `Record template '${audit.details.template_title}' has been deleted`,
  [AuditV1OperationTypes.RECORD_TEMPLATE_USE]: (
    audit: AuditV1<RecordTemplateUsePayload>
  ) => `Record template '${audit.details.template_title}' has been used`,
  [AuditV1OperationTypes.RLS_POLICY_CREATE]: (
    audit: AuditV1<RlsPolicyCreatePayload>
  ) =>
    `RLS policy '${audit.details.policy_title}' has been created for table '${audit.details.table_id}'`,
  [AuditV1OperationTypes.RLS_POLICY_UPDATE]: (
    audit: AuditV1<RlsPolicyUpdatePayload>
  ) => `RLS policy '${audit.details.policy_title}' has been updated`,
  [AuditV1OperationTypes.RLS_POLICY_DELETE]: (
    audit: AuditV1<RlsPolicyDeletePayload>
  ) =>
    `RLS policy '${audit.details.policy_id}' has been deleted from table '${audit.details.table_id}'`,
  [AuditV1OperationTypes.VIEW_COLUMN_CREATE]: (
    audit: AuditV1<ViewColumnCreatePayload>
  ) =>
    `Field '${audit.details.field_title}' added to ${audit.details.view_type} '${audit.details.view_title}'`,
  [AuditV1OperationTypes.DATA_EXPORT]: (audit: AuditV1<DataExportPayload>) =>
    `User '${audit.user}' exported ${audit.details.export_type} from table '${audit.details.table_title}'`,
  [AuditV1OperationTypes.DATA_IMPORT]: (audit: AuditV1<DataImportPayload>) =>
    `User '${audit.user}' imported ${audit.details.import_type} into table '${audit.details.table_title}'`,
  [AuditV1OperationTypes.DOC_AI_COMPLETION]: (
    audit: AuditV1<DocAiCompletionPayload>
  ) => `AI '${audit.details.operation}' operation completed on document`,
  [AuditV1OperationTypes.DOCUMENT_CREATE]: (
    audit: AuditV1<DocumentCreatePayload>
  ) => `Document '${audit.details.document_title}' has been created`,
  [AuditV1OperationTypes.DOCUMENT_UPDATE]: (
    audit: AuditV1<DocumentUpdatePayload>
  ) => `Document '${audit.details.document_title}' has been updated`,
  [AuditV1OperationTypes.DOCUMENT_DELETE]: (
    audit: AuditV1<DocumentDeletePayload>
  ) => `Document '${audit.details.document_title}' has been deleted`,
  [AuditV1OperationTypes.DOCUMENT_REVISION_RESTORE]: (
    audit: AuditV1<DocumentRevisionRestorePayload>
  ) =>
    `Document '${audit.details.document_title}' restored to the version from ${audit.details.revision_created_at}`,
  [AuditV1OperationTypes.DOCUMENT_PUBLIC_SHARE_CREATE]: (
    audit: AuditV1<DocumentPublicShareCreatePayload>
  ) => `Public share enabled for document '${audit.details.document_title}'`,
  [AuditV1OperationTypes.DOCUMENT_PUBLIC_SHARE_UPDATE]: (
    audit: AuditV1<DocumentPublicShareUpdatePayload>
  ) => `Public share updated for document '${audit.details.document_title}'`,
  [AuditV1OperationTypes.DOCUMENT_PUBLIC_SHARE_DELETE]: (
    audit: AuditV1<DocumentPublicShareDeletePayload>
  ) => `Public share disabled for document '${audit.details.document_title}'`,
  [AuditV1OperationTypes.DOCUMENT_COMMENT_CREATE]: (
    audit: AuditV1<DocumentCommentCreatePayload>
  ) => `Comment added to document '${audit.details.document_id}'`,
  [AuditV1OperationTypes.DOCUMENT_COMMENT_UPDATE]: (
    audit: AuditV1<DocumentCommentUpdatePayload>
  ) => `Comment updated on document '${audit.details.document_id}'`,
  [AuditV1OperationTypes.DOCUMENT_COMMENT_DELETE]: (
    audit: AuditV1<DocumentCommentDeletePayload>
  ) => `Comment deleted from document '${audit.details.document_id}'`,
  [AuditV1OperationTypes.DATE_DEPENDENCY_UPDATE]: (
    audit: AuditV1<DateDependencyUpdatePayload>
  ) => {
    const verb = audit.details.is_new ? 'created' : 'updated';
    return audit.details.gantt_view_title
      ? `Date dependency ${verb} for Gantt view '${audit.details.gantt_view_title}' (table '${audit.details.table_title}')`
      : `Date dependency ${verb} for table '${audit.details.table_title}'`;
  },
  [AuditV1OperationTypes.DATE_DEPENDENCY_DELETE]: (
    audit: AuditV1<DateDependencyDeletePayload>
  ) =>
    audit.details.gantt_view_title
      ? `Date dependency deleted from Gantt view '${audit.details.gantt_view_title}' (table '${audit.details.table_title}')`
      : `Date dependency deleted from table '${audit.details.table_title}'`,
};

function auditDescription(audit: AuditV1) {
  return descriptionTemplates[audit.op_type](audit);
}

export { AuditV1OperationTypes, auditDescription };
