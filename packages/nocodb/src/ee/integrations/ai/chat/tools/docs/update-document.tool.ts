import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { resolveDocumentByName } from '../helpers';
import { markdownToProseMirror } from './prosemirror-utils';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const updateDocumentTool = defineChatTool({
  name: ChatToolName.UPDATE_DOCUMENT,
  description:
    'FULL REPLACE of a document (NocoDocs page) — overwrites ALL existing content. ' +
    'Only use this for complete rewrites or title-only changes. ' +
    'For partial edits (add a section, update a paragraph, etc.), use patch_document instead — ' +
    'it preserves content you are not changing. ' +
    'The current document version is fetched automatically to prevent conflicts.',
  schema: z.object({
    document_name: z
      .string()
      .describe(
        'The title of the document to update (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
    title: z
      .string()
      .optional()
      .describe('New title for the document. Omit to keep the current title.'),
    content: z
      .string()
      .optional()
      .describe(
        'New content in Markdown format. Replaces the entire document content. ' +
          'Omit to keep the current content. ' +
          'Supports standard Markdown plus NocoDocs extensions:\n' +
          '- 2-column layout: ::: columns {ratio=50}\\n::: column\\nLeft\\n:::\\n::: column\\nRight\\n:::\\n:::\n' +
          '- Callout boxes: ::: callout note|warning|tip|important\\nContent\\n:::\n' +
          'The ratio is the left column width as a percentage (15-85, default 50).',
      ),
  }),
  visibility: 'action',
  category: 'docs',
  permission: 'documentUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(context, args, req) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);

    // Fetch current doc to get version (transparent to LLM)
    const current = await service.get(context, docRef.id!);

    const payload: Record<string, any> = {
      version: current.version,
    };
    if (args.title !== undefined) {
      payload.title = args.title;
    }
    if (args.content !== undefined) {
      payload.content = markdownToProseMirror(args.content);
    }

    const doc = await service.update(context, docRef.id!, payload, req);

    return {
      id: doc.id,
      title: doc.title,
      version: doc.version,
      message: `Document "${doc.title}" updated successfully.`,
    };
  },
});
