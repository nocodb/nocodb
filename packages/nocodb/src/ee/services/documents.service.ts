import { Injectable, Logger } from '@nestjs/common';
import { AppEvents, EventType, PlanLimitTypes } from 'nocodb-sdk';
import { DocumentsService as DocumentsServiceCE } from 'src/services/documents.service';
import type { DocumentType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { checkLimit, getLimit } from '~/helpers/paymentHelpers';
import { Document, FileReference } from '~/models';
import Comment from '~/models/Comment';
import NocoSocket from '~/socket/NocoSocket';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { extractMentionsFromProseMirror } from '~/utils/richTextHelper';

/**
 * Service layer for Documents.
 *
 * Documents are base-scoped rich-text documents stored as ProseMirror JSON.
 * Each document belongs to exactly one base and uses optimistic concurrency
 * via a `version` counter to prevent lost writes.
 */
// Fallback when no plan-specific limit is set (5 MB)
const DEFAULT_MAX_DOC_CONTENT_SIZE = 5 * 1024 * 1024;

@Injectable()
export class DocumentsService extends DocumentsServiceCE {
  protected logger = new Logger(DocumentsService.name);

  /** Resolve the max page content size (in bytes) for the workspace's plan. */
  protected async getMaxContentSize(workspaceId: string): Promise<number> {
    const { limit } = await getLimit(
      PlanLimitTypes.LIMIT_DOCS_PAGE_SIZE_KB,
      workspaceId,
    );
    if (!isFinite(limit) || limit <= 0) return DEFAULT_MAX_DOC_CONTENT_SIZE;
    return limit * 1024;
  }

  /**
   * List documents in a base (lightweight — excludes content).
   *
   * @param parentId — `null` for root documents, doc ID for children of that doc.
   */
  async list(context: NcContext, baseId: string, parentId: string | null) {
    const docs = await Document.listLite(context, baseId, parentId);

    // Enrich with comment counts
    if (docs.length) {
      const docIds = docs.map((d) => d.id).filter(Boolean) as string[];
      const counts = await Comment.docCommentsCount(context, docIds);
      const countMap = new Map<string, number>(
        counts.map((c: any) => [c.fk_doc_id, +(c.count || 0)]),
      );
      for (const doc of docs) {
        doc.comment_count = countMap.get(doc.id!) || 0;
      }
    }

    return docs;
  }

  /** Fetch a single document with full content (ProseMirror JSON). */
  async get(context: NcContext, docId: string) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
    }

    // Enrich with comment count
    const counts = await Comment.docCommentsCount(context, [docId]);
    doc.comment_count = +(counts[0] as any)?.count || 0;

    return doc;
  }

  /** Create a new document. Defaults to an empty ProseMirror doc if no content provided. */
  async create(
    context: NcContext,
    payload: Partial<DocumentType>,
    req: NcRequest,
  ) {
    await checkLimit({
      workspaceId: context.workspace_id,
      type: PlanLimitTypes.LIMIT_DOCUMENT_PAGE_PER_WORKSPACE,
      message: ({ limit }) =>
        `You have reached the limit of ${limit} document pages for your plan.`,
    });

    payload.fk_workspace_id = context.workspace_id;
    payload.base_id = context.base_id;
    payload.created_by = req.user.id;
    payload.updated_by = req.user.id;

    payload.title = payload.title?.trim() || 'Untitled';

    // Guard against oversized documents (plan-aware)
    if (payload.content) {
      const maxSize = await this.getMaxContentSize(context.workspace_id);
      const contentSize = Buffer.byteLength(
        JSON.stringify(payload.content),
        'utf8',
      );
      if (contentSize > maxSize) {
        NcError.unprocessableEntity(
          `Document content exceeds maximum size (${maxSize >= 1024 * 1024 ? Math.round(maxSize / 1024 / 1024) + 'MB' : Math.round(maxSize / 1024) + 'KB'})`,
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

    // When content contains existing FileReference IDs (e.g. duplication),
    // create new FileReferences for the new doc so the attachment proxy
    // can validate ownership (fk_doc_id must match the new doc ID).
    if (payload.content) {
      try {
        const contentUpdated = await this.cloneFileReferences(
          context,
          doc.id!,
          doc.content,
          req,
        );

        // Also handle cover image FileReference
        let metaUpdated = false;
        if (payload.meta?.cover_image_file_ref_id) {
          metaUpdated = await this.cloneCoverImageFileReference(
            context,
            doc.id!,
            doc.meta,
            req,
          );
        }

        if (contentUpdated || metaUpdated) {
          await Document.update(context, doc.id!, {
            ...(contentUpdated ? { content: doc.content } : {}),
            ...(metaUpdated ? { meta: doc.meta } : {}),
            version: doc.version,
          });
        }
      } catch (e) {
        this.logger.error(
          `Failed to clone file references for duplicated doc ${doc.id}: ${e.message}`,
          e.stack,
        );
      }
    }

    this.appHooksService.emit(AppEvents.DOCUMENT_CREATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    // Strip content to keep broadcast payload small (sidebar only needs title/meta/order)
    const { content: _content, ...liteDoc } = doc;

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_EVENT,
        payload: { id: doc.id, action: 'create', payload: liteDoc },
      },
      context.socket_id,
    );

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
      NcError.unprocessableEntity('version is required for document updates');
    }

    if (payload.version !== existing.version) {
      NcError.unprocessableEntity(
        'Document has been modified by another user. Please reload and try again.',
      );
    }

    // Guard against oversized documents (plan-aware)
    if (payload.content) {
      const maxSize = await this.getMaxContentSize(context.workspace_id);
      const contentSize = Buffer.byteLength(
        JSON.stringify(payload.content),
        'utf8',
      );
      if (contentSize > maxSize) {
        NcError.unprocessableEntity(
          `Document content exceeds maximum size (${maxSize >= 1024 * 1024 ? Math.round(maxSize / 1024 / 1024) + 'MB' : Math.round(maxSize / 1024) + 'KB'})`,
        );
      }
    }

    payload.updated_by = req.user.id;
    payload.version = (existing.version || 1) + 1;

    if (payload.title !== undefined) {
      payload.title = payload.title?.trim() || 'Untitled';
    }

    // Reconcile FileReferences BEFORE saving — injects IDs into payload.content
    // so the persisted content contains FileReference IDs (same as attachment columns).
    if (payload.content) {
      try {
        await this.reconcileFileReferences(
          context,
          docId,
          payload.content,
          req,
          existing.meta?.cover_image_file_ref_id,
        );
      } catch (e) {
        this.logger.error(e.message, e.stack);
      }
    }

    // Reconcile cover image FileReference so the proxy can validate ownership.
    if (payload.meta) {
      try {
        await this.reconcileCoverImage(
          context,
          docId,
          payload.meta,
          existing.meta,
          req,
        );
      } catch (e) {
        this.logger.error(e.message, e.stack);
      }
    }

    const doc = await Document.update(context, docId, payload);

    this.appHooksService.emit(AppEvents.DOCUMENT_UPDATE, {
      context,
      req,
      doc,
      user: req.user,
    });

    // Detect net-new @mentions in the updated content and emit a mention event.
    // Only fires when content actually changed (payload.content is present).
    if (payload.content) {
      const oldMentions = new Set(
        extractMentionsFromProseMirror(existing.content),
      );
      const newMentions = extractMentionsFromProseMirror(
        payload.content,
      ).filter((id) => !oldMentions.has(id));
      if (newMentions.length) {
        this.appHooksService.emit(AppEvents.DOCUMENT_USER_MENTION, {
          context,
          req,
          doc,
          user: req.user,
          mentions: newMentions,
        });
      }
    }

    const { content: _content, ...liteDoc } = doc;

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_EVENT,
        payload: { id: doc.id, action: 'update', payload: liteDoc },
      },
      context.socket_id,
    );

    return doc;
  }

  /** Soft-delete a document (and cascade to descendants). */
  async delete(context: NcContext, docId: string, req: NcRequest) {
    const doc = await Document.get(context, docId);
    if (!doc) {
      NcError.get(context).genericNotFound('Document', docId);
    }

    await Document.softDelete(context, docId);

    // Cascade: soft-delete all file references for this document and its descendants
    const descendantIds = await Document.getDescendantIds(context, docId);
    await FileReference.bulkDeleteForDocs(context, [docId, ...descendantIds]);

    // Cascade: soft-delete all comments for this document
    await Comment.deleteDocComments(context, docId);

    this.appHooksService.emit(AppEvents.DOCUMENT_DELETE, {
      context,
      req,
      doc,
      user: req.user,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_EVENT,
        payload: { id: doc.id, action: 'delete', payload: doc },
      },
      context.socket_id,
    );

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
          NcError.unprocessableEntity('Target parent document not found');
        }
        if (parent.base_id !== doc.base_id) {
          NcError.unprocessableEntity(
            'Cannot move document to a different base',
          );
        }
        if (targetParentId === docId) {
          NcError.unprocessableEntity('Cannot move document under itself');
        }
        const descendantIds = await Document.getDescendantIds(context, docId);
        if (descendantIds.includes(targetParentId)) {
          NcError.unprocessableEntity(
            'Cannot move document under its own descendant',
          );
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
      // Pass version to satisfy Document.update() validation — use
      // the current version so the increment is a no-op metadata bump.
      updateFields.version = doc.version;
      updateFields.updated_by = req.user.id;
      updated = await Document.update(context, docId, updateFields);
    }

    this.appHooksService.emit(AppEvents.DOCUMENT_UPDATE, {
      context,
      req,
      doc: updated,
      user: req.user,
    });

    const { content: _content, ...liteUpdated } = updated;

    if ('parent_id' in payload) {
      // Move — include old parent ID so frontend can update both parents' has_children
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.DOCUMENT_EVENT,
          payload: {
            id: updated.id,
            action: 'move',
            payload: liteUpdated,
            oldParentId: doc.parent_id,
          },
        },
        context.socket_id,
      );
    } else {
      NocoSocket.broadcastEvent(
        context,
        {
          event: EventType.DOCUMENT_EVENT,
          payload: { id: updated.id, action: 'update', payload: liteUpdated },
        },
        context.socket_id,
      );
    }

    return updated;
  }

  /**
   * Reconcile the cover image FileReference.
   *
   * When cover_image changes, creates a new FileReference and stores its ID
   * in meta.cover_image_file_ref_id. When cover is removed, soft-deletes the
   * old FileReference. Mutates `newMeta` in-place before Document.update().
   */
  protected async reconcileCoverImage(
    context: NcContext,
    docId: string,
    newMeta: Record<string, any>,
    existingMeta: Record<string, any> | undefined,
    req: NcRequest,
  ) {
    const storageAdapter = await NcPluginMgrv2.storageAdapter();
    const oldPath = existingMeta?.cover_image;
    const oldFileRefId = existingMeta?.cover_image_file_ref_id;
    const newPath = newMeta.cover_image;

    // Cover removed — soft-delete old FileReference
    if (!newPath && oldFileRefId) {
      await FileReference.delete(context, oldFileRefId);
      delete newMeta.cover_image_file_ref_id;
      return;
    }

    // Cover changed — create new FileReference, soft-delete old one
    if (newPath && newPath !== oldPath) {
      const newId = await FileReference.insert(context, {
        storage: storageAdapter.name,
        file_url: newPath,
        file_size: 0,
        fk_user_id: req.user?.id ?? 'anonymous',
        fk_doc_id: docId,
      });
      newMeta.cover_image_file_ref_id = newId;

      if (oldFileRefId) {
        await FileReference.delete(context, oldFileRefId);
      }
    }
  }

  /**
   * Reconcile FileReferences for a doc's content.
   *
   * Same pattern as attachment columns in BaseModelSqlv2.prepareNocoData:
   * - Walk ProseMirror JSON, collect image/fileAttachment nodes
   * - Nodes with path but no id → FileReference.insert() → inject id (mutates content in-place)
   * - Diff old tracked IDs vs new content IDs → FileReference.delete() for removed ones
   *
   * Must be called BEFORE Document.update() so injected IDs are persisted.
   */
  protected async reconcileFileReferences(
    context: NcContext,
    docId: string,
    content: Record<string, any>,
    req: NcRequest,
    coverFileRefId?: string,
  ) {
    // 1. Walk content and collect all file nodes
    const fileNodes: {
      node: Record<string, any>;
      id?: string;
      path?: string;
    }[] = [];

    const walk = (node: Record<string, any>) => {
      if (
        (node.type === 'image' || node.type === 'fileAttachment') &&
        node.attrs?.path
      ) {
        fileNodes.push({
          node,
          id: node.attrs.id || undefined,
          path: node.attrs.path,
        });
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child);
      }
    };
    walk(content);

    // 2. Create FileReferences for new files (path but no id) — mutates content in-place
    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    for (const fileNode of fileNodes) {
      if (!fileNode.id && fileNode.path) {
        const newId = await FileReference.insert(context, {
          storage: storageAdapter.name,
          file_url: fileNode.path,
          file_size: fileNode.node.attrs?.fileSize || 0,
          fk_user_id: req.user?.id ?? 'anonymous',
          fk_doc_id: docId,
        });
        fileNode.node.attrs.id = newId;
        fileNode.id = newId;
      }
    }

    // 3. Diff: soft-delete FileReferences no longer in content
    // Preserve the cover image FileReference — it lives in meta, not content.
    const newIds = new Set(fileNodes.map((n) => n.id).filter(Boolean));
    const existingIds = await FileReference.listIdsForDoc(context, docId);

    const removedIds = existingIds.filter(
      (id) => !newIds.has(id) && id !== coverFileRefId,
    );
    if (removedIds.length) {
      await FileReference.delete(context, removedIds);
    }
  }

  /**
   * Clone FileReferences from duplicated content into a new document.
   *
   * Walks ProseMirror JSON, finds image/fileAttachment nodes that already
   * have an `attrs.id` (copied from the source document). For each, looks
   * up the original FileReference, creates a new one with `fk_doc_id` set
   * to the new document, and replaces `attrs.id` in-place.
   *
   * Returns `true` if any IDs were replaced (caller must persist content).
   */
  protected async cloneFileReferences(
    context: NcContext,
    newDocId: string,
    content: Record<string, any>,
    req: NcRequest,
  ): Promise<boolean> {
    const nodesToClone: { node: Record<string, any>; oldId: string }[] = [];

    const walk = (node: Record<string, any>) => {
      if (
        (node.type === 'image' || node.type === 'fileAttachment') &&
        node.attrs?.id
      ) {
        nodesToClone.push({ node, oldId: node.attrs.id });
      }
      if (Array.isArray(node.content)) {
        for (const child of node.content) walk(child);
      }
    };
    walk(content);

    if (!nodesToClone.length) return false;

    for (const { node, oldId } of nodesToClone) {
      const original = await FileReference.get(context, oldId);
      if (!original || original.deleted) continue;

      const newId = await FileReference.insert(context, {
        storage: original.storage,
        file_url: original.file_url,
        file_size: original.file_size,
        fk_user_id: req.user?.id ?? 'anonymous',
        fk_doc_id: newDocId,
        is_external: original.is_external,
      });
      node.attrs.id = newId;
    }

    return true;
  }

  /**
   * Clone the cover image FileReference for a duplicated document.
   *
   * Looks up the original FileReference from `meta.cover_image_file_ref_id`,
   * creates a new one for the new doc, and updates meta in-place.
   *
   * Returns `true` if the cover ref was cloned (caller must persist meta).
   */
  protected async cloneCoverImageFileReference(
    context: NcContext,
    newDocId: string,
    meta: Record<string, any>,
    req: NcRequest,
  ): Promise<boolean> {
    const oldRefId = meta.cover_image_file_ref_id;
    if (!oldRefId) return false;

    const original = await FileReference.get(context, oldRefId);
    if (!original || original.deleted) return false;

    const newId = await FileReference.insert(context, {
      storage: original.storage,
      file_url: original.file_url,
      file_size: original.file_size,
      fk_user_id: req.user?.id ?? 'anonymous',
      fk_doc_id: newDocId,
      is_external: original.is_external,
    });
    meta.cover_image_file_ref_id = newId;

    return true;
  }
}
