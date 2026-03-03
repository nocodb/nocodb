import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaEventHandler,
} from './types';
import { ColumnTimezoneUpdateDependencyHandler } from '~/services/meta-dependency/handler/column/column-timezone-update.handler';

export const MetaDependencyServices = [ColumnTimezoneUpdateDependencyHandler];

export const MetaDependencyModuleProvider = {
  provide: META_DEPENDENCY_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: MetaEventHandler[]) => internalApiModules,
  inject: MetaDependencyServices,
};
