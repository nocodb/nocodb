import { Injectable } from '@nestjs/common';
import type {
  PublicDocContentResponse,
  PublicDocMetaResponse,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Document from '~/ee/models/Document';
import { Base, FileReference } from '~/models';
import { NcError } from '~/helpers/catchError';

/**
 * Public-share reader for docs. Mirrors PublicMetasService for views — two
 * endpoints, one for metadata + subtree manifest and one for per-doc content.
 *
 * No auth context is required; the UUID is the bearer credential. Access is
 * gated by:
 *   1. UUID present on the share root (Document.getByUUID)
 *   2. Optional password (Document.verifyPassword)
 *   3. Subtree visibility — descendants only reachable if the root has
 *      meta.share.include_subtree = true (Document.getPublicSubtree).
 *
 * The (root, subtree) resolution is delegated to Document.getCachedShareScope
 * so all three endpoints (/meta, /content, /attachment) share a single cached
 * lookup per UUID. See that method's docblock for the caching contract.
 */
@Injectable()
export class PublicDocsService {
  /**
   * Resolve and authenticate access to a shared doc by UUID. All three public
   * endpoints share this prelude — factor it once so the cached scope lookup
   * happens uniformly, and so endpoint code can focus on its specific
   * response shape.
   */
  private async resolveShareScope(
    context: NcContext,
    sharedDocUuid: string,
    password: string,
  ) {
    const scope = await Document.getCachedShareScope(context, sharedDocUuid);
    if (!scope) {
      NcError.get(context).genericNotFound('Document', sharedDocUuid);
    }

    if (!(await Document.verifyPassword(scope.root, password))) {
      NcError.get(context).invalidSharedViewPassword();
    }

    return scope;
  }

  async docMetaGet(
    context: NcContext,
    param: { sharedDocUuid: string; password: string },
  ): Promise<PublicDocMetaResponse> {
    const { root, tree, includeSubtree } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
      param.password,
    );

    const base = await Base.get(context, root.base_id);

    return {
      root: {
        id: root.id,
        title: root.title || 'Untitled',
        parent_id: null,
        order: root.order ?? 0,
        has_children: !!root.has_children,
      },
      tree,
      include_subtree: includeSubtree,
      base: { id: base?.id, title: base?.title },
    };
  }

  async docContentGet(
    context: NcContext,
    param: { sharedDocUuid: string; password: string; docId: string },
  ): Promise<PublicDocContentResponse> {
    const { root, tree } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
      param.password,
    );

    // The share scope is the root + (optionally) its descendants. Anything
    // outside that scope is not reachable through this UUID — even if the
    // doc has its own share UUID elsewhere.
    if (!tree.some((n) => n.id === param.docId)) {
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
      content: doc.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      updated_at: doc.updated_at,
    };
  }

  /**
   * Resolve an attachment (image / file) referenced by a public-share doc.
   * Returns the `file_url` (storage path) so the controller can stream the
   * file. UUID + password gate the access; `fileRefId` must be a
   * FileReference owned by a doc inside the share's subtree.
   */
  async docAttachmentGet(
    context: NcContext,
    param: {
      sharedDocUuid: string;
      docId: string;
      fileRefId: string;
      password: string;
    },
  ): Promise<{ fileUrl: string }> {
    const { root, tree } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
      param.password,
    );

    if (!tree.some((n) => n.id === param.docId)) {
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
}
