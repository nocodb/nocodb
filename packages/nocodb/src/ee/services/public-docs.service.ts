import { Injectable } from '@nestjs/common';
import type {
  PublicDocContentResponse,
  PublicDocMetaResponse,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Document from '~/ee/models/Document';
import { Base } from '~/models';
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
 */
@Injectable()
export class PublicDocsService {
  async docMetaGet(
    context: NcContext,
    param: { sharedDocUuid: string; password: string },
  ): Promise<PublicDocMetaResponse> {
    const root = await Document.getByUUID(context, param.sharedDocUuid);
    if (!root) {
      NcError.get(context).genericNotFound('Document', param.sharedDocUuid);
    }

    if (!(await Document.verifyPassword(root, param.password))) {
      NcError.get(context).invalidSharedViewPassword();
    }

    const tree = await Document.getPublicSubtree(context, root);
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
      include_subtree: !!(root.meta as any)?.share?.include_subtree,
      base: { id: base?.id, title: base?.title },
    };
  }

  async docContentGet(
    context: NcContext,
    param: { sharedDocUuid: string; password: string; docId: string },
  ): Promise<PublicDocContentResponse> {
    const root = await Document.getByUUID(context, param.sharedDocUuid);
    if (!root) {
      NcError.get(context).genericNotFound('Document', param.sharedDocUuid);
    }

    if (!(await Document.verifyPassword(root, param.password))) {
      NcError.get(context).invalidSharedViewPassword();
    }

    // The share scope is the root + (optionally) its descendants. Anything
    // outside that scope is not reachable through this UUID — even if the
    // doc has its own share UUID elsewhere.
    const scope = await Document.getPublicSubtree(context, root);
    const inScope = scope.some((n) => n.id === param.docId);
    if (!inScope) {
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

    const doc =
      param.docId === root.id
        ? await Document.get(baseScopedCtx, root.id)
        : await Document.get(baseScopedCtx, param.docId);

    if (!doc) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    return {
      id: doc.id,
      title: doc.title || 'Untitled',
      content: doc.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      updated_at: doc.updated_at,
    };
  }
}
