import 'nocodb-sdk';
import type { Permission } from '~/models';

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
    /**
     * Cached permissions list for the base to avoid multiple fetches
     */
    permissions?: Permission[];
    /**
     * Indicates if the request is made using an API token
     */
    is_api_token?: boolean;
  }
}
