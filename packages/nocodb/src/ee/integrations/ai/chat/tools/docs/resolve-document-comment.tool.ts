import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DocumentCommentsService } from '~/services/document-comments.service';
import Noco from '~/Noco';

export const resolveDocumentCommentTool = defineChatTool({
  name: ChatToolName.RESOLVE_DOCUMENT_COMMENT,
  description:
    'Toggle the resolved status of a document comment. ' +
    'If the comment is unresolved, it becomes resolved. If already resolved, it becomes unresolved. ' +
    'Use list_document_comments to find comment IDs.',
  schema: z.object({
    comment_id: z
      .string()
      .describe(
        'The ID of the comment to resolve/unresolve. ' +
          'Use list_document_comments to find comment IDs.',
      ),
  }),
  visibility: 'action',
  category: 'docs',
  permission: 'documentCommentResolve',
  scope: 'base',
  requiredRole: ProjectRoles.COMMENTER,
  isDangerous: false,
  async execute(context, args, req) {
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
});
