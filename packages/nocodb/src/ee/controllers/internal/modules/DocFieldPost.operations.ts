/**
 * Internal API POST operations for Doc field type.
 * Handles docFieldGetOrCreate and docFieldUpdate.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocFieldService } from '~/services/doc-field.service';

@Injectable()
export class DocFieldPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly docFieldService: DocFieldService) {}
  operations = [
    'docFieldGetOrCreate' as const,
    'docFieldUpdate' as const,
    'docFieldDelete' as const,
    'docFieldDuplicate' as const,
    'docFieldRestore' as const,
  ];
  httpMethod = 'POST' as const;

  async handle(
    context: NcContext,
    {
      payload,
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalPOSTResponseType {
    switch (operation) {
      case 'docFieldGetOrCreate': {
        const columnId = req.query.columnId as string;
        const rowId = req.query.rowId as string;
        if (!columnId || !rowId) {
          NcError.badRequest(
            'Missing required parameters: columnId and rowId',
          );
        }
        return await this.docFieldService.getOrCreate(
          context,
          columnId,
          rowId,
          req,
        );
      }
      case 'docFieldUpdate': {
        const docId = req.query.docId as string;
        if (!docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docFieldService.update(
          context,
          docId,
          payload,
          req,
        );
      }
      case 'docFieldDelete': {
        const columnId = req.query.columnId as string;
        const rowId = req.query.rowId as string;
        if (!columnId || !rowId) {
          NcError.badRequest(
            'Missing required parameters: columnId and rowId',
          );
        }
        return await this.docFieldService.deleteByFieldAndRow(
          context,
          columnId,
          rowId,
        );
      }
      case 'docFieldDuplicate': {
        const sourceColumnId = req.query.sourceColumnId as string;
        const sourceRowId = req.query.sourceRowId as string;
        const targetColumnId = req.query.targetColumnId as string;
        const targetRowId = req.query.targetRowId as string;
        if (!sourceColumnId || !sourceRowId || !targetColumnId || !targetRowId) {
          NcError.badRequest(
            'Missing required parameters: sourceColumnId, sourceRowId, targetColumnId, targetRowId',
          );
        }
        return await this.docFieldService.duplicate(
          context,
          { sourceColumnId, sourceRowId, targetColumnId, targetRowId },
          req,
        );
      }
      case 'docFieldRestore': {
        const docId = req.query.docId as string;
        if (!docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docFieldService.restore(context, docId);
      }
    }
  }
}
