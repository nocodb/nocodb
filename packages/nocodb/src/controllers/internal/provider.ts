import type { InternalApiModule } from '~/controllers/internal/types';
import { McpGetOperations } from '~/controllers/internal/modules/McpGet.operations';
import { McpPostOperations } from '~/controllers/internal/modules/McpPost.operations';
import { OAuthGetOperations } from '~/controllers/internal/modules/OAuthGet.operations';
import { OAuthPostOperations } from '~/controllers/internal/modules/OAuthPost.operations';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/controllers/internal/types';

export const InternalApiModules = [
  McpGetOperations,
  McpPostOperations,
  OAuthGetOperations,
  OAuthPostOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
