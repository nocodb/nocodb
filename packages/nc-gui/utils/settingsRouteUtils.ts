/**
 * Shared settings route slug mappings.
 *
 * Internal tab names (used in components/stores) ↔ URL slugs (used in route paths).
 * Single source of truth — import these instead of hardcoding mappings.
 */

// Base settings: internal tab name → URL slug
export const baseSettingsTabToSlug: Record<string, string> = {
  'collaborator': 'members',
  'data-source': 'data-sources',
  'permissions': 'permissions',
  'docs-permissions': 'docs-permissions',
  'syncs': 'syncs',
  'integrations': 'integrations',
  'base-settings': 'settings',
  'audit': 'audits',
  'audits': 'audits',
  'workflows': 'workflows',
  'overview': 'overview',
  'mcp': 'mcp',
  'record-trash': 'record-trash',
  'snapshots': 'snapshots',
}

// Workspace settings: internal tab name → URL slug
// These map to flat routes: /{wsId}/{slug} (e.g. /{wsId}/members)
export const wsSettingsTabToSlug: Record<string, string> = {
  'ws-collaborators': 'members',
  'ws-teams': 'teams',
  'ws-integrations': 'integrations',
  'ws-billing': 'billing',
  'ws-audits': 'audits',
  'ws-sso': 'sso',
  'ws-settings': 'more',
}

// Combined: all settings tabs → URL slugs
export const settingsTabToSlug: Record<string, string> = {
  ...baseSettingsTabToSlug,
  ...wsSettingsTabToSlug,
}

// Inverse: URL slug → internal tab name
export const baseSettingsSlugToTab: Record<string, string> = Object.fromEntries(
  Object.entries(baseSettingsTabToSlug).map(([k, v]) => [v, k]),
)

export const wsSettingsSlugToTab: Record<string, string> = Object.fromEntries(
  Object.entries(wsSettingsTabToSlug).map(([k, v]) => [v, k]),
)

export const settingsSlugToTab: Record<string, string> = {
  ...baseSettingsSlugToTab,
  ...wsSettingsSlugToTab,
}
