import { Injectable } from '@nestjs/common';
import type { DocType } from 'nocodb-sdk';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Doc } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

/**
 * Service layer for Pages (internally "Docs").
 *
 * Pages are base-scoped rich-text documents stored as ProseMirror JSON.
 * Each page belongs to exactly one base and uses optimistic concurrency
 * via a `version` counter to prevent lost writes.
 */
// 5 MB — generous limit for ProseMirror JSON content.
// Prevents unbounded growth from extremely large documents.
const MAX_DOC_CONTENT_SIZE = 5 * 1024 * 1024;

@Injectable()
export class DocsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * List all pages in a base (lightweight — excludes content).
   * Use `get()` to fetch full content for a single page.
   */
  async list(context: NcContext, baseId: string) {
    return await Doc.listLite(context, baseId);
  }

  /** Fetch a single page with full content (ProseMirror JSON). */
  async get(context: NcContext, docId: string) {
    const doc = await Doc.get(context, docId);
    if (!doc) {
      NcError.notFound('Page not found');
    }
    return doc;
  }

  /** Create a new page. Defaults to an empty ProseMirror doc if no content provided. */
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

    // Guard against oversized documents
    if (payload.content) {
      const contentSize = JSON.stringify(payload.content).length;
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Page content exceeds maximum size (${Math.round(MAX_DOC_CONTENT_SIZE / 1024 / 1024)}MB)`,
        );
      }
    }

    // Default to empty ProseMirror doc if no content provided
    if (!payload.content) {
      payload.content = {
        type: 'doc',
        content: [{ type: 'paragraph' }],
      };
    }

    const doc = await Doc.insert(context, payload);

    this.appHooksService.emit(AppEvents.DOC_CREATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return doc;
  }

  /** Update a page. Requires `version` for optimistic concurrency control. */
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

    // Optimistic concurrency: reject stale writes.
    // Version is mandatory to prevent silent overwrites by API consumers
    // that omit it.
    if (payload.version === undefined || payload.version === null) {
      NcError.badRequest('version is required for page updates');
    }

    if (payload.version !== existing.version) {
      NcError.badRequest(
        'Page has been modified by another user. Please reload and try again.',
      );
    }

    // Guard against oversized documents
    if (payload.content) {
      const contentSize = JSON.stringify(payload.content).length;
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Page content exceeds maximum size (${Math.round(MAX_DOC_CONTENT_SIZE / 1024 / 1024)}MB)`,
        );
      }
    }

    payload.updated_by = req.user.id;
    payload.version = (existing.version || 1) + 1;

    if (payload.title !== undefined) {
      payload.title = payload.title?.trim() || 'Untitled';
    }

    const doc = await Doc.update(context, docId, payload);

    this.appHooksService.emit(AppEvents.DOC_UPDATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return doc;
  }

  /** Permanently delete a page and remove it from cache. */
  async delete(context: NcContext, docId: string, req: NcRequest) {
    const doc = await Doc.get(context, docId);
    if (!doc) {
      NcError.notFound('Page not found');
    }

    await Doc.delete(context, docId);

    this.appHooksService.emit(AppEvents.DOC_DELETE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return true;
  }

  /**
   * Update page sort order.
   *
   * Intentionally does NOT bump `version` — reorder is a metadata-only
   * change that shouldn't conflict with concurrent content edits. The
   * client's cached version remains valid for subsequent content saves.
   *
   * @param order - Absolute sort-order value (float). The frontend
   *   computes a midpoint between neighbours for fractional ordering.
   */
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
