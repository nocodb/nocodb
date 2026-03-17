import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDocumentByName } from '../helpers';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const deleteDocumentTool = defineChatTool({
  name: ChatToolName.DELETE_DOCUMENT,
  description:
    'Permanently delete a document (NocoDocs page) and ALL its child pages. ' +
    'This CANNOT be undone. All content, child pages, and comments will be lost.',
  schema: z.object({
    document_name: z
      .string()
      .describe(
        'The exact title of the document to delete (case-insensitive). ' +
          'Use list_documents to confirm the document exists before deleting.',
      ),
  }),
  visibility: 'action',
  category: 'docs',
  permission: 'documentDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(context, args, req) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);

    await service.delete(context, docRef.id!, req);

    return {
      message: `Document "${args.document_name}" has been permanently deleted.`,
    };
  },
});
