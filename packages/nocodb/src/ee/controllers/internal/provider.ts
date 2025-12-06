import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/utils/internal-type';
import { WorkflowPostOperations } from '~/controllers/internal/modules/WorkflowPost.operations';
import { WorkflowGetOperations } from '~/controllers/internal/modules/WorkflowGet.operations';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

export const InternalApiModules = [
  ...InternalApiModulesCE,
  WorkflowPostOperations,
  WorkflowGetOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
