import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import {
  markdownToProseMirror,
  prosemirrorToMarkdown,
} from './prosemirror-utils';
import { ChatToolName } from '~/integrations/ai/chat/tools/tool-names';
import { defineChatTool } from '~/integrations/ai/chat/tools/define-chat-tool';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

const MAX_RETRIES = 2;

/**
 * Apply old_str → new_str content updates on the markdown level.
 *
 * 1. Convert current PM JSON → Markdown
 * 2. Apply each old_str → new_str replacement in order
 * 3. Convert updated Markdown → PM JSON
 */
function applyContentUpdates(
  pmDoc: Record<string, any>,
  updates: { old_str: string; new_str: string }[],
): Record<string, any> {
  let markdown = prosemirrorToMarkdown(pmDoc);

  for (const update of updates) {
    const idx = markdown.indexOf(update.old_str);
    if (idx === -1) {
      const preview =
        update.old_str.length > 80
          ? update.old_str.slice(0, 80) + '...'
          : update.old_str;
      throw new Error(
        `Text not found in document: "${preview}". ` +
          'Call get_document to see the current content.',
      );
    }
    markdown =
      markdown.slice(0, idx) +
      update.new_str +
      markdown.slice(idx + update.old_str.length);
  }

  return markdownToProseMirror(markdown);
}

export const patchDocumentTool = defineChatTool({
  name: ChatToolName.PATCH_DOCUMENT,
  description:
    'Make targeted edits to a document WITHOUT replacing the entire content. ' +
    'Reads the current document, applies one or more old_str → new_str replacements on the Markdown content, and saves. ' +
    'MUST call get_document first to see the current Markdown — use the exact text for old_str.\n\n' +
    'Common patterns:\n' +
    '• Update a section: old_str = "## Heading\\nOld content", new_str = "## Heading\\nNew content"\n' +
    '• Insert after: old_str = "existing text", new_str = "existing text\\n\\nInserted content"\n' +
    '• Append to end: old_str = "<last paragraph>", new_str = "<last paragraph>\\n\\nNew section"\n' +
    '• Delete content: old_str = "text to remove", new_str = ""\n\n' +
    'Each old_str must be an exact substring of the current document Markdown. ' +
    'Updates are applied in order — later updates see the result of earlier ones.',
  schema: z.object({
    document_name: z
      .string()
      .describe(
        'The title of the document to patch (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
    content_updates: z
      .array(
        z.object({
          old_str: z
            .string()
            .describe(
              'Exact Markdown substring to find in the current document content. ' +
                'Must match exactly (whitespace-sensitive). ' +
                'Get the current content via get_document first.',
            ),
          new_str: z
            .string()
            .describe(
              'Replacement Markdown string. Use empty string to delete the matched text.',
            ),
        }),
      )
      .min(1)
      .describe(
        'One or more old_str → new_str replacements to apply in order.',
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

    if (!args.content_updates?.length) {
      NcError.get(context).badRequest(
        'At least one content update is required.',
      );
    }

    // Retry loop for version conflicts
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const current = await service.get(context, docRef.id!);
        const pmDoc = current.content || {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        };

        const updatedPm = applyContentUpdates(
          pmDoc,
          args.content_updates as { old_str: string; new_str: string }[],
        );

        const doc = await service.update(
          context,
          docRef.id!,
          { content: updatedPm, version: current.version },
          req,
        );

        return {
          id: doc.id,
          title: doc.title,
          version: doc.version,
          message: `Document "${doc.title}" patched successfully (${
            args.content_updates.length
          } update${args.content_updates.length > 1 ? 's' : ''}).`,
        };
      } catch (e: any) {
        if (
          e.message?.includes('modified by another user') &&
          attempt < MAX_RETRIES
        ) {
          lastError = e;
          continue;
        }
        throw e;
      }
    }

    throw lastError || new Error('Failed to patch document after retries.');
  },
});
