/**
 * Internal API GET operations for Documents.
 * Handles documentList (all documents in a base) and documentGet (single document by ID).
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentsService } from '~/services/documents.service';

@Injectable()
export class DocumentsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly documentsService: DocumentsService) {}
  operations = ['documentList' as const, 'documentGet' as const];
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
      case 'documentList':
        return await this.documentsService.list(context, context.base_id);
      case 'documentGet': {
        const docId = req.query.docId as string;
        if (!docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsService.get(context, docId);
      }
    }
  }
}
