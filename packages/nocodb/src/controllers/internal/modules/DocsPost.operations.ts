/**
 * Internal API POST operations for Pages (Docs).
 * Handles docCreate, docUpdate, docDelete, and docReorder.
 * All mutating operations expect `payload.docId` for targeting a specific page.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocsService } from '~/services/docs.service';

@Injectable()
export class DocsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(protected readonly docsService: DocsService) {}
  operations = [
    'docCreate' as const,
    'docUpdate' as const,
    'docDelete' as const,
    'docReorder' as const,
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
      case 'docCreate':
        return await this.docsService.create(context, payload, req);
      case 'docUpdate': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docsService.update(
          context,
          payload.docId,
          payload,
          req,
        );
      }
      case 'docDelete': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docsService.delete(context, payload.docId, req);
      }
      case 'docReorder': {
        if (!payload?.docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docsService.reorder(context, payload.docId, payload);
      }
    }
  }
}
