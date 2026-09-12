/**
 * Shared settings route slug mappings.
 *
 * Internal tab names (used in components/stores) ↔ URL slugs (used in route paths).
 * Single source of truth — import these instead of hardcoding mappings.
 */

// Base settings: internal tab name → URL slug
export const baseSettingsTabToSlug: Record<string, string> = {
  'collaborator': 'members',
  'interface-members': 'interface-members',
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
  'variables': 'variables',
  'snapshots': 'snapshots',
  // App settings (EE) — one app per base, so its settings live alongside the
  // base's rather than behind a separate surface.
  'app-url': 'app-url',
  'app-theme': 'app-theme',
  'app-access': 'app-access',
  'app-public': 'app-public',
  'app-marketplace': 'app-marketplace',
  'app-connections': 'app-connections',
  'app-assistant': 'app-assistant',
  'app-api': 'app-api',
  'app-versions': 'app-versions',
  'skills': 'skills',
}

// The app settings section, in nav order. Rendered only when the base has an
// app, so it is inert in CE. `label` is an i18n key, resolved by the caller.
//
// `installer` marks a tab whose subject belongs to whoever INSTALLED the app
// rather than to the publisher — the serving address, who may use it, and which
// connections it may reach. The rest edit the publisher's artifact, which the
// backend refuses on an install and the next update would overwrite anyway.
//
// `listing` marks a tab that only exists once the base carries a store listing.
//
// `production` marks a tab whose subject is the SERVING app. Every one of those
// rows is base-scoped to Production, so inside an environment copy the tab can
// only show an empty list or mint a credential the app origin will refuse — so
// the pane says so, rather than the tab vanishing from a copy's nav.
export const appSettingsNav: {
  tab: string
  label: string
  icon: string
  testId: string
  installer?: boolean
  listing?: boolean
  production?: boolean
}[] = [
  { tab: 'app-url', label: 'labels.appUrl', icon: 'ncGlobe', testId: 'app-url', installer: true },
  { tab: 'app-theme', label: 'labels.appTheme', icon: 'ncPalette', testId: 'app-theme' },
  { tab: 'app-access', label: 'general.access', icon: 'ncShield', testId: 'app-access', installer: true },
  // The anonymous surface is its own subject: pages and the actions a visitor
  // may invoke are two halves of one answer, and neither belongs in a roster.
  { tab: 'app-public', label: 'labels.appPublic.title', icon: 'ncEye', testId: 'app-public', installer: true },
  // The store page's own settings: everything the inline listing form does not
  // ask for, plus the takedown. Beside Access and Public because it is the third
  // audience — the internet, the workspace, and other companies.
  {
    tab: 'app-marketplace',
    label: 'general.marketplace',
    icon: 'ncBox',
    testId: 'app-marketplace',
    listing: true,
  },
  { tab: 'app-assistant', label: 'labels.appAssistant', icon: 'ncAutoAwesome', testId: 'app-assistant' },
  {
    tab: 'app-connections',
    label: 'labels.appConnections.title',
    icon: 'ncLink',
    testId: 'app-connections',
    installer: true,
  },
  // The tokens belong to whoever installed the app, not to the publisher's
  // artifact — each one acts as its creator's persona on THIS install, and the
  // spec shown beside them is that same persona's reach.
  { tab: 'app-api', label: 'labels.appApi.title', icon: 'ncKey2', testId: 'app-api', installer: true, production: true },
  {
    tab: 'app-versions',
    label: 'title.versionHistory',
    icon: 'ncGitBranch',
    testId: 'app-versions',
    production: true,
  },
]

/** The nav an installed app's owner gets; the full one for its publisher. */
export function appSettingsNavFor(isInstall: boolean, isListing = false, hasApp = true, storeEnabled = true) {
  if (isInstall) return appSettingsNav.filter((item) => item.installer)

  // Every tab but Marketplace edits the app; Marketplace edits the listing. A
  // base published with nothing to serve has a store page and no app, so the
  // listing is then the whole nav — otherwise Edit leads to an empty pane.
  // `storeEnabled` is the store's own feature flag: a base can already carry a
  // listing from before the flag went on, and its store pane is store-facing.
  return appSettingsNav.filter((item) => (item.listing ? isListing && storeEnabled : hasApp))
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
