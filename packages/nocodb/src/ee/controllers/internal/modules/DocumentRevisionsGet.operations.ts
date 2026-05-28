/**
 * Internal API GET operations for Document Revisions.
 * Handles documentRevisionList and documentRevisionGet.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentRevisionsV3Service } from '~/services/v3/document-revisions-v3.service';

@Injectable()
export class DocumentRevisionsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly documentRevisionsV3Service: DocumentRevisionsV3Service,
  ) {}
  operations = [
    'documentRevisionList' as const,
    'documentRevisionGet' as const,
  ];
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
      case 'documentRevisionList': {
        const docId = req.query.docId as string;
        if (!docId) {
          NcError.badRequest('Missing required parameter: docId');
        }
        const limit = req.query.limit ? Number(req.query.limit) : undefined;
        const before = req.query.before as string | undefined;
        return await this.documentRevisionsV3Service.list(context, {
          docId,
          limit,
          before,
          req,
        });
      }
      case 'documentRevisionGet': {
        const docId = req.query.docId as string;
        const revisionId = req.query.revisionId as string;
        if (!docId || !revisionId) {
          NcError.badRequest(
            'Missing required parameters: docId and revisionId',
          );
        }
        return await this.documentRevisionsV3Service.get(context, {
          docId,
          revisionId,
          req,
        });
      }
    }
  }
}
