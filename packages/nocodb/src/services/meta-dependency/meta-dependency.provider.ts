import {
  META_DEPENDENCY_MODULE_PROVIDER_KEY,
  type MetaEventHandler,
} from './types';
import { ColumnTimezoneUpdateDependencyHandler } from '~/services/meta-dependency/handler/column/column-timezone-update.handler';
import { ColumnDeleteFilterDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-filter-dependency.handler';
import { ColumnDeleteCoverImageDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-cover-image-dependency.handler';
import { ColumnDeleteKanbanGroupByDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-kanban-groupby-dependency.handler';
import { ColumnDeleteCalendarRangeDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-calendar-range-dependency.handler';
import { ColumnDeleteHookTriggerDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-hook-trigger-dependency.handler';
import { ColumnDeleteExpandedModeDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-expanded-mode-dependency.handler';
import { ColumnDeleteRowColorDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-row-color-dependency.handler';
import { ColumnDeleteTransitiveDependentsDependencyHandler } from '~/services/meta-dependency/handler/column/column-delete-transitive-dependents-dependency.handler';
import { ColumnUpdateCoverImageDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-cover-image-dependency.handler';
import { ColumnUpdateExpandedModeDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-expanded-mode-dependency.handler';
import { ColumnUpdateRowColorDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-row-color-dependency.handler';
import { ColumnUpdateCalendarRangeDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-calendar-range-dependency.handler';
import { ColumnUpdateFilterOperatorDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-filter-operator-dependency.handler';
import { ColumnUpdateKanbanGroupByDependencyHandler } from '~/services/meta-dependency/handler/column/column-update-kanban-groupby-dependency.handler';
import { HookDeleteButtonRefDependencyHandler } from '~/services/meta-dependency/handler/hook/hook-delete-button-ref-dependency.handler';

export const MetaDependencyServices = [
  ColumnTimezoneUpdateDependencyHandler,
  ColumnDeleteFilterDependencyHandler,
  ColumnDeleteCoverImageDependencyHandler,
  ColumnDeleteKanbanGroupByDependencyHandler,
  ColumnDeleteCalendarRangeDependencyHandler,
  ColumnDeleteHookTriggerDependencyHandler,
  ColumnDeleteExpandedModeDependencyHandler,
  ColumnDeleteRowColorDependencyHandler,
  ColumnDeleteTransitiveDependentsDependencyHandler,
  ColumnUpdateCoverImageDependencyHandler,
  ColumnUpdateExpandedModeDependencyHandler,
  ColumnUpdateRowColorDependencyHandler,
  ColumnUpdateCalendarRangeDependencyHandler,
  ColumnUpdateFilterOperatorDependencyHandler,
  ColumnUpdateKanbanGroupByDependencyHandler,
  HookDeleteButtonRefDependencyHandler,
];

export const MetaDependencyModuleProvider = {
  provide: META_DEPENDENCY_MODULE_PROVIDER_KEY,
  useFactory: (...internalApiModules: MetaEventHandler[]) => internalApiModules,
  inject: MetaDependencyServices,
};
