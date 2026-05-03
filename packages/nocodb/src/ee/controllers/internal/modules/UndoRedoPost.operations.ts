import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { UndoRedoService } from '~/ee/services/undo-redo.service';

@Injectable()
export class UndoRedoPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(private readonly undoRedoService: UndoRedoService) {}

  operations = ['undo' as const, 'redo' as const, 'undoStatus' as const];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      operation,
      req,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'undo':
        return this.undoRedoService.undo(context, { req });

      case 'redo':
        return this.undoRedoService.redo(context, { req });

      case 'undoStatus':
        return this.undoRedoService.status(context, { req });
    }
  }
}
