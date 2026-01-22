import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/utils/internal-type';
import { WorkflowPostOperations } from '~/controllers/internal/modules/WorkflowPost.operations';
import { WorkflowGetOperations } from '~/controllers/internal/modules/WorkflowGet.operations';
import { UiPostOperations } from '~/controllers/internal/modules/UiPost.operations';
import { UiGetOperations } from '~/controllers/internal/modules/UiGet.operations';
import { IntegrationPostOperations } from '~/controllers/internal/modules/IntegrationPost.operations';
import { ManagedAppGetOperations } from '~/controllers/internal/modules/ManagedAppGet.operations';
import { ManagedAppPostOperations } from '~/controllers/internal/modules/ManagedAppPost.operations';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

export const InternalApiModules = [
  ...InternalApiModulesCE,
  WorkflowPostOperations,
  WorkflowGetOperations,
  UiPostOperations,
  UiGetOperations,
  IntegrationPostOperations,
  ManagedAppGetOperations,
  ManagedAppPostOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
