/**
 * Internal API GET operations for Document Comments.
 * Handles documentCommentList and documentCommentCount.
 */
import { Injectable } from '@nestjs/common';
import type { OPERATION_SCOPES } from '~/controllers/internal/operationScopes';
import type { NcContext, NcRequest } from 'nocodb-sdk';
import type {
  InternalApiModule,
  InternalGETResponseType,
} from '~/utils/internal-type';
import { NcError } from '~/helpers/catchError';
import { DocumentCommentsService } from '~/services/document-comments.service';

@Injectable()
export class DocumentCommentsGetOperations
  implements InternalApiModule<InternalGETResponseType>
{
  constructor(
    protected readonly documentCommentsService: DocumentCommentsService,
  ) {}
  operations = [
    'documentCommentList' as const,
    'documentCommentCount' as const,
    'documentCommentReactionList' as const,
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
      case 'documentCommentList': {
        const fk_doc_id = req.query.fk_doc_id as string;
        if (!fk_doc_id) {
          NcError.badRequest('Missing required parameter: fk_doc_id');
        }
        const list = await this.documentCommentsService.commentList(context, {
          fk_doc_id,
        });
        return { list };
      }
      case 'documentCommentCount': {
        const docIdsParam = req.query.docIds as string;
        if (!docIdsParam) {
          NcError.badRequest('Missing required parameter: docIds');
        }
        const docIds = docIdsParam.split(',').filter(Boolean);
        return await this.documentCommentsService.commentCount(context, {
          docIds,
        });
      }
      case 'documentCommentReactionList': {
        const commentIdsParam = req.query.commentIds as string;
        if (!commentIdsParam) {
          NcError.badRequest('Missing required parameter: commentIds');
        }
        const commentIds = commentIdsParam.split(',').filter(Boolean);
        return await this.documentCommentsService.reactionList(context, {
          commentIds,
        });
      }
    }
  }
}
