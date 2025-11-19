import 'nocodb-sdk';

declare module 'nocodb-sdk' {
  interface NcContext {
    /**
     * Enable per-request in-memory caching when set to true
     */
    cache?: boolean;
    /**
     * Per-request cache map for storing cached method results
     * Automatically initialized when cache is enabled
     */
    cacheMap?: Map<string, any>;
  }
}
