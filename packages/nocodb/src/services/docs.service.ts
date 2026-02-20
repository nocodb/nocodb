import { Injectable, Logger } from '@nestjs/common';
import type { DocType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Doc } from '~/models';

@Injectable()
export class DocsService {
  protected logger = new Logger(DocsService.name);

  async list(context: NcContext, baseId: string) {
    return await Doc.list(context, baseId);
  }

  async get(context: NcContext, docId: string) {
    const doc = await Doc.get(context, docId);
    if (!doc) {
      NcError.notFound('Page not found');
    }
    return doc;
  }

  async create(
    context: NcContext,
    payload: Partial<DocType>,
    req: NcRequest,
  ) {
    payload.fk_workspace_id = context.workspace_id;
    payload.base_id = context.base_id;
    payload.created_by = req.user.id;
    payload.updated_by = req.user.id;

    payload.title = payload.title?.trim() || 'Untitled';

    // Default to empty ProseMirror doc if no content provided
    if (!payload.content) {
      payload.content = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      };
    }

    return await Doc.insert(context, payload);
  }

  async update(
    context: NcContext,
    docId: string,
    payload: Partial<DocType>,
    req: NcRequest,
  ) {
    const existing = await Doc.get(context, docId);
    if (!existing) {
      NcError.notFound('Page not found');
    }

    // Optimistic concurrency: reject if version doesn't match
    if (
      payload.version !== undefined &&
      payload.version !== existing.version
    ) {
      NcError.badRequest(
        'Page has been modified by another user. Please reload and try again.',
      );
    }

    payload.updated_by = req.user.id;
    payload.version = (existing.version || 1) + 1;

    if (payload.title !== undefined) {
      payload.title = payload.title?.trim() || 'Untitled';
    }

    return await Doc.update(context, docId, payload);
  }

  async delete(context: NcContext, docId: string) {
    const doc = await Doc.get(context, docId);
    if (!doc) {
      NcError.notFound('Page not found');
    }

    const success = await Doc.delete(context, docId);
    if (!success) {
      NcError.internalServerError('Failed to delete page');
    }

    return true;
  }

  async reorder(
    context: NcContext,
    docId: string,
    payload: { order: number },
  ) {
    const doc = await Doc.get(context, docId);
    if (!doc) {
      NcError.notFound('Page not found');
    }

    return await Doc.update(context, docId, { order: payload.order });
  }
}
