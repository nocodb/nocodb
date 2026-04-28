import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaEventHandler,
} from './types';
import { ColumnTimezoneUpdateDependencyHandler } from '~/services/meta-dependency/handler/column/column-timezone-update.handler';
import { ColumnDeleteDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-dependency.handler';

export const MetaDependencyServices = [
  ColumnTimezoneUpdateDependencyHandler,
  ColumnDeleteDependencyHandler,
];

export const MetaDependencyModuleProvider = {
  provide: META_DEPENDENCY_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: MetaEventHandler[]) => internalApiModules,
  inject: MetaDependencyServices,
};
