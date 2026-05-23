import { v7 as uuidv7 } from 'uuid';
import { DocRevisionSource } from 'nocodb-sdk';
import type { DocumentRevisionType, NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';
import FileReference from '~/models/FileReference';
import { extractFileReferenceIds } from '~/utils/richTextHelper';

/**
 * Default inactivity window. The window slides: each save within this many ms
 * of the previous one (by the same author + tab) extends the same revision
 * row. A gap longer than the window starts a fresh row.
 */
const DEFAULT_COALESCE_WINDOW_MS = 2 * 60 * 1000;

function getCoalesceWindowMs(): number {
  const raw = process.env.NC_DOC_REVISION_COALESCE_WINDOW_MS;
  if (!raw) return DEFAULT_COALESCE_WINDOW_MS;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_COALESCE_WINDOW_MS;
}

function decodeCursor(
  cursor?: string,
): { created_at: string; id: string } | null {
  if (!cursor) return null;
  const sep = cursor.indexOf('|');
  // Treat malformed cursors as "first page" rather than erroring.
  if (sep <= 0 || sep === cursor.length - 1) return null;
  return {
    created_at: cursor.slice(0, sep),
    id: cursor.slice(sep + 1),
  };
}

export default class DocRevision implements DocumentRevisionType {
  id?: string;
  fk_doc_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  version?: number;
  content?: Record<string, any>;
  title?: string;
  created_by?: string;
  fk_tab_id?: string;
  source?: DocRevisionSource;
  created_at?: string;
  updated_at?: string;

  constructor(rev: Partial<DocumentRevisionType>) {
    Object.assign(this, rev);
  }

  /**
   * Record a revision for a document save. Returns the row id.
   *
   * Coalescing: when the latest revision is by the same user + tab and the
   * gap since its last save is shorter than the inactivity window, the prior
   * row's content/title/version are updated in place. `created_at` is
   * preserved (session start); `updated_at` advances. Otherwise a new row is
   * inserted.
   *
   * The caller decides whether content actually changed — `record` always
   * writes.
   */
  static async record(
    context: NcContext,
    params: {
      docId: string;
      version: number;
      content: any;
      title: string;
      createdBy: string;
      source?: DocRevisionSource;
    },
  ): Promise<string> {
    const {
      docId,
      version,
      content,
      title,
      createdBy,
      source = DocRevisionSource.AUTO,
    } = params;

    const latest = await this.latestForDoc(context, docId);

    const coalesceWindowMs = getCoalesceWindowMs();
    // Sliding window — measured from latest.updated_at so an active editor's
    // run-on session stays in one row until they go idle.
    // Normalize null vs undefined — DB stores missing tab_id as NULL but the
    // incoming context may have it as undefined; we want them to match.
    const canCoalesce =
      latest &&
      latest.created_by === createdBy &&
      (latest.fk_tab_id ?? null) === (context.tab_id ?? null) &&
      latest.source === DocRevisionSource.AUTO &&
      source === DocRevisionSource.AUTO &&
      coalesceWindowMs > 0 &&
      Date.now() - new Date(latest.updated_at!).getTime() < coalesceWindowMs;

    if (canCoalesce) {
      await Noco.ncDocsContent.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_REVISIONS,
        prepareForDb({ version, title, content }, ['content']),
        { id: latest.id },
      );
      await FileReference.syncSnapshotForRevision(context, {
        docId,
        revisionId: latest.id!,
        attachmentIds: extractFileReferenceIds(content),
        fkUserId: createdBy,
      });
      return latest.id!;
    }

    const insertObj: Record<string, any> = {
      id: uuidv7(),
      fk_doc_id: docId,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
      version,
      content,
      title,
      created_by: createdBy,
      fk_tab_id: context.tab_id,
      source,
    };

    await Noco.ncDocsContent.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      prepareForDb(insertObj, ['content']),
      true, // ignoreIdGeneration — id is pre-generated above
    );

    await FileReference.syncSnapshotForRevision(context, {
      docId,
      revisionId: insertObj.id,
      attachmentIds: extractFileReferenceIds(content),
      fkUserId: createdBy,
    });

    return insertObj.id;
  }

  /**
   * Most recent revision for the doc (no content payload — used by coalesce
   * check). Returns null if no revisions exist yet.
   */
  static async latestForDoc(
    context: NcContext,
    docId: string,
  ): Promise<DocRevision | null> {
    const rows = await Noco.ncDocsContent.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      {
        condition: { fk_doc_id: docId },
        orderBy: { created_at: 'desc' },
        limit: 1,
        fields: [
          'id',
          'fk_doc_id',
          'version',
          'title',
          'created_by',
          'fk_tab_id',
          'source',
          'created_at',
          'updated_at',
        ],
      },
    );
    return rows[0] ? new DocRevision(rows[0]) : null;
  }

  /**
   * List revisions for a doc, newest first. Keyset paginated by
   * `(created_at, id)` — `id` is a stable tiebreaker for same-second writes.
   * Content is not included; use `get()` for the full payload.
   */
  static async list(
    context: NcContext,
    docId: string,
    options: {
      limit?: number;
      before?: string;
      /**
       * Per-plan retention window. Revisions older than `now - retentionDays`
       * are hidden from the result; set to `undefined` (or omit) for no
       * filter. The pruning job uses the same window to hard-delete.
       */
      retentionDays?: number;
    } = {},
  ): Promise<DocRevision[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const query = Noco.ncDocsContent
      .knex(MetaTable.DOC_REVISIONS)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .where('fk_doc_id', docId)
      .orderBy([
        { column: 'created_at', order: 'desc' },
        { column: 'id', order: 'desc' },
      ])
      .limit(limit)
      .select(
        'id',
        'fk_doc_id',
        'version',
        'title',
        'created_by',
        'fk_tab_id',
        'source',
        'created_at',
        'updated_at',
      );

    if (
      options.retentionDays !== undefined &&
      Number.isFinite(options.retentionDays) &&
      options.retentionDays > 0
    ) {
      const cutoff = new Date(
        Date.now() - options.retentionDays * 86400000,
      ).toISOString();
      query.where('created_at', '>=', cutoff);
    }

    const cursor = decodeCursor(options.before);
    if (cursor) {
      query.whereRaw('(??, ??) < (?, ?)', [
        'created_at',
        'id',
        cursor.created_at,
        cursor.id,
      ]);
    }

    const rows = await query;
    return rows.map((r) => new DocRevision(r));
  }

  /** Encode an opaque keyset cursor (`<created_at>|<id>`). */
  static encodeCursor(row: { created_at?: string; id?: string }): string {
    if (!row?.created_at || !row?.id) return '';
    return `${row.created_at}|${row.id}`;
  }

  /**
   * Fetch a single revision including content. Returns null if not found.
   */
  static async get(
    context: NcContext,
    revisionId: string,
    options: { retentionDays?: number } = {},
  ): Promise<DocRevision | null> {
    const row = await Noco.ncDocsContent.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      { id: revisionId },
    );
    if (!row) return null;

    // Treat out-of-window revisions as not found so callers see a consistent
    // "not found" surface (list already hides them) and restore can't be
    // used to round-trip past the plan's retention window.
    if (
      options.retentionDays !== undefined &&
      Number.isFinite(options.retentionDays) &&
      options.retentionDays > 0 &&
      row.created_at
    ) {
      const cutoffMs = Date.now() - options.retentionDays * 86400000;
      if (new Date(row.created_at).getTime() < cutoffMs) {
        return null;
      }
    }

    return new DocRevision(prepareForResponse(row, ['content']));
  }

  /**
   * Delete all revisions for a doc — hard delete only (soft delete keeps
   * revisions so the doc can be restored). Cascades snapshot rows first:
   * revisions and file_references live in separate DBs with no cross-DB
   * transaction, and snapshots orphaned by a crash here would pin file_url
   * groups in storage forever.
   */
  static async deleteForDoc(context: NcContext, docId: string): Promise<void> {
    const revisionIds: string[] = (
      await Noco.ncDocsContent.metaList2(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_REVISIONS,
        { condition: { fk_doc_id: docId }, fields: ['id'] },
      )
    ).map((r: any) => r.id);

    await FileReference.bulkDeleteForRevisions(context, revisionIds);

    await Noco.ncDocsContent.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      { fk_doc_id: docId },
    );
  }
}

export { DocRevisionSource };
