import type { NcContext } from 'nocodb-sdk';
import Doc from '~/models/Doc';

interface DocArgs {
  title?: string;
  content?: Record<string, any>;
  meta?: Record<string, any>;
  parent_id?: string | null;
  created_by?: string;
  updated_by?: string;
}

const defaultDocContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const createDoc = async (
  ctx: NcContext,
  docArgs: DocArgs = {},
) => {
  return await Doc.insert(ctx, {
    base_id: ctx.base_id,
    fk_workspace_id: ctx.workspace_id,
    title: docArgs.title ?? 'Test Doc',
    content: docArgs.content ?? defaultDocContent,
    meta: docArgs.meta ?? {},
    parent_id: docArgs.parent_id ?? null,
    created_by: docArgs.created_by ?? 'test-user',
    updated_by: docArgs.updated_by ?? 'test-user',
  });
};

export { createDoc, defaultDocContent };
