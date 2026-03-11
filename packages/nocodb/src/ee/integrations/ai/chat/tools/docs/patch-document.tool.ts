import { z } from 'zod';
import { ProjectRoles } from 'nocodb-sdk';
import { resolveDocumentByName } from '../helpers';
import {
  prosemirrorToMarkdown,
  markdownToProseMirror,
} from './prosemirror-utils';
import type { NcContext, NcRequest } from '~/interface/config';
import type { ChatToolDefinition } from '../chat-tool-registry';
import { DocumentsService } from '~/services/documents.service';
import Noco from '~/Noco';
import { NcError } from '~/helpers/catchError';

const MAX_RETRIES = 2;

// ---------------------------------------------------------------------------
// PM JSON-level operations — no lossy markdown roundtrip
// ---------------------------------------------------------------------------

/** Append new markdown content as PM nodes at the end of the document. */
function pmAppend(
  doc: Record<string, any>,
  contentMd: string,
): Record<string, any> {
  const newNodes = markdownToProseMirror(contentMd || '').content || [];
  return {
    ...doc,
    content: [...(doc.content || []), ...newNodes],
  };
}

/** Prepend new markdown content as PM nodes at the start of the document. */
function pmPrepend(
  doc: Record<string, any>,
  contentMd: string,
): Record<string, any> {
  const newNodes = markdownToProseMirror(contentMd || '').content || [];
  return {
    ...doc,
    content: [...newNodes, ...(doc.content || [])],
  };
}

/**
 * Find exact text across PM text nodes and replace it.
 * Walks the tree, finds text nodes containing the search string,
 * and replaces the first occurrence. Preserves all marks and structure.
 */
function pmFindReplace(
  doc: Record<string, any>,
  search: string,
  replace: string,
): Record<string, any> {
  let found = false;

  function walkNode(node: Record<string, any>): Record<string, any> {
    if (found) return node;

    if (node.type === 'text' && node.text?.includes(search)) {
      found = true;
      return { ...node, text: node.text.replace(search, replace) };
    }

    if (node.content) {
      return {
        ...node,
        content: node.content.map((child: any) => walkNode(child)),
      };
    }

    return node;
  }

  const result = walkNode(doc);
  if (!found) {
    throw new Error(
      `Text not found in document: "${search.slice(0, 60)}${search.length > 60 ? '...' : ''}"`,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------
// Section-level operations — use markdown roundtrip (only for targeted section)
// These are acceptable because they only affect the targeted heading's section.
// ---------------------------------------------------------------------------

/**
 * Find a heading in the PM node array and replace everything under it
 * until the next heading of the same or higher level.
 */
function pmReplaceSection(
  doc: Record<string, any>,
  headingText: string,
  contentMd: string,
): Record<string, any> {
  const nodes = doc.content || [];
  const lowerHeading = headingText.toLowerCase().trim();

  let sectionStart = -1;
  let sectionLevel = 0;
  let sectionEnd = nodes.length;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      const text = extractNodeText(node).toLowerCase().trim();

      if (sectionStart === -1) {
        if (text === lowerHeading) {
          sectionStart = i;
          sectionLevel = level;
        }
      } else if (level <= sectionLevel) {
        sectionEnd = i;
        break;
      }
    }
  }

  if (sectionStart === -1) {
    throw new Error(
      `Heading "${headingText}" not found in document. Use get_document to see the current content.`,
    );
  }

  // Convert new content markdown to PM nodes
  const newNodes = markdownToProseMirror(contentMd || '').content || [];

  // Keep the heading node, replace content after it until sectionEnd
  return {
    ...doc,
    content: [
      ...nodes.slice(0, sectionStart + 1),
      ...newNodes,
      ...nodes.slice(sectionEnd),
    ],
  };
}

/**
 * Find a heading's section and insert content after it (before the next section).
 */
function pmInsertAfterSection(
  doc: Record<string, any>,
  headingText: string,
  contentMd: string,
): Record<string, any> {
  const nodes = doc.content || [];
  const lowerHeading = headingText.toLowerCase().trim();

  let sectionStart = -1;
  let sectionLevel = 0;
  let insertAt = nodes.length;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (node.type === 'heading') {
      const level = node.attrs?.level || 1;
      const text = extractNodeText(node).toLowerCase().trim();

      if (sectionStart === -1) {
        if (text === lowerHeading) {
          sectionStart = i;
          sectionLevel = level;
        }
      } else if (level <= sectionLevel) {
        insertAt = i;
        break;
      }
    }
  }

  if (sectionStart === -1) {
    throw new Error(
      `Heading "${headingText}" not found in document. Use get_document to see the current content.`,
    );
  }

  const newNodes = markdownToProseMirror(contentMd || '').content || [];

  return {
    ...doc,
    content: [
      ...nodes.slice(0, insertAt),
      ...newNodes,
      ...nodes.slice(insertAt),
    ],
  };
}

/** Extract plain text from a PM node (recursively). */
function extractNodeText(node: Record<string, any>): string {
  if (node.type === 'text') return node.text || '';
  if (!node.content) return '';
  return node.content.map((c: any) => extractNodeText(c)).join('');
}

// ---------------------------------------------------------------------------
// Apply operation dispatcher
// ---------------------------------------------------------------------------

function applyOperation(
  doc: Record<string, any>,
  op: {
    action: string;
    content?: string;
    heading?: string;
    search?: string;
    replace?: string;
  },
): Record<string, any> {
  switch (op.action) {
    case 'append':
      return pmAppend(doc, op.content || '');

    case 'prepend':
      return pmPrepend(doc, op.content || '');

    case 'find_replace': {
      if (!op.search) {
        throw new Error(
          'find_replace requires a "search" parameter with the text to find.',
        );
      }
      return pmFindReplace(doc, op.search, op.replace ?? '');
    }

    case 'replace_section': {
      if (!op.heading) {
        throw new Error(
          'replace_section requires a "heading" parameter specifying the section heading text.',
        );
      }
      return pmReplaceSection(doc, op.heading, op.content || '');
    }

    case 'insert_after': {
      if (!op.heading) {
        throw new Error(
          'insert_after requires a "heading" parameter specifying the heading to insert after.',
        );
      }
      return pmInsertAfterSection(doc, op.heading, op.content || '');
    }

    default:
      throw new Error(
        `Unknown action "${op.action}". Valid actions: append, prepend, replace_section, insert_after, find_replace.`,
      );
  }
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const patchDocumentTool: ChatToolDefinition = {
  name: 'patch_document',
  description:
    'Make targeted edits to a document WITHOUT replacing the entire content. ' +
    'Reads the current document, applies one or more operations, and saves. ' +
    'User edits outside the targeted areas are preserved. ' +
    'Preferred over update_document for partial changes like adding a section, updating a paragraph, or inserting content.',
  parameters: {
    document_name: z
      .string()
      .describe(
        'The title of the document to patch (case-insensitive). ' +
          'Use list_documents to find available document names.',
      ),
    operations: z
      .array(
        z.object({
          action: z
            .enum([
              'append',
              'prepend',
              'replace_section',
              'insert_after',
              'find_replace',
            ])
            .describe(
              'The type of edit: ' +
                'append = add to end, ' +
                'prepend = add to beginning, ' +
                'replace_section = replace everything under a heading, ' +
                'insert_after = insert after a heading\'s section, ' +
                'find_replace = find exact text and replace it.',
            ),
          content: z
            .string()
            .optional()
            .describe(
              'The new content (Markdown) for append/prepend/replace_section/insert_after. ' +
                'Supports NocoDocs extensions (columns, callouts).',
            ),
          heading: z
            .string()
            .optional()
            .describe(
              'The heading text to target (for replace_section and insert_after). ' +
                'Case-insensitive. Must match exactly.',
            ),
          search: z
            .string()
            .optional()
            .describe(
              'The exact text to find (for find_replace). Must exist in the document.',
            ),
          replace: z
            .string()
            .optional()
            .describe(
              'The replacement text (for find_replace). Omit or empty string to delete the matched text.',
            ),
        }),
      )
      .describe('One or more edit operations to apply in order.'),
  },
  permission: 'documentUpdate',
  scope: 'base',
  requiredRole: ProjectRoles.EDITOR,
  isDangerous: false,
  async execute(
    context: NcContext,
    args: {
      document_name: string;
      operations: Array<{
        action: string;
        content?: string;
        heading?: string;
        search?: string;
        replace?: string;
      }>;
    },
    req: NcRequest,
  ) {
    const service: DocumentsService = Noco.nestApp.get(DocumentsService);
    const docRef = await resolveDocumentByName(context, args.document_name);

    if (!args.operations?.length) {
      NcError.get(context).badRequest('At least one operation is required.');
    }

    // Retry loop for version conflicts
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // 1. Fetch current PM JSON content
        const current = await service.get(context, docRef.id!);
        let pmDoc = current.content || {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        };

        // 2. Apply operations directly on PM JSON
        for (const op of args.operations) {
          pmDoc = applyOperation(pmDoc, op);
        }

        // 3. Save
        const doc = await service.update(
          context,
          docRef.id!,
          { content: pmDoc, version: current.version },
          req,
        );

        return {
          id: doc.id,
          title: doc.title,
          version: doc.version,
          message: `Document "${doc.title}" patched successfully (${args.operations.length} operation${args.operations.length > 1 ? 's' : ''}).`,
        };
      } catch (e: any) {
        // Retry on version conflict (another save happened between read and write)
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

    // All retries exhausted
    throw lastError || new Error('Failed to patch document after retries.');
  },
};
