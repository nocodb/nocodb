import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const listDocumentsTool = defineChatTool({
  name: ChatToolName.LIST_DOCUMENTS,
  description:
    'List documents (NocoDocs pages) in the current base. ' +
    "Returns each document's id, title, parent_id, whether it has children, and comment count. " +
    'Pass parent_document_name to list children of a specific document, or omit for root-level documents.',
  schema: z.object({
    parent_document_name: z
      .string()
      .optional()
      .describe(
        'Title of the parent document to list children of (case-insensitive). ' +
          'Omit to list root-level documents.',
      ),
  }),
  visibility: 'hidden',
  category: 'docs',
  permission: 'documentList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(context, args, _req) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);

    let parentId: string | null = null;
    if (args.parent_document_name) {
      try {
        const parent = await resolveDocumentByName(
          context,
          args.parent_document_name,
        );
        parentId = parent.id!;
      } catch {
        // Parent not found — fall back to listing root documents
        // rather than failing. The LLM often guesses sidebar/navigation
        // labels (e.g. "Docs", "Scripts") that aren't actual document titles.
      }
    }

    const docs = await service.list(context, context.base_id, parentId);

    const result = docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      parent_id: d.parent_id || null,
      has_children: !!d.has_children,
      comment_count: d.comment_count || 0,
    }));

    if (args.parent_document_name && !parentId) {
      return {
        note: `Document "${args.parent_document_name}" not found. Showing root-level documents instead.`,
        documents: result,
      };
    }

    return result;
  },
});
