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

export interface AppUser {
  id: string;
  displayName?: string;
}

/**
 * The current viewer, injected by the platform at serve time. `undefined` in
 * anonymous contexts. v1 exposes `id` + `displayName` only.
 */
export function useAppUser(): AppUser | undefined {
  return window.__nc_app_user__;
}

export interface AppMeta {
  title?: string;
  icon?: string;
}

/**
 * App identity (title + optional icon) for navigation chrome. Falls back to the
 * document title for pure local `vite dev` where nothing is injected.
 */
export function useAppMeta(): AppMeta {
  const injected = window.__nc_app_meta__;
  if (injected && (injected.title || injected.icon)) return injected;
  return { title: document.title || undefined };
}
