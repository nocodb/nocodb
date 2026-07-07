/// <reference types="vite/client" />

interface Window {
  /**
   * Path prefix the platform serves this app under, injected at serve time.
   * "/" on the published domain root; a deeper path in the builder preview.
   * Used as the router basename so history routes resolve in both contexts.
   */
  __nc_app_base__?: string;
  /**
   * The pages the current caller may see, injected at serve time in BOTH the
   * live published app (pre-filtered server-side to the caller's granted
   * pages, routines omitted) and the builder preview (all of the app's
   * pages, ungated). Undefined only outside these contexts.
   */
  __nc_app_pages__?: {
    id: string;
    path: string;
    title: string;
    slug: string;
  }[];
  /** True only when this bundle is running as the live published app. */
  __nc_app_live__?: boolean;
  /**
   * The current viewer, injected at serve time. `id` is always present; the
   * platform adds `displayName` (the viewer's own name). email/role are NOT
   * injected in v1 (data-minimization; role/teams are planned future meta).
   * Undefined outside the served/preview contexts (e.g. anonymous preview).
   */
  __nc_app_user__?: {
    id: string;
    displayName?: string;
  };
  /**
   * App identity for the nav sidebar (title + optional icon), injected at
   * serve time. `title` mirrors the app's name; `icon` is the app's meta.icon.
   */
  __nc_app_meta__?: {
    title?: string;
    icon?: string;
  };
}
