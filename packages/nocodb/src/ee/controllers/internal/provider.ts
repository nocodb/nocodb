import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/utils/internal-type';
import { WorkflowPostOperations } from '~/controllers/internal/modules/WorkflowPost.operations';
import { WorkflowGetOperations } from '~/controllers/internal/modules/WorkflowGet.operations';
import { UiPostOperations } from '~/controllers/internal/modules/UiPost.operations';
import { UiGetOperations } from '~/controllers/internal/modules/UiGet.operations';
import { IntegrationPostOperations } from '~/controllers/internal/modules/IntegrationPost.operations';
import { IntegrationGetOperations } from '~/controllers/internal/modules/IntegrationGet.operations';
import { ManagedAppGetOperations } from '~/controllers/internal/modules/ManagedAppGet.operations';
import { ManagedAppPostOperations } from '~/controllers/internal/modules/ManagedAppPost.operations';
import { SendRecordEmailOperations } from '~/controllers/internal/modules/SendRecordEmail.operations';
import { SandboxGetOperations } from '~/controllers/internal/modules/SandboxGet.operations';
import { SandboxPostOperations } from '~/controllers/internal/modules/SandboxPost.operations';
import { RlsGetOperations } from '~/controllers/internal/modules/RlsGet.operations';
import { RlsPostOperations } from '~/controllers/internal/modules/RlsPost.operations';
import { ViewSectionGetOperations } from '~/controllers/internal/modules/ViewSectionGet.operations';
import { ViewSectionPostOperations } from '~/controllers/internal/modules/ViewSectionPost.operations';
import { BaseVariableGetOperations } from '~/controllers/internal/modules/BaseVariableGet.operations';
import { BaseVariablePostOperations } from '~/controllers/internal/modules/BaseVariablePost.operations';
import { HookPostOperations } from '~/controllers/internal/modules/HookPost.operations';
import { HookGetOperations } from '~/controllers/internal/modules/HookGet.operations';
import { DocumentsGetOperations } from '~/controllers/internal/modules/DocumentsGet.operations';
import { DocumentsPostOperations } from '~/controllers/internal/modules/DocumentsPost.operations';
import { DocumentCommentsGetOperations } from '~/controllers/internal/modules/DocumentCommentsGet.operations';
import { DocumentCommentsPostOperations } from '~/controllers/internal/modules/DocumentCommentsPost.operations';
import { AiDataPostOperations } from '~/controllers/internal/modules/AiDataPost.operations';
import { ApiTokenGetOperations } from '~/controllers/internal/modules/ApiTokenGet.operations';
import { ApiTokenPostOperations } from '~/controllers/internal/modules/ApiTokenPost.operations';
import { BaseTrashGetOperations } from '~/controllers/internal/modules/BaseTrashGet.operations';
import { BaseTrashPostOperations } from '~/controllers/internal/modules/BaseTrashPost.operations';
import { SmartTextGetOperations } from '~/controllers/internal/modules/SmartTextGet.operations';
import { SmartTextPostOperations } from '~/controllers/internal/modules/SmartTextPost.operations';
import { UndoRedoPostOperations } from '~/controllers/internal/modules/UndoRedoPost.operations';
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
  IntegrationGetOperations,
  ManagedAppGetOperations,
  ManagedAppPostOperations,
  SendRecordEmailOperations,
  SandboxGetOperations,
  SandboxPostOperations,
  RlsGetOperations,
  RlsPostOperations,
  ViewSectionGetOperations,
  ViewSectionPostOperations,
  BaseVariableGetOperations,
  BaseVariablePostOperations,
  DocumentsGetOperations,
  DocumentsPostOperations,
  DocumentCommentsGetOperations,
  DocumentCommentsPostOperations,
  AiDataPostOperations,
  ApiTokenGetOperations,
  ApiTokenPostOperations,
  BaseTrashGetOperations,
  BaseTrashPostOperations,
  SmartTextGetOperations,
  SmartTextPostOperations,
  UndoRedoPostOperations,
];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
