import { Injectable } from '@nestjs/common';
import {
  AppEvents,
  DocRevisionSource,
  getHighestPlan,
  PlanLimitTypes,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import type {
  DocumentRevisionV3ListResponseType,
  DocumentRevisionV3Type,
} from '~/services/v3/document-revisions-v3.types';
import type { DocumentV3Type } from '~/services/v3/documents-v3.types';
import { isOnPrem } from '~/utils';
import {
  toDocumentRevisionV3,
  toDocumentRevisionV3ListItem,
} from '~/services/v3/document-revisions-v3.types';
import { toDocumentV3 } from '~/services/v3/documents-v3.types';
import { DocumentsService } from '~/services/documents.service';
import { DocRevision } from '~/models';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { getLimit } from '~/helpers/paymentHelpers';

const DEFAULT_PAGE_SIZE = 50;

@Injectable()
export class DocumentRevisionsV3Service {
  constructor(
    protected readonly documentsService: DocumentsService,
    protected readonly appHooksService: AppHooksService,
  ) {}

  /**
   * Resolve the plan's revision retention window in days. Returns `undefined`
   * when retention is unlimited (Enterprise / on-prem licensed paid tiers
   * that don't cap), so callers can skip the cutoff filter entirely. The
   * value `0` is treated as "unlimited" as well — a 0-day window would
   * effectively disable history, which isn't a state we ship.
   */
  private async resolveRetentionDays(
    context: NcContext,
  ): Promise<number | undefined> {
    const { limit } = await getLimit(
      PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS,
      context.workspace_id,
    );
    if (!Number.isFinite(limit) || limit <= 0) return undefined;
    return limit;
  }

  /**
   * The longest retention any plan offers — the hard cutoff beyond which
   * revisions are dropped from the response entirely. Versions older than this
   * can never be unlocked by upgrading, so there's no point returning them.
   * Returns `undefined` if any plan grants unlimited retention (then nothing
   * is cut off).
   */
  private resolveMaxRetentionDays(): number | undefined {
    // Longest retention the top tier offers, for the active deployment mode
    // (cloud vs on-prem ladders differ).
    const days = Number(
      getHighestPlan(isOnPrem).meta[
        PlanLimitTypes.LIMIT_DOC_REVISION_HISTORY_DAYS
      ],
    );
    // -1 / unset on the top plan means unlimited — no hard cutoff.
    return Number.isFinite(days) && days > 0 ? days : undefined;
  }

  /**
   * List revisions for a doc, newest first. `before` is an opaque cursor
   * round-tripped from `nextCursor`. Content is not included in list items.
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

    const retentionDays = await this.resolveRetentionDays(context);

    // Hard cutoff: when the current plan caps retention, drop revisions older
    // than the longest retention ANY plan offers — no upgrade can surface them,
    // so they're not returned at all (not even as locked rows). When the
    // current plan is unlimited (retentionDays === undefined) nothing is cut.
    const maxRetentionDays =
      retentionDays !== undefined ? this.resolveMaxRetentionDays() : undefined;

    // Fetch one extra row to detect whether a next page exists. Rows between the
    // current plan's window and the cutoff come back flagged as locked so the
    // UI can render them with an upgrade nudge; content stays gated in
    // get()/restore().
    const rows = await DocRevision.list(context, param.docId, {
      limit: limit + 1,
      before: param.before,
      maxAgeDays: maxRetentionDays,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore
      ? DocRevision.encodeCursor(page[page.length - 1])
      : '';

    // Flag rows outside the plan's retention window. Uses the same cutoff
    // get()/restore() enforce, so lock state and content-access always agree.
    const cutoffMs =
      retentionDays !== undefined
        ? Date.now() - retentionDays * 86400000
        : null;
    const isLocked = (rev: DocRevision): boolean =>
      cutoffMs !== null &&
      !!rev.created_at &&
      new Date(rev.created_at).getTime() < cutoffMs;

    return {
      list: page.map((rev) => toDocumentRevisionV3ListItem(rev, isLocked(rev))),
      nextCursor,
      retentionDays: retentionDays ?? null,
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

    const retentionDays = await this.resolveRetentionDays(context);
    const rev = await DocRevision.get(context, param.revisionId, {
      retentionDays,
    });
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

    const retentionDays = await this.resolveRetentionDays(context);
    const rev = await DocRevision.get(context, param.revisionId, {
      retentionDays,
    });
    if (!rev || rev.fk_doc_id !== param.docId) {
      NcError.get(context).genericNotFound(
        'DocumentRevision',
        param.revisionId,
      );
    }

    // Edit permission is enforced inside DocumentsService.update.
    // reconcileFileReferences (inside update) revives any soft-deleted refs
    // whose IDs reappear in the new content, so restore picks up
    // automatically — no post-update fixup needed.
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

    this.appHooksService.emit(AppEvents.DOCUMENT_REVISION_RESTORE, {
      context,
      req,
      docId: param.docId,
      docTitle: updated.title || 'Untitled',
      revisionId: rev.id!,
      revisionCreatedAt: rev.created_at!,
      revisionAuthor: rev.created_by ?? null,
      revisionSource: (rev.source ?? DocRevisionSource.AUTO) as
        | 'auto'
        | 'manual'
        | 'restore',
    });

    return toDocumentV3(updated);
  }
}
