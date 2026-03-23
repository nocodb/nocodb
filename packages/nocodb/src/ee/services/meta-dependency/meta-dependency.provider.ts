import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaEventHandler,
} from 'src/services/meta-dependency/types';
import { MetaDependencyServices as MetaDependencyServicesCE } from 'src/services/meta-dependency/meta-dependency.provider';
import { ColumnDeleteDateDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-date-dependency.handler';
import { ColumnUpdateDateDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-date-dependency.handler';

export const MetaDependencyServices = [
  ...MetaDependencyServicesCE,
  ColumnDeleteDateDependencyHandler,
  ColumnUpdateDateDependencyHandler,
];

export const MetaDependencyModuleProvider = {
  provide: META_DEPENDENCY_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: MetaEventHandler[]) => internalApiModules,
  inject: MetaDependencyServices,
};
