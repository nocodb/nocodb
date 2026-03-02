import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/utils/internal-type';
import { WorkflowPostOperations } from '~/controllers/internal/modules/WorkflowPost.operations';
import { WorkflowGetOperations } from '~/controllers/internal/modules/WorkflowGet.operations';
import { UiPostOperations } from '~/controllers/internal/modules/UiPost.operations';
import { UiGetOperations } from '~/controllers/internal/modules/UiGet.operations';
import { IntegrationPostOperations } from '~/controllers/internal/modules/IntegrationPost.operations';
import { ManagedAppGetOperations } from '~/controllers/internal/modules/ManagedAppGet.operations';
import { ManagedAppPostOperations } from '~/controllers/internal/modules/ManagedAppPost.operations';
import { SendRecordEmailOperations } from '~/controllers/internal/modules/SendRecordEmail.operations';
import { SandboxGetOperations } from '~/controllers/internal/modules/SandboxGet.operations';
import { SandboxPostOperations } from '~/controllers/internal/modules/SandboxPost.operations';
import { RlsGetOperations } from '~/controllers/internal/modules/RlsGet.operations';
import { RlsPostOperations } from '~/controllers/internal/modules/RlsPost.operations';
import { ViewSectionGetOperations } from '~/controllers/internal/modules/ViewSectionGet.operations';
import { ViewSectionPostOperations } from '~/controllers/internal/modules/ViewSectionPost.operations';
import { HookPostOperations } from '~/controllers/internal/modules/HookPost.operations';
import { HookGetOperations } from '~/controllers/internal/modules/HookGet.operations';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

export const InternalApiModules = [
  ...InternalApiModulesCE,
  WorkflowPostOperations,
  WorkflowGetOperations,
  HookPostOperations,
  HookGetOperations,
  UiPostOperations,
  UiGetOperations,
  IntegrationPostOperations,
  ManagedAppGetOperations,
  ManagedAppPostOperations,
  SendRecordEmailOperations,
  SandboxGetOperations,
  SandboxPostOperations,
  RlsGetOperations,
  RlsPostOperations,
  ViewSectionGetOperations,
  ViewSectionPostOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
