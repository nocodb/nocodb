/**
 * Internal API POST operations for Document Revisions.
 * Handles documentRevisionRestore.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentRevisionsV3Service } from '~/services/v3/document-revisions-v3.service';

@Injectable()
export class DocumentRevisionsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly documentRevisionsV3Service: DocumentRevisionsV3Service,
  ) {}
  operations = ['documentRevisionRestore' as const];
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
      case 'documentRevisionRestore': {
        if (!payload?.docId || !payload?.revisionId) {
          NcError.badRequest(
            'Missing required parameters: docId and revisionId',
          );
        }
        return await this.documentRevisionsV3Service.restore(
          context,
          { docId: payload.docId, revisionId: payload.revisionId },
          req,
        );
      }
    }
  }
}
