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

export enum AppPageKind {
  AGENT = 'agent',
  MANUAL = 'manual',
}

/** First-class page entity (nc_app_pages row). */
export interface AppPageType {
  id: string;
  fk_workspace_id?: string;
  base_id?: string;
  fk_app_id: string;
  type: AppPageKind;
  route: string;
  title: string;
  slug: string;
  order?: number;
  meta?: { routines?: string[]; [k: string]: any } | string | null;
  deleted?: boolean;
  created_at?: string;
  updated_at?: string;
}

// AppPageManifestEntry — the frozen per-version snapshot shape. `id` is a real
// nc_app_pages.id (base-unique) and the PAGE_VIEW permission target.
export interface AppPageManifestEntry {
  id: string;
  route: string; // router route (renamed from `path`)
  title: string;
  slug: string; // src/pages/<slug>.tsx join key
  routines: string[];
}
export type AppPagesManifest = AppPageManifestEntry[];

// Client-facing nav entry injected as window.__nc_app_pages__ (routine list
// omitted — the server enforces reachability). Keeps `path` for the client
// router; the server maps manifest `route` -> nav `path`.
export interface AppPageNavEntry {
  id: string;
  path: string;
  title: string;
  slug: string;
}
