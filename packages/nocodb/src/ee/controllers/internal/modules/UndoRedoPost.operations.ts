import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import type { UndoRedoScope } from '~/services/undo-redo.service';
import { UndoRedoService } from '~/services/undo-redo.service';

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
      payload,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      req: NcRequest;
      payload: { scopes?: ReadonlyArray<UndoRedoScope> };
    },
  ): InternalPOSTResponseType {
    const scopes = payload?.scopes;
    switch (operation) {
      case 'undo':
        return this.undoRedoService.undo(context, { req, scopes });

      case 'redo':
        return this.undoRedoService.redo(context, { req, scopes });

      case 'undoStatus':
        return this.undoRedoService.status(context, { req, scopes });
    }
  }
}
