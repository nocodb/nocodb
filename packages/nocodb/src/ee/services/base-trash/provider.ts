import type { TrashHandler } from '~/services/base-trash/types';
import { TRASH_HANDLER_TOKEN } from '~/services/base-trash/types';
import { ViewTrashHandler } from '~/services/base-trash/handlers/view.trash-handler';
import { ExtensionTrashHandler } from '~/services/base-trash/handlers/extension.trash-handler';
import { FieldTrashHandler } from '~/services/base-trash/handlers/field.trash-handler';
import { TableTrashHandler } from '~/services/base-trash/handlers/table.trash-handler';
import { DashboardTrashHandler } from '~/services/base-trash/handlers/dashboard.trash-handler';
import { WidgetTrashHandler } from '~/services/base-trash/handlers/widget.trash-handler';
import { WorkflowTrashHandler } from '~/services/base-trash/handlers/workflow.trash-handler';
import { ScriptTrashHandler } from '~/services/base-trash/handlers/script.trash-handler';

export const TrashHandlers = [
  ViewTrashHandler,
  ExtensionTrashHandler,
  FieldTrashHandler,
  TableTrashHandler,
  DashboardTrashHandler,
  WidgetTrashHandler,
  WorkflowTrashHandler,
  ScriptTrashHandler,
];

export const TrashHandlerProvider = {
  provide: TRASH_HANDLER_TOKEN,
  useFactory: (...handlers: TrashHandler[]) => handlers,
  inject: TrashHandlers,
};
