import type { InternalApiModule } from '~/utils/internal-type';
import { RecordAuditListOperations } from '~/controllers/internal/modules/RecordAuditList.operations';
import { McpGetOperations } from '~/controllers/internal/modules/McpGet.operations';
import { McpPostOperations } from '~/controllers/internal/modules/McpPost.operations';
import { OAuthGetOperations } from '~/controllers/internal/modules/OAuthGet.operations';
import { OAuthPostOperations } from '~/controllers/internal/modules/OAuthPost.operations';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

export const InternalApiModules = [
  McpGetOperations,
  McpPostOperations,
  OAuthGetOperations,
  OAuthPostOperations,
  RecordAuditListOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
