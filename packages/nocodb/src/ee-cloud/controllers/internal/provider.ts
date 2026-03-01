import { InternalApiModules as InternalApiModulesEE } from 'src/ee/controllers/internal/provider';
import { InstanceAdminGetOperations } from 'src/controllers/internal/modules/InstanceAdminGet.operations';
import type { InternalApiModule } from '~/utils/internal-type';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

// Cloud: remove instance-level admin operations (on-prem only)
export const InternalApiModules = InternalApiModulesEE.filter(
  (m) => m !== InstanceAdminGetOperations,
);

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
