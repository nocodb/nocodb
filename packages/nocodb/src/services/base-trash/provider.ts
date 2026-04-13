import { TRASH_HANDLER_TOKEN } from './types';
import { ViewTrashHandler } from './handlers/view.trash-handler';
import { ExtensionTrashHandler } from './handlers/extension.trash-handler';
import { FieldTrashHandler } from './handlers/field.trash-handler';
import type { TrashHandler } from './types';

export const TrashHandlers = [
  ViewTrashHandler,
  ExtensionTrashHandler,
  FieldTrashHandler,
];

export const TrashHandlerProvider = {
  provide: TRASH_HANDLER_TOKEN,
  useFactory: (...handlers: TrashHandler[]) => handlers,
  inject: TrashHandlers,
};
