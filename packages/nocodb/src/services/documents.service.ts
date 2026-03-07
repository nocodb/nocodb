import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import type { DocumentType } from 'nocodb-sdk';
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
   * List documents in a base (lightweight — excludes content).
   *
   * @param parentId — `null` for root documents, doc ID for children of that doc.
   */
  async list(context: NcContext, baseId: string, parentId: string | null) {
    return await Document.listLite(context, baseId, parentId);
  }

  /** Fetch a single document with full content (ProseMirror JSON). */
  async get(context: NcContext, docId: string) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
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
      const contentSize = Buffer.byteLength(
        JSON.stringify(payload.content),
        'utf8',
      );
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Document content exceeds maximum size (${Math.round(
            MAX_DOC_CONTENT_SIZE / 1024 / 1024,
          )}MB)`,
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
      NcError.get(context).genericNotFound('Document', docId);
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
      const contentSize = Buffer.byteLength(
        JSON.stringify(payload.content),
        'utf8',
      );
      if (contentSize > MAX_DOC_CONTENT_SIZE) {
        NcError.badRequest(
          `Document content exceeds maximum size (${Math.round(
            MAX_DOC_CONTENT_SIZE / 1024 / 1024,
          )}MB)`,
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

  /** Soft-delete a document (and cascade to descendants). */
  async delete(context: NcContext, docId: string, req: NcRequest) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
    }

    await Document.softDelete(context, docId);

    this.appHooksService.emit(AppEvents.DOCUMENT_DELETE, {
      context,
      req,
      doc,
      user: req.user,
    });

    return true;
  }

  /**
   * Update document sort order and optionally move to a different parent.
   *
   * Intentionally does NOT bump `version` — reorder is a metadata-only
   * change that shouldn't conflict with concurrent content edits. The
   * client's cached version remains valid for subsequent content saves.
   *
   * When `parent_id` is provided (even `null` for root), the document
   * is re-parented — with circular-reference validation.
   *
   * @param order - Absolute sort-order value (float). The frontend
   *   computes a midpoint between neighbours for fractional ordering.
   * @param parent_id - Optional new parent document ID (null = root).
   */
  async reorder(
    context: NcContext,
    docId: string,
    payload: { order: number; parent_id?: string | null },
    req: NcRequest,
  ) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
    }

    const updateFields: Partial<DocumentType> = { order: payload.order };

    // If parent_id is explicitly provided (even null = move to root), validate and apply
    if ('parent_id' in payload) {
      const targetParentId = payload.parent_id ?? null;

      if (targetParentId) {
        const parent = await Document.get(context, targetParentId);
        if (!parent) {
          NcError.badRequest('Target parent document not found');
        }
        if (parent.base_id !== doc.base_id) {
          NcError.badRequest('Cannot move document to a different base');
        }
        if (targetParentId === docId) {
          NcError.badRequest('Cannot move document under itself');
        }
        const descendantIds = await Document.getDescendantIds(context, docId);
        if (descendantIds.includes(targetParentId)) {
          NcError.badRequest('Cannot move document under its own descendant');
        }
      }

      updateFields.parent_id = targetParentId;
    }

    let updated: DocumentType;

    // Use Document.move() when parent changes (maintains has_children),
    // Document.update() for order-only changes.
    if ('parent_id' in payload) {
      updated = await Document.move(
        context,
        docId,
        updateFields.parent_id ?? null,
        updateFields.order,
        req.user.id,
      );
    } else {
      updated = await Document.update(context, docId, updateFields);
    }

    this.appHooksService.emit(AppEvents.DOCUMENT_UPDATE, {
      context,
      req,
      doc: updated,
      user: req.user,
    });

    return updated;
  }
}
