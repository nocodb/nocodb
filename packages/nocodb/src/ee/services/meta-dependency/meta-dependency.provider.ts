import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaEventHandler,
} from 'src/services/meta-dependency/types';
import { MetaDependencyServices as MetaDependencyServicesCE } from 'src/services/meta-dependency/meta-dependency.provider';
import { ColumnAddTableSyncHandler } from '~/services/meta-dependency/handler/column/column-add-table-sync.handler';
import { ColumnChangeTableSyncHandler } from '~/services/meta-dependency/handler/column/column-change-table-sync.handler';
import { ColumnDeleteDateDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-date-dependency.handler';
import { ColumnUpdateDateDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-date-dependency.handler';
import { FilterChangeTableSyncHandler } from '~/services/meta-dependency/handler/filter/filter-change-table-sync.handler';
import { TableDeleteTableSyncHandler } from '~/services/meta-dependency/handler/table/table-delete-table-sync.handler';
import { ViewChangeTableSyncHandler } from '~/services/meta-dependency/handler/view/view-change-table-sync.handler';

export const MetaDependencyServices = [
  ...MetaDependencyServicesCE,
  ColumnAddTableSyncHandler,
  ColumnChangeTableSyncHandler,
  ColumnDeleteDateDependencyHandler,
  ColumnUpdateDateDependencyHandler,
  FilterChangeTableSyncHandler,
  TableDeleteTableSyncHandler,
  ViewChangeTableSyncHandler,
];

export const MetaDependencyModuleProvider = {
  provide: META_DEPENDENCY_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: MetaEventHandler[]) => internalApiModules,
  inject: MetaDependencyServices,
};
