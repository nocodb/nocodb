import { pages } from '@/pages';

export interface AppNavEntry {
  id: string;
  path: string;
  title: string;
}

/**
 * The pages the current caller may see, manifest-ordered — THE source for any
 * navigation UI. Live (published) apps get the server-filtered grant set
 * (window.__nc_app_pages__, routines omitted); dev/preview falls back to the
 * full local manifest. Never hardcode nav links: a hardcoded list shows
 * callers pages they can't access and misses pages they can.
 */
export function useAppPages(): AppNavEntry[] {
  if (window.__nc_app_live__ === true) return window.__nc_app_pages__ ?? [];
  return pages.map((p) => ({ id: p.id, path: p.path, title: p.title }));
}

/**
 * Router basename — the platform-injected path prefix ("/" on the published
 * domain, a deeper path in the builder preview). Always pass this to
 * `<BrowserRouter basename>` so history routes resolve identically in both.
 */
export function appBasename(): string {
  return (window.__nc_app_base__ ?? '/').replace(/\/$/, '') || '/';
}
