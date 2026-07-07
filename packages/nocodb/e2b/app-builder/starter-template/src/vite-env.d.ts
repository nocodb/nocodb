/// <reference types="vite/client" />

interface Window {
  /**
   * Path prefix the platform serves this app under, injected at serve time.
   * "/" on the published domain root; a deeper path in the builder preview.
   * Used as the router basename so history routes resolve in both contexts.
   */
  __nc_app_base__?: string;
  /**
   * The pages the current caller may see, injected at serve time in the live
   * published app — pre-filtered server-side from the src/pages.ts manifest
   * (routines omitted). Undefined in dev/preview; an array (possibly empty)
   * in the live app.
   */
  __nc_app_pages__?: { id: string; path: string; title: string }[];
  /** True only when this bundle is running as the live published app. */
  __nc_app_live__?: boolean;
}
