import type { NcContext } from 'nocodb-sdk';
import Document from '~/models/Document';

interface DocumentArgs {
  title?: string;
  content?: Record<string, any>;
  meta?: Record<string, any>;
  parent_id?: string | null;
  created_by?: string;
  updated_by?: string;
}

const defaultDocumentContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const createDocument = async (
  ctx: NcContext,
  docArgs: DocumentArgs = {},
) => {
  return await Document.insert(ctx, {
    base_id: ctx.base_id,
    fk_workspace_id: ctx.workspace_id,
    title: docArgs.title ?? 'Test Document',
    content: docArgs.content ?? defaultDocumentContent,
    meta: docArgs.meta ?? {},
    parent_id: docArgs.parent_id ?? null,
    created_by: docArgs.created_by ?? 'test-user',
    updated_by: docArgs.updated_by ?? 'test-user',
  });
};

export { createDocument, defaultDocumentContent };
