import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DocumentCommentsService } from '~/services/document-comments.service';
import Noco from '~/Noco';

export const listDocumentCommentsTool = defineChatTool({
  name: ChatToolName.LIST_DOCUMENT_COMMENTS,
  description:
    'List all comments on a document (NocoDocs page). ' +
    "Returns each comment's id, text, author, creation time, and resolution status.",
  schema: z.object({
    document_name: z
      .string()
      .describe(
        'The title of the document to list comments for (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
  }),
  visibility: 'hidden',
  category: 'docs',
  permission: 'documentCommentList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, _req) {
    const service: DocumentCommentsService = Noco.nestApp.get(
      DocumentCommentsService,
    );
    const docRef = await resolveDocumentByName(context, args.document_name);

    const comments = await service.commentList(context, {
      fk_doc_id: docRef.id!,
    });

    return (comments || []).map((c: any) => ({
      id: c.id,
      comment: c.comment,
      created_by_email: c.created_by_email || null,
      created_at: c.created_at,
      resolved_by_email: c.resolved_by_email || null,
      is_resolved: !!c.resolved_by,
    }));
  },
});
