import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentCommentsService } from '~/services/document-comments.service';
import Noco from '~/Noco';

export const resolveDocumentCommentTool: ChatToolDefinition = {
  name: 'resolve_document_comment',
  description:
    'Toggle the resolved status of a document comment. ' +
    'If the comment is unresolved, it becomes resolved. If already resolved, it becomes unresolved. ' +
    'Use list_document_comments to find comment IDs.',
  parameters: {
    comment_id: z
      .string()
      .describe(
        'The ID of the comment to resolve/unresolve. ' +
          'Use list_document_comments to find comment IDs.',
      ),
  },
  permission: 'documentCommentResolve',
  scope: 'base',
  requiredRole: ProjectRoles.COMMENTER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { comment_id: string },
    req: NcRequest,
  ) {
    const service: DocumentCommentsService = Noco.nestApp.get(
      DocumentCommentsService,
    );

    const result = await service.commentResolve(context, {
      commentId: args.comment_id,
      user: req.user,
      req,
    });

    const isResolved = !!result.resolved_by;
    return {
      id: result.id,
      is_resolved: isResolved,
      message: `Comment ${isResolved ? 'resolved' : 'unresolved'} successfully.`,
    };
  },
};
