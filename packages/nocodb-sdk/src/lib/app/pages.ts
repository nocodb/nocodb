/**
 * Page manifest — the reachability unit of a published app.
 *
 * A page is declared by the build agent via `definePages([...])` in the app's
 * `src/pages.ts`. At publish the manifest is source-scanned and frozen into the
 * immutable, sha-addressed published storage manifest. It drives three things:
 *  - the granted-page navigation served to each user,
 *  - the derived routine grants enforced at invoke (a routine is reachable iff it
 *    is listed by a page the caller can view),
 *  - the per-page permission targets (`entity='page', entity_id=<page id>`).
 *
 * The page `id` is authored by the builder and is stable across re-publishes, so
 * permissions set on it survive new versions.
 */
export interface AppPageManifestEntry {
  /** Builder-authored, stable across versions. Permission target (entity_id). */
  id: string;
  /** Router path, e.g. `/` or `/admin`. */
  path: string;
  /** Human label shown in nav / access UI. */
  title: string;
  /** Routine names this page is allowed to invoke (its reachability set). */
  routines: string[];
}

export type AppPagesManifest = AppPageManifestEntry[];

/**
 * Client-facing nav entry injected as `window.__nc_app_pages__` — the routine
 * list is intentionally omitted (the server enforces reachability; the client
 * only needs to render navigation).
 */
export interface AppPageNavEntry {
  id: string;
  path: string;
  title: string;
}

/**
 * Page ids are authored per-app and only unique WITHIN an app, but the
 * `nc_permissions.entity_id` column is base-scoped (many apps share a base).
 * The PAGE_VIEW permission target is therefore the composite `<appId>::<pageId>`
 * so two apps in the same base can each own a page called `admin`.
 */
export const APP_PAGE_ENTITY_SEP = '::';

export function appPagePermissionEntityId(
  appId: string,
  pageId: string
): string {
  return `${appId}${APP_PAGE_ENTITY_SEP}${pageId}`;
}

export function parseAppPagePermissionEntityId(
  entityId: string
): { appId: string; pageId: string } | null {
  const idx = entityId.indexOf(APP_PAGE_ENTITY_SEP);
  if (idx === -1) return null;
  return {
    appId: entityId.slice(0, idx),
    pageId: entityId.slice(idx + APP_PAGE_ENTITY_SEP.length),
  };
}
