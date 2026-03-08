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

// Permission category keys — kept simple (like Airtable)
export enum ApiTokenPermissionCategory {
  DATA = 'data',
  COMMENTS = 'comments',
  WEBHOOKS = 'webhooks',
  USERS = 'users',
}

// Base-scoped permission categories
export const BASE_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.DATA,
  ApiTokenPermissionCategory.COMMENTS,
  ApiTokenPermissionCategory.WEBHOOKS,
  ApiTokenPermissionCategory.USERS,
] as const;

// Permission categories grouped for UI display (flat — no groups needed with 4 items)
export const API_TOKEN_PERMISSION_GROUPS = {
  Permissions: [
    ApiTokenPermissionCategory.DATA,
    ApiTokenPermissionCategory.COMMENTS,
    ApiTokenPermissionCategory.WEBHOOKS,
    ApiTokenPermissionCategory.USERS,
  ],
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
  readOnlyData: {
    data: ApiTokenPermissionLevel.READ,
    comments: ApiTokenPermissionLevel.READ,
    webhooks: ApiTokenPermissionLevel.NONE,
    users: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
  fullDataAccess: {
    data: ApiTokenPermissionLevel.WRITE,
    comments: ApiTokenPermissionLevel.WRITE,
    webhooks: ApiTokenPermissionLevel.NONE,
    users: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
} as const;
