export interface AppNavEntry {
  id: string;
  path: string;
  title: string;
  slug: string;
}

/**
 * The pages the current caller may see — THE source for any navigation UI.
 * The platform injects window.__nc_app_pages__ in BOTH the live published app
 * (server-filtered to the caller's granted pages) and the builder preview (all
 * of the app's pages, ungated). Never hardcode nav links.
 */
export function useAppPages(): AppNavEntry[] {
  return window.__nc_app_pages__ ?? [];
}

/**
 * Router basename — the platform-injected path prefix ("/" on the published
 * domain, a deeper path in the builder preview). Always pass this to
 * `<BrowserRouter basename>` so history routes resolve identically in both.
 */
export function appBasename(): string {
  return (window.__nc_app_base__ ?? '/').replace(/\/$/, '') || '/';
}
