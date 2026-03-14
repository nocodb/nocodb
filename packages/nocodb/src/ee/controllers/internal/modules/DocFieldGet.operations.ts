/**
 * Internal API GET operations for Doc field type.
 * Handles docFieldGet — fetches a document linked to a specific field + row.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocFieldService } from '~/services/doc-field.service';

@Injectable()
export class DocFieldGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly docFieldService: DocFieldService) {}
  operations = ['docFieldGet' as const];
  httpMethod = 'GET' as const;

  async handle(
    context: NcContext,
    {
      req,
      operation,
    }: {
      workspaceId: string;
      baseId: string;
      operation: keyof typeof OPERATION_SCOPES;
      payload: any;
      req: NcRequest;
    },
  ): InternalGETResponseType {
    switch (operation) {
      case 'docFieldGet': {
        const columnId = req.query.columnId as string;
        const rowId = req.query.rowId as string;
        if (!columnId || !rowId) {
          NcError.badRequest(
            'Missing required parameters: columnId and rowId',
          );
        }
        return await this.docFieldService.get(context, columnId, rowId);
      }
    }
  }
}
