/**
 * Internal API GET operations for Documents.
 * Handles documentList and documentGet.
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
      case 'documentList': {
        // parent_id is required: 'null' = root docs, string = children of that doc
        const rawParentId = req.query.parent_id as string | undefined;
        if (rawParentId === undefined) {
          NcError.badRequest('Missing required parameter: parent_id');
        }
        const parentId = rawParentId === 'null' ? null : rawParentId;
        return await this.documentsService.list(
          context,
          context.base_id,
          parentId,
        );
      }
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
