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
import { DocumentsV3Service } from '~/services/v3/documents-v3.service';

@Injectable()
export class DocumentsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly documentsService: DocumentsService,
    protected readonly documentsV3Service: DocumentsV3Service,
  ) {}
  operations = [
    'documentCreate' as const,
    'documentUpdate' as const,
    'documentDelete' as const,
    'documentReorder' as const,
    'documentShare' as const,
    'documentUnshare' as const,
    'documentShareUpdate' as const,
    'documentCreateFileRef' as const,
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
        return await this.documentsService.reorder(
          context,
          payload.docId,
          {
            order: payload.order,
            ...('parent_id' in payload && { parent_id: payload.parent_id }),
          },
          req,
        );
      }
      case 'documentShare': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsV3Service.docShare(context, {
          docId: payload.docId,
          req,
        });
      }
      case 'documentUnshare': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsV3Service.docUnshare(context, {
          docId: payload.docId,
          req,
        });
      }
      case 'documentShareUpdate': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.documentsV3Service.docShareUpdate(
          context,
          { docId: payload.docId, req },
          {
            ...('include_subtree' in payload && {
              include_subtree: payload.include_subtree,
            }),
          },
        );
      }
      case 'documentCreateFileRef': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        if (!payload?.path) {
          NcError.badRequest('Missing required parameter: path');
        }
        return await this.documentsService.createDocFileReference(
          context,
          payload.docId,
          { path: payload.path, fileSize: payload.fileSize, req },
        );
      }
    }
  }
}
