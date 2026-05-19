import { Injectable } from '@nestjs/common';
import { DocRevisionSource } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DocumentRevisionV3ListResponseType,
  DocumentRevisionV3Type,
} from '~/services/v3/document-revisions-v3.types';
import type { DocumentV3Type } from '~/services/v3/documents-v3.types';
import {
  toDocumentRevisionV3,
  toDocumentRevisionV3ListItem,
} from '~/services/v3/document-revisions-v3.types';
import { toDocumentV3 } from '~/services/v3/documents-v3.types';
import { DocumentsService } from '~/services/documents.service';
import { DocRevision } from '~/models';
import { NcError } from '~/helpers/catchError';

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class DocumentRevisionsV3Service {
  constructor(protected readonly documentsService: DocumentsService) {}

  /**
   * List revisions for a doc, newest first. Paginated via `before` (a
   * created_at ISO cursor — returned as `next_cursor` when more pages exist).
   * Content is not included in list items.
   */
  async list(
    context: NcContext,
    param: {
      docId: string;
      limit?: number;
      before?: string;
      req?: NcRequest;
    },
  ): Promise<DocumentRevisionV3ListResponseType> {
    // Gate by document visibility — a user without access to the doc must
    // not be able to enumerate its revision history.
    await this.documentsService.assertDocVisible(
      context,
      param.docId,
      param.req,
    );

    const limit = Math.min(Math.max(param.limit ?? DEFAULT_PAGE_SIZE, 1), 200);

    // Fetch one extra row to detect whether a next page exists.
    const rows = await DocRevision.list(context, param.docId, {
      limit: limit + 1,
      before: param.before,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].created_at ?? '' : '';

    return {
      list: page.map(toDocumentRevisionV3ListItem),
      nextCursor,
    };
  }

  /** Get a single revision (with content). */
  async get(
    context: NcContext,
    param: { docId: string; revisionId: string; req?: NcRequest },
  ): Promise<DocumentRevisionV3Type> {
    // Gate by document visibility — revisions carry the full PM JSON of
    // the doc at a point in time, so leaking them would defeat the
    // visibility permission entirely.
    await this.documentsService.assertDocVisible(
      context,
      param.docId,
      param.req,
    );

    const rev = await DocRevision.get(context, param.revisionId);
    if (!rev || rev.fk_doc_id !== param.docId) {
      NcError.get(context).genericNotFound(
        'DocumentRevision',
        param.revisionId,
      );
    }

    return toDocumentRevisionV3(rev);
  }

  /**
   * Restore a revision — overwrites the doc's current content + title with
   * the revision's content + title, and records a new revision with
   * source=`restore`. Original revision row is not deleted.
   */
  async restore(
    context: NcContext,
    param: { docId: string; revisionId: string },
    req: NcRequest,
  ): Promise<DocumentV3Type> {
    // Gate by document visibility before touching the revision — keeps the
    // error consistent ("Document not found") with list/get when the user
    // cannot see the doc.
    const currentDoc = await this.documentsService.assertDocVisible(
      context,
      param.docId,
      req,
    );

    const rev = await DocRevision.get(context, param.revisionId);
    if (!rev || rev.fk_doc_id !== param.docId) {
      NcError.get(context).genericNotFound(
        'DocumentRevision',
        param.revisionId,
      );
    }

    // Edit permission is enforced inside DocumentsService.update.
    const updated = await this.documentsService.update(
      context,
      param.docId,
      {
        version: currentDoc.version!,
        content: rev.content ?? {
          type: 'doc',
          content: [{ type: 'paragraph' }],
        },
        title: rev.title || 'Untitled',
      },
      req,
      { revisionSource: DocRevisionSource.RESTORE },
    );

    return toDocumentV3(updated);
  }
}
