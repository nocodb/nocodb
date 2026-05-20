import { Injectable } from '@nestjs/common';
import type {
  PublicDocChildrenResponse,
  PublicDocContentResponse,
  PublicDocLiteNode,
  PublicDocMetaResponse,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { CachedShareScope } from '~/ee/models/Document';
import Document from '~/ee/models/Document';
import { Base, FileReference } from '~/models';
import { NcError } from '~/helpers/catchError';

// Anonymous reader for public-shared docs. UUID is the bearer credential
// (no password). Per-request access goes through resolveShareScope →
// scope.reachableDocIds for every doc lookup.
@Injectable()
export class PublicDocsService {
  // Re-checks root visibility on every request — defense-in-depth against a
  // race between DOCUMENT_VISIBILITY writes and cache invalidation.
  private async resolveShareScope(
    context: NcContext,
    sharedDocUuid: string,
  ): Promise<CachedShareScope> {
    const scope = await Document.getCachedShareScope(context, sharedDocUuid);
    if (!scope) {
      NcError.get(context).genericNotFound('Document', sharedDocUuid);
    }

    if (
      await Document.hasVisibilityRestriction(
        scope.root.fk_workspace_id,
        scope.root.base_id,
        scope.root.id,
      )
    ) {
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
    const scope = await this.resolveShareScope(context, param.sharedDocUuid);
    const { root, reachableDocIds } = scope;

    if (!reachableDocIds.has(param.docId)) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

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
      // Re-anchor the share root to null so the frontend tree walker treats
      // it as the visible root regardless of its DB position.
      parent_id:
        doc.id === root.id ? null : (doc.parent_id as string | null) ?? null,
      order: doc.order ?? 0,
      has_children: !!doc.has_children,
      cover_image_file_ref_id:
        (doc.meta as any)?.cover_image_file_ref_id ?? null,
      content: doc.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      updated_at: doc.updated_at,
    };
  }

  async docLiteGet(
    context: NcContext,
    param: { sharedDocUuid: string; docId: string },
  ): Promise<PublicDocLiteNode> {
    const scope = await this.resolveShareScope(context, param.sharedDocUuid);

    const node = await Document.getPublicLite(scope, param.docId);
    if (!node) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }
    return node;
  }

  async docAttachmentGet(
    context: NcContext,
    param: {
      sharedDocUuid: string;
      docId: string;
      fileRefId: string;
    },
  ): Promise<{ fileUrl: string }> {
    const { root, reachableDocIds } = await this.resolveShareScope(
      context,
      param.sharedDocUuid,
    );

    if (!reachableDocIds.has(param.docId)) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

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

  async docChildrenGet(
    context: NcContext,
    param: { sharedDocUuid: string; parentDocId: string },
  ): Promise<PublicDocChildrenResponse> {
    const { root, includeSubtree, reachableDocIds } =
      await this.resolveShareScope(context, param.sharedDocUuid);

    if (!includeSubtree) {
      NcError.get(context).genericNotFound('Document', param.parentDocId);
    }

    if (!reachableDocIds.has(param.parentDocId)) {
      NcError.get(context).genericNotFound('Document', param.parentDocId);
    }

    return await Document.getPublicChildren(
      context,
      root,
      param.parentDocId,
      reachableDocIds,
    );
  }
}
