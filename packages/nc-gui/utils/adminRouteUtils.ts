/**
 * Shared admin route slug mappings.
 *
 * Internal tab names (used in components/stores) ↔ URL slugs (used in route paths).
 * Single source of truth — import these instead of hardcoding mappings.
 */

// Base settings: internal tab name → URL slug
export const baseAdminTabToSlug: Record<string, string> = {
  collaborator: 'members',
  'data-source': 'data-sources',
  permissions: 'permissions',
  syncs: 'syncs',
  'base-settings': 'settings',
  audits: 'audits',
  workflows: 'workflows',
  overview: 'overview',
  mcp: 'mcp',
  snapshots: 'snapshots',
}

// Workspace settings: internal tab name → URL slug
export const wsAdminTabToSlug: Record<string, string> = {
  'ws-collaborators': 'ws-members',
  'ws-teams': 'ws-teams',
  'ws-integrations': 'ws-integrations',
  'ws-billing': 'ws-billing',
  'ws-audits': 'ws-audits',
  'ws-sso': 'ws-sso',
  'ws-settings': 'ws-settings',
}

// Combined: all admin tabs → URL slugs
export const adminTabToSlug: Record<string, string> = {
  ...baseAdminTabToSlug,
  ...wsAdminTabToSlug,
}

// Inverse: URL slug → internal tab name
export const baseAdminSlugToTab: Record<string, string> = Object.fromEntries(
  Object.entries(baseAdminTabToSlug).map(([k, v]) => [v, k]),
)

export const wsAdminSlugToTab: Record<string, string> = Object.fromEntries(
  Object.entries(wsAdminTabToSlug).map(([k, v]) => [v, k]),
)

export const adminSlugToTab: Record<string, string> = {
  ...baseAdminSlugToTab,
  ...wsAdminSlugToTab,
}
