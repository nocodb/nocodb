import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { resolveDocumentByName } from '../helpers';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const listDocumentsTool: ChatToolDefinition = {
  name: 'list_documents',
  description:
    'List documents (NocoDocs pages) in the current base. ' +
    'Returns each document\'s id, title, parent_id, whether it has children, and comment count. ' +
    'Pass parent_document_name to list children of a specific document, or omit for root-level documents.',
  parameters: {
    parent_document_name: z
      .string()
      .optional()
      .describe(
        'Title of the parent document to list children of (case-insensitive). ' +
          'Omit to list root-level documents.',
      ),
  },
  permission: 'documentList',
  scope: 'base',
  requiredRole: ProjectRoles.VIEWER,
  isDangerous: false,
  readonly: true,
  async execute(
    context: NcContext,
    args: { parent_document_name?: string },
    _req: NcRequest,
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

    const docs = await service.list(context, context.base_id, parentId);

    return docs.map((d: any) => ({
      id: d.id,
      title: d.title,
      parent_id: d.parent_id || null,
      has_children: !!d.has_children,
      comment_count: d.comment_count || 0,
    }));
  },
};
