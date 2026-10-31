// Fine-grained API token types and enums

export enum ApiTokenScopeResourceType {
  BASE = 'base',
  WORKSPACE = 'workspace',
  /**
   * Account-wide: every resource the token's user can reach, present or future.
   * Stored with `resource_id: '*'`. Already honoured by
   * `ApiTokenScope.findMatchingScope` and `getPatResourceFilter`, which
   * predate this member and reached for it through `as string` casts.
   */
  ALL = 'all',
}

/** `resource_id` of an `ALL` scope. */
export const API_TOKEN_SCOPE_ALL_RESOURCE_ID = '*';

export enum ApiTokenPermissionLevel {
  NONE = 'none',
  READ = 'read',
  WRITE = 'write',
  /**
   * Write, plus the operations that destroy what they touch. Its own level
   * rather than a flag beside `write`, because that is what it is: the top of
   * one ladder, and a grant can hold it per category.
   */
  DELETE = 'delete',
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
  WORKFLOWS = 'workflows',
  AGENTS = 'agents',
  SCRIPTS = 'scripts',
  INTEGRATIONS = 'integrations',
  ENVIRONMENTS = 'environments',
  APPS = 'apps',
  WORKSPACES = 'workspaces',
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
  ApiTokenPermissionCategory.WORKFLOWS,
  ApiTokenPermissionCategory.AGENTS,
  ApiTokenPermissionCategory.SCRIPTS,
] as const;

// Categories that only mean something at workspace level or above.
export const WORKSPACE_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.INTEGRATIONS,
  ApiTokenPermissionCategory.ENVIRONMENTS,
  ApiTokenPermissionCategory.APPS,
] as const;

// Categories that only mean something at account level.
export const ACCOUNT_SCOPED_PERMISSION_CATEGORIES = [
  ApiTokenPermissionCategory.WORKSPACES,
] as const;

/**
 * Which categories are worth offering on a scope row of each resource type —
 * for the token UI, which renders one category list per row. Containment is
 * deliberate: a broader row must be able to hold everything a narrower one
 * could, or `all: { records: 'write' }` — "records in any base I can reach" —
 * would be unexpressible.
 *
 * Not enforced at write time. A base row carrying `workspaces` is meaningless
 * rather than dangerous — the category has no base-level operation, so it can
 * never satisfy one — and the shared `API_TOKEN_PERMISSION_PRESETS` are one
 * flat object applied to any row type, so rejecting it would make `readOnly`
 * invalid on a base row.
 */
export const PERMISSION_CATEGORIES_BY_RESOURCE_TYPE: Record<
  ApiTokenScopeResourceType,
  readonly ApiTokenPermissionCategory[]
> = {
  [ApiTokenScopeResourceType.BASE]: BASE_SCOPED_PERMISSION_CATEGORIES,
  [ApiTokenScopeResourceType.WORKSPACE]: [
    ...BASE_SCOPED_PERMISSION_CATEGORIES,
    ...WORKSPACE_SCOPED_PERMISSION_CATEGORIES,
  ],
  [ApiTokenScopeResourceType.ALL]: [
    ...BASE_SCOPED_PERMISSION_CATEGORIES,
    ...WORKSPACE_SCOPED_PERMISSION_CATEGORIES,
    ...ACCOUNT_SCOPED_PERMISSION_CATEGORIES,
  ],
};

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
  Automation: [
    ApiTokenPermissionCategory.WORKFLOWS,
    ApiTokenPermissionCategory.AGENTS,
    ApiTokenPermissionCategory.SCRIPTS,
    ApiTokenPermissionCategory.WEBHOOKS,
  ],
  Platform: [
    ApiTokenPermissionCategory.WORKSPACES,
    ApiTokenPermissionCategory.INTEGRATIONS,
    ApiTokenPermissionCategory.ENVIRONMENTS,
    ApiTokenPermissionCategory.APPS,
  ],
  Admin: [ApiTokenPermissionCategory.BASE, ApiTokenPermissionCategory.USERS],
} as const;

/** Categories a user may pick in the token UI. */
export const SELECTABLE_PERMISSION_CATEGORIES = Object.values(
  ApiTokenPermissionCategory
);

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

// Maximum number of IP / CIDR entries allowed on a single token's allowlist.
export const MAX_API_TOKEN_IP_ALLOWLIST = 50;

/**
 * Normalize a raw IP allowlist input into a clean list of entries.
 * Accepts a string (comma / newline / whitespace separated) or an array.
 * Trims, drops empties, and de-duplicates while preserving order.
 * Pure string handling only — actual IP/CIDR validity is checked on the backend.
 */
export function normalizeIpAllowlist(
  input?: string | string[] | null
): string[] {
  if (!input) return [];
  const parts = Array.isArray(input)
    ? input
    : typeof input === 'string'
    ? input.split(/[\s,]+/)
    : [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of parts) {
    if (typeof raw !== 'string') continue;
    const entry = raw.trim();
    if (!entry || seen.has(entry)) continue;
    seen.add(entry);
    result.push(entry);
  }
  return result;
}

const IPV4_OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4_RE = new RegExp(`^${IPV4_OCTET}(?:\\.${IPV4_OCTET}){3}$`);

function isIpv6(value: string): boolean {
  if (!value.includes(':') || /[^0-9a-fA-F:.]/.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Client-side check for one allowlist entry: a dotted-quad IPv4 or an IPv6
 * address, optionally with a CIDR prefix. The backend stays authoritative.
 */
export function isValidIpAllowlistEntry(entry: string): boolean {
  const [addr, prefix, ...rest] = entry.split('/');
  if (rest.length) return false;

  const isV4 = IPV4_RE.test(addr);
  if (!isV4 && !isIpv6(addr)) return false;
  if (prefix === undefined) return true;

  return /^\d{1,3}$/.test(prefix) && Number(prefix) <= (isV4 ? 32 : 128);
}

// Preset permission configurations for UI
export const API_TOKEN_PERMISSION_PRESETS = {
  readOnly: {
    records: ApiTokenPermissionLevel.READ,
    tables: ApiTokenPermissionLevel.READ,
    fields: ApiTokenPermissionLevel.READ,
    views: ApiTokenPermissionLevel.READ,
    base: ApiTokenPermissionLevel.READ,
    comments: ApiTokenPermissionLevel.READ,
    workflows: ApiTokenPermissionLevel.READ,
    agents: ApiTokenPermissionLevel.READ,
    scripts: ApiTokenPermissionLevel.READ,
    integrations: ApiTokenPermissionLevel.READ,
    environments: ApiTokenPermissionLevel.READ,
    apps: ApiTokenPermissionLevel.READ,
    workspaces: ApiTokenPermissionLevel.READ,
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
