import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import { markdownToProseMirror } from './prosemirror-utils';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const createDocumentTool: ChatToolDefinition = {
  name: 'create_document',
  description:
    'Create a new document (NocoDocs page) in the current base. ' +
    'Provide content as Markdown — it will be converted to the rich-text format automatically. ' +
    'Optionally nest under a parent document to create a sub-page.',
  parameters: {
    title: z.string().describe('The title for the new document.'),
    content: z
      .string()
      .optional()
      .describe(
        'The document content in Markdown format. If omitted, an empty document is created. ' +
          'Supports standard Markdown plus NocoDocs extensions:\n' +
          '- 2-column layout: ::: columns {ratio=50}\\n::: column\\nLeft\\n:::\\n::: column\\nRight\\n:::\\n:::\n' +
          '- Callout boxes: ::: callout note|warning|tip|important\\nContent\\n:::\n' +
          'The ratio is the left column width as a percentage (15-85, default 50).',
      ),
    parent_document_name: z
      .string()
      .optional()
      .describe(
        'Title of the parent document to nest this under (case-insensitive). ' +
          'Omit to create a root-level document.',
      ),
  },
  permission: 'documentCreate',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: { title: string; content?: string; parent_document_name?: string },
    req: NcRequest,
  ) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);

    let parentId: string | null = null;
    if (args.parent_document_name) {
      const parent = await resolveDocumentByName(
        context,
        args.parent_document_name,
      );
      parentId = parent.id!;
    }

    const pmContent = args.content
      ? markdownToProseMirror(args.content)
      : undefined;

    const doc = await service.create(
      context,
      {
        title: args.title,
        ...(pmContent && { content: pmContent }),
        ...(parentId && { parent_id: parentId }),
      },
      req,
    );

    return {
      id: doc.id,
      title: doc.title,
      message: `Document "${doc.title}" created successfully.`,
    };
  },
};
