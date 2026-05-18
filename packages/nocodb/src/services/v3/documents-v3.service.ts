import { Injectable } from '@nestjs/common';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DocumentCreateV3Type,
  DocumentReorderV3Type,
  DocumentUpdateV3Type,
  DocumentV3ListResponseType,
  DocumentV3Type,
} from '~/services/v3/documents-v3.types';
import {
  toDocumentV3,
  toDocumentV3ListItem,
} from '~/services/v3/documents-v3.types';
import { DocumentsService } from '~/services/documents.service';
import { Document } from '~/models';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';

@Injectable()
export class DocumentsV3Service {
  constructor(protected readonly documentsService: DocumentsService) {}

  async docList(
    context: NcContext,
    param: {
      baseId: string;
      parentId: string | null;
    },
  ): Promise<DocumentV3ListResponseType> {
    const docs = await this.documentsService.list(
      context,
      param.baseId,
      param.parentId,
    );
    return { list: docs.map(toDocumentV3ListItem) };
  }

  async docGet(
    context: NcContext,
    param: { docId: string },
  ): Promise<DocumentV3Type> {
    const doc = await this.documentsService.get(context, param.docId);

    if (!doc) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    return toDocumentV3(doc);
  }

  async docCreate(
    context: NcContext,
    body: DocumentCreateV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    validatePayload(
      'swagger-v3.json#/components/schemas/DocumentCreate',
      body,
      true,
      context,
    );

    const doc = await this.documentsService.create(context, body, req);

    if (!doc) {
      NcError.get(context).internalServerError('Failed to create document');
    }

    return toDocumentV3(doc);
  }

  async docUpdate(
    context: NcContext,
    param: { docId: string },
    body: DocumentUpdateV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    validatePayload(
      'swagger-v3.json#/components/schemas/DocumentUpdate',
      body,
      true,
      context,
    );

    const doc = await this.documentsService.update(
      context,
      param.docId,
      body,
      req,
    );

    if (!doc) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    return toDocumentV3(doc);
  }

  async docDelete(
    context: NcContext,
    param: { docId: string },
    req: NcRequest,
  ): Promise<boolean> {
    return await this.documentsService.delete(context, param.docId, req);
  }

  async docReorder(
    context: NcContext,
    param: { docId: string },
    body: DocumentReorderV3Type,
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    validatePayload(
      'swagger-v3.json#/components/schemas/DocumentReorder',
      body,
      true,
      context,
    );

    if (body.order == null && body.parent_id === undefined) {
      NcError.get(context).badRequest(
        'At least one of order or parent_id must be provided',
      );
    }

    // If order is not provided but parent_id is, auto-assign order
    // by appending to the end of the target parent's children
    const reorderPayload: { order: number; parent_id?: string | null } = {
      order: body.order ?? 0,
    };

    if (body.order == null && body.parent_id !== undefined) {
      const targetParentId = body.parent_id === null ? null : body.parent_id;
      const siblings = await this.documentsService.list(
        context,
        context.base_id,
        targetParentId,
      );
      const maxOrder = siblings.reduce(
        (max, s) => Math.max(max, s.order ?? 0),
        0,
      );
      reorderPayload.order = maxOrder + 1;
    }

    if ('parent_id' in body) {
      reorderPayload.parent_id = body.parent_id;
    }

    const doc = await this.documentsService.reorder(
      context,
      param.docId,
      reorderPayload,
      req,
    );

    if (!doc) {
      NcError.get(context).genericNotFound('Document', param.docId);
    }

    return toDocumentV3(doc);
  }

  // --- Public share ---

  /**
   * Enable public share for a doc. Idempotent — returns existing UUID if the
   * doc is already shared. Default share scope includes descendants (Phase 1
   * default; the toggle is exposed in updateShareSettings).
   */
  async docShare(
    context: NcContext,
    param: { docId: string },
  ): Promise<{ uuid: string; include_subtree: boolean; password: boolean }> {
    const doc = await Document.share(context, param.docId);
    // Default include_subtree=true on first share so the public URL is useful
    // out of the box. Owner can flip it off in the share modal.
    const currentMeta = (doc.meta as any) ?? {};
    if (!currentMeta.share || currentMeta.share.include_subtree === undefined) {
      await Document.updateShareSettings(context, param.docId, {
        include_subtree: true,
      });
    }
    return {
      uuid: doc.uuid!,
      include_subtree: currentMeta?.share?.include_subtree ?? true,
      password: !!doc.password,
    };
  }

  async docUnshare(
    context: NcContext,
    param: { docId: string },
  ): Promise<boolean> {
    await Document.unshare(context, param.docId);
    return true;
  }

  async docShareUpdate(
    context: NcContext,
    param: { docId: string },
    body: { password?: string | null; include_subtree?: boolean },
  ): Promise<{
    uuid: string | null;
    include_subtree: boolean;
    password: boolean;
  }> {
    const doc = await Document.updateShareSettings(context, param.docId, body);
    return {
      uuid: doc.uuid ?? null,
      include_subtree: !!(doc.meta as any)?.share?.include_subtree,
      password: !!doc.password,
    };
  }
}
