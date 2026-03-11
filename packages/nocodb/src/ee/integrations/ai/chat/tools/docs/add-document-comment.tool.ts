import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentCommentsService } from '~/services/document-comments.service';
import Noco from '~/Noco';

export const addDocumentCommentTool: ChatToolDefinition = {
  name: 'add_document_comment',
  description:
    'Add a comment to a document (NocoDocs page). ' +
    'Use this to leave feedback, notes, or discussion points on a document.',
  parameters: {
    document_name: z
      .string()
      .describe(
        'The title of the document to comment on (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
    comment: z.string().describe('The comment text to add.'),
  },
  permission: 'documentCommentCreate',
  scope: 'base',
  requiredRole: ProjectRoles.COMMENTER,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { document_name: string; comment: string },
    req: NcRequest,
  ) {
    const service: DocumentCommentsService = Noco.nestApp.get(
      DocumentCommentsService,
    );
    const docRef = await resolveDocumentByName(context, args.document_name);

    const result = await service.commentCreate(context, {
      body: {
        fk_doc_id: docRef.id!,
        comment: args.comment,
      },
      user: req.user,
      req,
    });

    return {
      id: result.id,
      message: `Comment added to document "${args.document_name}" successfully.`,
    };
  },
};
