import { v7 as uuidv7 } from 'uuid';
import { DocRevisionSource } from 'nocodb-sdk';
import type { DocumentRevisionType, NcContext } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';
import { prepareForDb, prepareForResponse } from '~/utils/modelUtils';

/**
 * Default coalesce window: revisions saved by the same author within this
 * window are merged into a single revision (the prior row is updated in place).
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

export default class DocRevision implements DocumentRevisionType {
  id?: string;
  fk_audit_id?: string | null;
  fk_doc_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  version?: number;
  content?: Record<string, any>;
  title?: string;
  created_by?: string;
  source?: DocRevisionSource;
  created_at?: string;
  updated_at?: string;

  constructor(rev: Partial<DocumentRevisionType>) {
    Object.assign(this, rev);
  }

  /**
   * Record a revision for a document save.
   *
   * Coalescing: when the latest revision is by the same user and within the
   * coalesce window, the prior row is updated in place (its content/title/
   * version/created_at are refreshed). Otherwise a new row is inserted.
   *
   * The caller is responsible for deciding whether a content change happened —
   * this method always writes (insert or update). Callers should pass only
   * when content or title actually changed.
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
      fkAuditId?: string | null;
    },
  ): Promise<DocRevision> {
    const {
      docId,
      version,
      content,
      title,
      createdBy,
      source = DocRevisionSource.AUTO,
      fkAuditId = null,
    } = params;

    const latest = await this.latestForDoc(context, docId);

    const now = Date.now();
    const coalesceWindowMs = getCoalesceWindowMs();
    const canCoalesce =
      latest &&
      latest.created_by === createdBy &&
      latest.source === DocRevisionSource.AUTO &&
      source === DocRevisionSource.AUTO &&
      coalesceWindowMs > 0 &&
      now - new Date(latest.created_at!).getTime() < coalesceWindowMs;

    if (canCoalesce) {
      const updateObj = {
        version,
        title,
        content,
        fk_audit_id: fkAuditId,
      };
      await Noco.ncDocsContent.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.DOC_REVISIONS,
        prepareForDb(updateObj, ['content']),
        { id: latest.id },
      );
      return (await this.get(context, latest.id!))!;
    }

    const insertObj: Record<string, any> = {
      id: uuidv7(),
      fk_audit_id: fkAuditId,
      fk_doc_id: docId,
      base_id: context.base_id,
      fk_workspace_id: context.workspace_id,
      version,
      content,
      title,
      created_by: createdBy,
      source,
    };

    await Noco.ncDocsContent.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      prepareForDb(insertObj, ['content']),
      true, // ignoreIdGeneration — id is pre-generated above
    );

    return (await this.get(context, insertObj.id))!;
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
          'source',
          'created_at',
        ],
      },
    );
    return rows[0] ? new DocRevision(rows[0]) : null;
  }

  /**
   * List revisions for a doc, newest first. Paginated by created_at cursor.
   * Content is NOT included in the response — use `get()` for full content.
   */
  static async list(
    context: NcContext,
    docId: string,
    options: { limit?: number; before?: string } = {},
  ): Promise<DocRevision[]> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

    const condition: Record<string, any> = { fk_doc_id: docId };
    const xcCondition: Record<string, any> = {};

    if (options.before) {
      xcCondition.created_at = { lt: options.before };
    }

    const rows = await Noco.ncDocsContent.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      {
        condition,
        ...(options.before ? { xcCondition } : {}),
        orderBy: { created_at: 'desc' },
        limit,
        fields: [
          'id',
          'fk_audit_id',
          'fk_doc_id',
          'version',
          'title',
          'created_by',
          'source',
          'created_at',
        ],
      },
    );

    return rows.map((r) => new DocRevision(r));
  }

  /**
   * Fetch a single revision including content. Returns null if not found.
   */
  static async get(
    context: NcContext,
    revisionId: string,
  ): Promise<DocRevision | null> {
    const row = await Noco.ncDocsContent.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      { id: revisionId },
    );
    if (!row) return null;
    return new DocRevision(prepareForResponse(row, ['content']));
  }

  /**
   * Delete all revisions for a doc. Called when the doc itself is hard-deleted
   * (soft-delete leaves revisions in place so the doc can be restored).
   */
  static async deleteForDoc(context: NcContext, docId: string): Promise<void> {
    await Noco.ncDocsContent.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.DOC_REVISIONS,
      { fk_doc_id: docId },
    );
  }
}

export { DocRevisionSource };
