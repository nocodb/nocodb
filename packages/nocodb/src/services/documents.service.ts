import { Injectable } from '@nestjs/common';
import type { DocumentType } from 'nocodb-sdk';
import { AppEvents } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { Document } from '~/models';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

/**
 * Service layer for Documents.
 *
 * Documents are base-scoped rich-text documents stored as ProseMirror JSON.
 * Each document belongs to exactly one base and uses optimistic concurrency
 * via a `version` counter to prevent lost writes.
 */
// 5 MB — generous limit for ProseMirror JSON content.
// Prevents unbounded growth from extremely large documents.
const MAX_DOC_CONTENT_SIZE = 5 * 1024 * 1024;

@Injectable()
export class DocumentsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  /**
   * List all documents in a base (lightweight — excludes content).
   * Use `get()` to fetch full content for a single document.
   */
  async list(context: NcContext, baseId: string) {
    return await Document.listLite(context, baseId);
  }

  /** Fetch a single document with full content (ProseMirror JSON). */
  async get(context: NcContext, docId: string) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.notFound('Document not found');
    }
    return doc;
  }

  /** Create a new document. Defaults to an empty ProseMirror doc if no content provided. */
  async create(
    context: NcContext,
    payload: Partial<DocumentType>,
    req: NcRequest,
  ) {
    payload.fk_workspace_id = context.workspace_id;
    payload.base_id = context.base_id;
    payload.created_by = req.user.id;
    payload.updated_by = req.user.id;

    payload.title = payload.title?.trim() || 'Untitled';

    // Guard against oversized documents
    if (payload.content) {
      const contentSize = Buffer.byteLength(JSON.stringify(payload.content), 'utf8');
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Document content exceeds maximum size (${Math.round(MAX_DOC_CONTENT_SIZE / 1024 / 1024)}MB)`,
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

    const doc = await Document.insert(context, payload);

    this.appHooksService.emit(AppEvents.DOCUMENT_CREATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return doc;
  }

  /** Update a document. Requires `version` for optimistic concurrency control. */
  async update(
    context: NcContext,
    docId: string,
    payload: Partial<DocumentType>,
    req: NcRequest,
  ) {
    const existing = await Document.get(context, docId);
    if (!existing) {
      NcError.notFound('Document not found');
    }

    // Optimistic concurrency: reject stale writes.
    // Version is mandatory to prevent silent overwrites by API consumers
    // that omit it.
    if (payload.version === undefined || payload.version === null) {
      NcError.badRequest('version is required for document updates');
    }

    if (payload.version !== existing.version) {
      NcError.badRequest(
        'Document has been modified by another user. Please reload and try again.',
      );
    }

    // Guard against oversized documents
    if (payload.content) {
      const contentSize = Buffer.byteLength(JSON.stringify(payload.content), 'utf8');
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Document content exceeds maximum size (${Math.round(MAX_DOC_CONTENT_SIZE / 1024 / 1024)}MB)`,
        );
      }
    }

    payload.updated_by = req.user.id;
    payload.version = (existing.version || 1) + 1;

    if (payload.title !== undefined) {
      payload.title = payload.title?.trim() || 'Untitled';
    }

    const doc = await Document.update(context, docId, payload);

    this.appHooksService.emit(AppEvents.DOCUMENT_UPDATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return doc;
  }

  /** Permanently delete a document and remove it from cache. */
  async delete(context: NcContext, docId: string, req: NcRequest) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.notFound('Document not found');
    }

    await Document.delete(context, docId);

    this.appHooksService.emit(AppEvents.DOCUMENT_DELETE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return true;
  }

  /**
   * Update document sort order.
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
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.notFound('Document not found');
    }

    return await Document.update(context, docId, { order: payload.order });
  }
}
