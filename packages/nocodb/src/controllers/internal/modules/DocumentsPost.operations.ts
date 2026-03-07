/**
 * Internal API POST operations for Documents.
 * Handles documentCreate, documentUpdate, documentDelete, and documentReorder.
 * All mutating operations expect `payload.docId` for targeting a specific document.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentsService } from '~/services/documents.service';

@Injectable()
export class DocumentsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly documentsService: DocumentsService) {}
  operations = [
    'documentCreate' as const,
    'documentUpdate' as const,
    'documentDelete' as const,
    'documentReorder' as const,
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
      case 'documentCreate':
        return await this.documentsService.create(context, payload, req);
      case 'documentUpdate': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsService.update(
          context,
          payload.docId,
          payload,
          req,
        );
      }
      case 'documentDelete': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsService.delete(context, payload.docId, req);
      }
      case 'documentReorder': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsService.reorder(context, payload.docId, payload);
      }
    }
  }
}
