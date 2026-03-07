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

// Flat permission category keys
export enum ApiTokenPermissionCategory {
  // Data
  RECORDS = 'records',
  COMMENTS = 'comments',

  // Schema
  TABLES = 'tables',
  FIELDS = 'fields',
  VIEWS = 'views',

  // Tools
  WEBHOOKS = 'webhooks',
  EXTENSIONS = 'extensions',

  // Admin
  BASE = 'base',

  // Workspace-scoped (EE)
  BASES = 'bases',
  INTEGRATIONS = 'integrations',
  USERS = 'users',
}

// Base-scoped permission categories
export const BASE_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.RECORDS,
  ApiTokenPermissionCategory.COMMENTS,
  ApiTokenPermissionCategory.TABLES,
  ApiTokenPermissionCategory.FIELDS,
  ApiTokenPermissionCategory.VIEWS,
  ApiTokenPermissionCategory.WEBHOOKS,
  ApiTokenPermissionCategory.EXTENSIONS,
  ApiTokenPermissionCategory.BASE,
] as const;

// Workspace-scoped permission categories
export const WORKSPACE_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.BASES,
  ApiTokenPermissionCategory.INTEGRATIONS,
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
  Tools: [
    ApiTokenPermissionCategory.WEBHOOKS,
    ApiTokenPermissionCategory.EXTENSIONS,
  ],
  Admin: [ApiTokenPermissionCategory.BASE],
} as const;

export const API_TOKEN_WORKSPACE_PERMISSION_GROUPS = {
  Resources: [
    ApiTokenPermissionCategory.BASES,
    ApiTokenPermissionCategory.INTEGRATIONS,
  ],
  Members: [ApiTokenPermissionCategory.USERS],
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
    records: ApiTokenPermissionLevel.READ,
    comments: ApiTokenPermissionLevel.READ,
    tables: ApiTokenPermissionLevel.READ,
    fields: ApiTokenPermissionLevel.READ,
    views: ApiTokenPermissionLevel.READ,
    webhooks: ApiTokenPermissionLevel.NONE,
    extensions: ApiTokenPermissionLevel.NONE,
    base: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
  fullDataAccess: {
    records: ApiTokenPermissionLevel.WRITE,
    comments: ApiTokenPermissionLevel.WRITE,
    tables: ApiTokenPermissionLevel.READ,
    fields: ApiTokenPermissionLevel.READ,
    views: ApiTokenPermissionLevel.READ,
    webhooks: ApiTokenPermissionLevel.NONE,
    extensions: ApiTokenPermissionLevel.NONE,
    base: ApiTokenPermissionLevel.NONE,
  } as ApiTokenPermissions,
} as const;
