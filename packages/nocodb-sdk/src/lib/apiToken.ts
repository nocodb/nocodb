// Fine-grained API token types and enums

export enum ApiTokenScopeResourceType {
  BASE = 'base',
  WORKSPACE = 'workspace',
}

export enum ApiTokenPermissionLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
}

// Permission category keys — granular per resource type
export enum ApiTokenPermissionCategory {
  RECORDS = 'records',
  TABLES = 'tables',
  FIELDS = 'fields',
  VIEWS = 'views',
  BASE = 'base',
  COMMENTS = 'comments',
  WEBHOOKS = 'webhooks',
  USERS = 'users',
}

// Base-scoped permission categories
export const BASE_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.RECORDS,
  ApiTokenPermissionCategory.TABLES,
  ApiTokenPermissionCategory.FIELDS,
  ApiTokenPermissionCategory.VIEWS,
  ApiTokenPermissionCategory.BASE,
  ApiTokenPermissionCategory.COMMENTS,
  ApiTokenPermissionCategory.WEBHOOKS,
  ApiTokenPermissionCategory.USERS,
] as const;

// Permission categories grouped for UI display
export const API_TOKEN_PERMISSION_GROUPS = {
  Data: [
    ApiTokenPermissionCategory.RECORDS,
    ApiTokenPermissionCategory.COMMENTS,
  ],
  Schema: [
    ApiTokenPermissionCategory.TABLES,
    ApiTokenPermissionCategory.FIELDS,
    ApiTokenPermissionCategory.VIEWS,
  ],
  Tools: [ApiTokenPermissionCategory.WEBHOOKS],
  Admin: [ApiTokenPermissionCategory.BASE, ApiTokenPermissionCategory.USERS],
} as const;

export type ApiTokenPermissions = Partial<
  Record<ApiTokenPermissionCategory, ApiTokenPermissionLevel>
>;

export interface ApiTokenPermissionsJson {
  version: 1;
  categories: ApiTokenPermissions;
}

// Scope entry for a token — each maps to a row in nc_api_token_scopes
export interface ApiTokenScopeEntry {
  id?: string;
  resource_type: ApiTokenScopeResourceType;
  resource_id: string;
  permissions?: ApiTokenPermissions;
}

export const API_TOKEN_PREFIX = 'nc_pat_';

// Preset permission configurations for UI
export const API_TOKEN_PERMISSION_PRESETS = {
  readOnly: {
    records: ApiTokenPermissionLevel.READ,
    tables: ApiTokenPermissionLevel.READ,
    fields: ApiTokenPermissionLevel.READ,
    views: ApiTokenPermissionLevel.READ,
    base: ApiTokenPermissionLevel.READ,
    comments: ApiTokenPermissionLevel.READ,
    webhooks: ApiTokenPermissionLevel.NONE,
    users: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
  fullDataAccess: {
    records: ApiTokenPermissionLevel.WRITE,
    tables: ApiTokenPermissionLevel.NONE,
    fields: ApiTokenPermissionLevel.NONE,
    views: ApiTokenPermissionLevel.NONE,
    base: ApiTokenPermissionLevel.NONE,
    comments: ApiTokenPermissionLevel.WRITE,
    webhooks: ApiTokenPermissionLevel.NONE,
    users: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
} as const;
