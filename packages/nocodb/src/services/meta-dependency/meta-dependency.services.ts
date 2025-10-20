import { MetaDependencyEventHandler } from '~/services/meta-dependency/event-handler.service';
import { ColumnTimezoneUpdateDependencyHandler } from '~/services/meta-dependency/handler/column/column-timezone-update.handler';

export const MetaDependencyServices = [
  MetaDependencyEventHandler,
  ColumnTimezoneUpdateDependencyHandler,
];
