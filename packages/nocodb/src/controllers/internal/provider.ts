import type { InternalApiModule } from '~/controllers/internal/types';
import { McpGetOperation } from '~/controllers/internal/modules/McpGet.operation';
import { OAuthAuthorizationRevokeOperation } from '~/controllers/internal/modules/OAuthAuthorizationRevoke.operation';
import { OAuthClientCreateOperation } from '~/controllers/internal/modules/OAuthClientCreate.operation';
import { OAuthClientDeleteOperation } from '~/controllers/internal/modules/OAuthClientDelete.operation';
import { OAuthClientRegenerateSecretOperation } from '~/controllers/internal/modules/oAuthClientRegenerateSecret.operation';
import { OAuthClientUpdateOperation } from '~/controllers/internal/modules/OAuthClientUpdate.operation';
import { McpCreateOperation } from '~/controllers/internal/modules/McpCreate.operation';
import { McpDeleteOperation } from '~/controllers/internal/modules/McpDelete.operation';
import { McpListOperation } from '~/controllers/internal/modules/McpList.operation';
import { McpUpdateOperation } from '~/controllers/internal/modules/McpUpdate.operation';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/controllers/internal/types';
import { McpRootListOperation } from '~/controllers/internal/modules/McpRootList.operation';
import { OAuthAuthorizationListOperation } from '~/controllers/internal/modules/OAuthAuthorizationList.operation';
import { OAuthClientGetOperation } from '~/controllers/internal/modules/OAuthClientGet.operation';
import { OAuthClientListOperation } from '~/controllers/internal/modules/OAuthClientList.operation';
import { RecordAuditListOperation } from '~/controllers/internal/modules/RecordAuditList.operation';

export const InternalApiModules = [
  McpCreateOperation,
  McpUpdateOperation,
  McpGetOperation,
  McpListOperation,
  McpRootListOperation,
  McpDeleteOperation,
  OAuthAuthorizationListOperation,
  OAuthAuthorizationRevokeOperation,
  OAuthClientCreateOperation,
  OAuthClientDeleteOperation,
  OAuthClientGetOperation,
  OAuthClientListOperation,
  OAuthClientRegenerateSecretOperation,
  OAuthClientUpdateOperation,
  RecordAuditListOperation,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
