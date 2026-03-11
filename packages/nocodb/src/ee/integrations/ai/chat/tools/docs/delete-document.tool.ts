import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';

export const deleteDocumentTool: ChatToolDefinition = {
  name: 'delete_document',
  description:
    'Permanently delete a document (NocoDocs page) and ALL its child pages. ' +
    'This CANNOT be undone. All content, child pages, and comments will be lost.',
  parameters: {
    document_name: z
      .string()
      .describe(
        'The exact title of the document to delete (case-insensitive). ' +
          'Use list_documents to confirm the document exists before deleting.',
      ),
  },
  permission: 'documentDelete',
  scope: 'base',
  requiredRole: ProjectRoles.CREATOR,
  isDangerous: true,
  async execute(
    context: NcContext,
    args: { document_name: string },
    req: NcRequest,
  ) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);

    await service.delete(context, docRef.id!, req);

    return {
      message: `Document "${args.document_name}" has been permanently deleted.`,
    };
  },
};
