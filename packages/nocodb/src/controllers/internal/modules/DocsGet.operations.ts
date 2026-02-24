/**
 * Internal API GET operations for Pages (Docs).
 * Handles docList (all pages in a base) and docGet (single page by ID).
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocsService } from '~/services/docs.service';

@Injectable()
export class DocsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(protected readonly docsService: DocsService) {}
  operations = ['docList' as const, 'docGet' as const];
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
      case 'docList':
        return await this.docsService.list(context, context.base_id);
      case 'docGet': {
        const docId = req.query.docId as string;
        if (!docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        return await this.docsService.get(context, docId);
      }
    }
  }
}
