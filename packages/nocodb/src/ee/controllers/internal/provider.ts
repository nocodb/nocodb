import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/utils/internal-type';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/utils/internal-type';

export const InternalApiModules = [...InternalApiModulesCE];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule<any>[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
