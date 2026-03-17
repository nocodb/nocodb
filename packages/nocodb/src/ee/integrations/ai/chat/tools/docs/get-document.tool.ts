import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDocumentByName } from '../helpers';
import { prosemirrorToMarkdown } from './prosemirror-utils';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const getDocumentTool = defineChatTool({
  name: ChatToolName.GET_DOCUMENT,
  description:
    'Get a document (NocoDocs page) with its full content converted to Markdown. ' +
    'Returns the document metadata and content. Use list_documents first to find document names.',
  schema: z.object({
    document_name: z
      .string()
      .describe(
        'The title of the document to retrieve (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
  }),
  visibility: 'data',
  category: 'docs',
  permission: 'documentGet',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, _req) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);
    const doc = await service.get(context, docRef.id!);

    const contentMarkdown = doc.content
      ? prosemirrorToMarkdown(doc.content)
      : '';

    return {
      id: doc.id,
      title: doc.title,
      content_markdown: contentMarkdown,
      version: doc.version,
      parent_id: doc.parent_id || null,
      has_children: !!doc.has_children,
      comment_count: doc.comment_count || 0,
    };
  },
});
