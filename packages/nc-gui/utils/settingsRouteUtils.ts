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
  'base-settings': 'settings',
  'audit': 'audits',
  'audits': 'audits',
  'workflows': 'workflows',
  'overview': 'overview',
  'mcp': 'mcp',
  'snapshots': 'snapshots',
}

// Workspace settings: internal tab name → URL slug
export const wsSettingsTabToSlug: Record<string, string> = {
  'ws-collaborators': 'ws-members',
  'ws-teams': 'ws-teams',
  'ws-integrations': 'ws-integrations',
  'ws-billing': 'ws-billing',
  'ws-audits': 'ws-audits',
  'ws-sso': 'ws-sso',
  'ws-settings': 'ws-settings',
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
