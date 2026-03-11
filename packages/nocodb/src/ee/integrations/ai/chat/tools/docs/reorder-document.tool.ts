import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const reorderDocumentTool: ChatToolDefinition = {
  name: 'reorder_document',
  description:
    'Move a document to a different position or parent in the document tree. ' +
    'Use this to reorganize the document hierarchy — move a page under a different parent, ' +
    'or reposition it among siblings.',
  parameters: {
    document_name: z
      .string()
      .describe(
        'The title of the document to move (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
    parent_document_name: z
      .string()
      .optional()
      .describe(
        'Title of the new parent document (case-insensitive). ' +
          'Omit to keep current parent, or use "root" to move to root level.',
      ),
    position: z
      .enum(['first', 'last'])
      .optional()
      .describe(
        'Where to place the document among its siblings. Defaults to "last".',
      ),
  },
  permission: 'documentReorder',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      document_name: string;
      parent_document_name?: string;
      position?: 'first' | 'last';
    },
    req: NcRequest,
  ) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);

    const payload: { order: number; parent_id?: string | null } = {
      order: 0,
    };

    // Resolve new parent
    let targetParentId: string | null | undefined;
    if (args.parent_document_name) {
      if (args.parent_document_name.toLowerCase() === 'root') {
        targetParentId = null;
      } else {
        const parent = await resolveDocumentByName(
          context,
          args.parent_document_name,
        );
        targetParentId = parent.id!;
      }
      payload.parent_id = targetParentId;
    }

    // Compute order based on position among siblings
    const parentIdForSiblings =
      targetParentId !== undefined ? targetParentId : docRef.parent_id ?? null;
    const siblings = await service.list(
      context,
      context.base_id,
      parentIdForSiblings,
    );
    // Filter out the document being moved
    const otherSiblings = siblings.filter((s: any) => s.id !== docRef.id);

    if (!otherSiblings.length || args.position !== 'first') {
      // Place at the end (default)
      const maxOrder = otherSiblings.reduce(
        (max: number, s: any) => Math.max(max, s.order || 0),
        0,
      );
      payload.order = maxOrder + 1;
    } else {
      // Place at the beginning
      const minOrder = otherSiblings.reduce(
        (min: number, s: any) => Math.min(min, s.order || 0),
        Infinity,
      );
      payload.order = minOrder > 0 ? minOrder / 2 : minOrder - 1;
    }

    await service.reorder(context, docRef.id!, payload, req);

    return {
      message: `Document "${args.document_name}" moved successfully.`,
    };
  },
};
