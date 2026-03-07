/**
 * Internal API POST operations for Document Comments.
 * Handles documentCommentCreate, documentCommentUpdate, documentCommentDelete.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalPOSTResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentCommentsService } from '~/services/document-comments.service';

@Injectable()
export class DocumentCommentsPostOperations
  implements InternalApiModule<InternalPOSTResponseType>
{
  constructor(
    protected readonly documentCommentsService: DocumentCommentsService,
  ) {}
  operations = [
    'documentCommentCreate' as const,
    'documentCommentUpdate' as const,
    'documentCommentDelete' as const,
    'documentCommentReactionToggle' as const,
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
      case 'documentCommentCreate':
        return await this.documentCommentsService.commentCreate(context, {
          body: payload,
          user: req.user,
          req,
        });
      case 'documentCommentUpdate': {
        if (!payload?.commentId) {
          NcError.badRequest('Missing required parameter: commentId');
        }
        return await this.documentCommentsService.commentUpdate(context, {
          commentId: payload.commentId,
          user: req.user,
          body: payload,
          req,
        });
      }
      case 'documentCommentDelete': {
        if (!payload?.commentId) {
          NcError.badRequest('Missing required parameter: commentId');
        }
        return await this.documentCommentsService.commentDelete(context, {
          commentId: payload.commentId,
          user: req.user,
          req,
        });
      }
      case 'documentCommentReactionToggle': {
        if (!payload?.commentId || !payload?.reaction) {
          NcError.badRequest(
            'Missing required parameters: commentId and reaction',
          );
        }
        return await this.documentCommentsService.reactionToggle(context, {
          commentId: payload.commentId,
          reaction: payload.reaction,
          user: req.user,
        });
      }
    }
  }
}
