import { SetMetadata, UseInterceptors } from '@nestjs/common';
import {
  LICENSE_FEATURE_KEY,
  LicenseInterceptor,
} from '~/interceptors/license/license.interceptor';

/**
 * @License decorator for EE-only controller methods.
 *
 * In the unified build, all EE controllers are always registered.
 * This decorator gates access at runtime: if no valid license is present,
 * the endpoint returns HTTP 402 Payment Required.
 *
 * Can be stacked with @Acl for combined license + permission checks.
 *
 * @param feature - Human-readable feature name (e.g., 'Workspaces', 'SSO')
 *                  included in the 402 error message.
 *
 * @example
 * ```ts
 * @License('Workspaces')
 * @Acl('workspaceList', { scope: 'org' })
 * @Get('/api/v1/workspaces')
 * async workspaceList() { ... }
 * ```
 */
export const License =
  (feature?: string) =>
  (target: any, key?: string, descriptor?: PropertyDescriptor) => {
    SetMetadata(LICENSE_FEATURE_KEY, feature)(target, key, descriptor);
    UseInterceptors(LicenseInterceptor)(target, key, descriptor);
  };
