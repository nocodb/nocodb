import { InternalApiModules as InternalApiModulesCE } from 'src/controllers/internal/provider';
import type { InternalApiModule } from '~/controllers/internal/types';
import { INTERNAL_API_MODULE_PROVIDER_KEY } from '~/controllers/internal/types';

export const InternalApiModules = [...InternalApiModulesCE];

export const InternalApiModuleProvider = {
  provide: INTERNAL_API_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: InternalApiModule[]) =>
    internalApiModules,
  inject: InternalApiModules,
};
