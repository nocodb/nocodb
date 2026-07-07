/// <reference types="vite/client" />

interface Window {
  /**
   * Path prefix the platform serves this app under, injected at serve time.
   * "/" on the published domain root; a deeper path in the builder preview.
   * Used as the router basename so history routes resolve in both contexts.
   */
  __nc_app_base__?: string;
}
