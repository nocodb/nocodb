import { Injectable } from '@nestjs/common';
import type {
  PublicDocChildrenResponse,
  PublicDocContentResponse,
  PublicDocMetaResponse,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Document from '~/ee/models/Document';
import { Base, FileReference } from '~/models';
import { NcError } from '~/helpers/catchError';

/**
 * Public-share reader for docs. Mirrors PublicMetasService for views — one
 * endpoint for the initial manifest, one for per-doc content, one for
 * lazy-loaded children when the user expands a node, and one for
 * attachments.
 *
 * No auth context is required; the UUID is the bearer credential. Docs do
 * not support password protection. Access is gated by:
 *   1. UUID present on the share root (Document.getByUUID)
 *   2. Subtree visibility — descendants only reachable if the share root has
 *      `meta.share.include_subtree = true`.
 *   3. Per-doc scope check — every /content, /attachment, and /children
 *      request validates that the requested docId is reachable through the
 *      share root via `Document.isInPublicScope` (parent-chain walk). The
 *      initial manifest is intentionally root + direct children only; a
 *      large doc tree never gets enumerated in one response.
 *
 * The (root, initial-tree) pair is cached via Document.getCachedShareScope.
 * Per-request scope checks hit the DB fresh so newly-added descendants
 * become reachable without waiting for the cache to bust.
 */
@Injectable()
export class PublicDocsService {
  /**
   * Resolve access to a shared doc by UUID. All three public endpoints share
   * this prelude — factor it once so the cached scope lookup happens
   * uniformly, and so endpoint code can focus on its specific response shape.
   */
  private async resolveShareScope(context: NcContext, sharedDocUuid: string) {
    const scope = await Document.getCachedShareScope(context, sharedDocUuid);
    if (!scope) {
      NcError.get(context).genericNotFound('Document', sharedDocUuid);
    }
    return scope;
  }

  async docMetaGet(
    context: NcContext,
    param: { sharedDocUuid: string },
  ): Promise<PublicDocMetaResponse> {
    const { root, tree, includeSubtree } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
    );

    const base = await Base.get(context, root.base_id);

    return {
      root: {
        id: root.id,
        title: root.title || 'Untitled',
        parent_id: null,
        order: root.order ?? 0,
        has_children: !!root.has_children,
        icon: (root.meta as any)?.icon ?? null,
      },
      tree,
      include_subtree: includeSubtree,
      base: { id: base?.id, title: base?.title },
    };
  }

  async docContentGet(
    context: NcContext,
    param: { sharedDocUuid: string; docId: string },
  ): Promise<PublicDocContentResponse> {
    const { root } = await this.resolveShareScope(context, param.sharedDocUuid);

    // The share scope is the root + (optionally) its descendants. Anything
    // outside that scope is not reachable through this UUID — even if the
    // doc has its own share UUID elsewhere. The cached initial tree only
    // covers root + direct children, so deeper docs go through a
    // parent-chain walk to verify scope.
    if (!(await Document.isInPublicScope(context, root, param.docId))) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    // Fetch the doc — we need title + updated_at metadata in addition to the
    // content blob. Use ncContext that points at the doc's home base; for
    // public access we use the root's base context, which is the same base
    // (docs share scope is always single-base).
    const baseScopedCtx = {
      ...context,
      workspace_id: root.fk_workspace_id,
      base_id: root.base_id,
    };

    const doc = await Document.get(baseScopedCtx, param.docId);

    if (!doc) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    return {
      id: doc.id,
      title: doc.title || 'Untitled',
      icon: (doc.meta as any)?.icon ?? null,
      // Sidebar-shape fields, mirroring what documentGet returns in-app — the
      // public reader walks the parent chain via this endpoint (same pattern
      // as useDocumentsStore.expandToDocument), so it needs parent_id /
      // has_children / order to render ancestors at the right spot in the
      // tree. The share root is re-anchored to parent_id=null to match the
      // initial manifest, so the frontend tree walker treats it as the
      // visible root regardless of its DB position.
      parent_id:
        doc.id === root.id ? null : (doc.parent_id as string | null) ?? null,
      order: doc.order ?? 0,
      has_children: !!doc.has_children,
      // The cover image is stored on the doc as a FileReference id; the
      // reader rebuilds the URL through the public attachment proxy, same
      // path as inline images. The proxy validates fk_doc_id, so a cover
      // ref leaked into the wrong doc still 404s.
      cover_image_file_ref_id:
        (doc.meta as any)?.cover_image_file_ref_id ?? null,
      content: doc.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      updated_at: doc.updated_at,
    };
  }

  /**
   * Resolve an attachment (image / file) referenced by a public-share doc.
   * Returns the `file_url` (storage path) so the controller can stream the
   * file. UUID gates the access; `fileRefId` must be a FileReference owned
   * by a doc inside the share's subtree.
   */
  async docAttachmentGet(
    context: NcContext,
    param: {
      sharedDocUuid: string;
      docId: string;
      fileRefId: string;
    },
  ): Promise<{ fileUrl: string }> {
    const { root } = await this.resolveShareScope(context, param.sharedDocUuid);

    if (!(await Document.isInPublicScope(context, root, param.docId))) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    // FileReference reads are workspace+base scoped. The middleware doesn't
    // build a base-scoped context for public docs, so derive it from the
    // resolved root.
    const baseScopedCtx = {
      ...context,
      workspace_id: root.fk_workspace_id,
      base_id: root.base_id,
    };

    const fileRef = await FileReference.get(baseScopedCtx, param.fileRefId);
    if (!fileRef || fileRef.deleted || fileRef.fk_doc_id !== param.docId) {
      NcError.get(context).genericNotFound('Attachment', param.fileRefId);
    }

    return { fileUrl: fileRef.file_url };
  }

  /**
   * Direct children of a doc inside the share, fetched lazily when the
   * reader expands a node in the sidebar. Mirrors the in-app
   * `documentList(parent_id=docId)` pattern — one level at a time.
   *
   * Requires `include_subtree=true` on the share (otherwise the share is
   * just the root and has no expandable children), and validates that
   * `parentDocId` is reachable through the share root before listing — so
   * the UUID can't be used to enumerate docs outside its subtree.
   */
  async docChildrenGet(
    context: NcContext,
    param: { sharedDocUuid: string; parentDocId: string },
  ): Promise<PublicDocChildrenResponse> {
    const { root, includeSubtree } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
    );

    if (!includeSubtree) {
      NcError.get(context).genericNotFound('Document', param.parentDocId);
    }

    if (!(await Document.isInPublicScope(context, root, param.parentDocId))) {
      NcError.get(context).genericNotFound('Document', param.parentDocId);
    }

    return await Document.getPublicChildren(context, root, param.parentDocId);
  }
}
