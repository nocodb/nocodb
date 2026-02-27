/**
 * EE Internal API POST operations for Document Comments.
 * Adds documentCommentResolve.
 */
import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentCommentsService } from '~/services/document-comments.service';

@Injectable()
export class DocumentCommentsEePostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly documentCommentsService: DocumentCommentsService,
  ) {}
  operations = ['documentCommentResolve' as const];
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
      case 'documentCommentResolve': {
        if (!payload?.commentId) {
          NcError.badRequest('Missing required parameter: commentId');
        }
        // The EE service has commentResolve method
        return await (
          this.documentCommentsService as any
        ).commentResolve(context, {
          commentId: payload.commentId,
          user: req.user,
          req,
        });
      }
    }
  }
}
