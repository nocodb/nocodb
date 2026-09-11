import type { AttachmentType, CommentType, MetaType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { parseMetaProp, prepareForDb } from '~/utils/modelUtils';
import { extractProps } from '~/helpers/extractProps';
import Model from '~/models/Model';
import FileReference from '~/models/FileReference';
import NcPluginMgrv2 from '~/helpers/NcPluginMgrv2';
import { NcError } from '~/helpers/catchError';

export default class Comment implements CommentType {
  id?: string;
  fk_model_id?: string;
  fk_doc_id?: string;
  anchor_id?: string;
  row_id?: string;
  comment?: string;
  parent_comment_id?: string;
  source_id?: string;
  fk_workspace_id?: string;
  base_id?: string;
  created_by?: string;
  resolved_by?: string;
  created_by_email?: string;
  resolved_by_email?: string;
  is_deleted?: boolean;
  attachments?: AttachmentType[];
  meta?: MetaType;

  constructor(comment: Partial<Comment>) {
    Object.assign(this, comment);

    // `attachments` is persisted as a JSON string — parse it back to an array.
    // parseMetaProp is a no-op when the value is already an array / nullish.
    this.attachments = parseMetaProp(this, 'attachments', null);

    if (this.meta) {
      this.meta = parseMetaProp(this, 'meta');
    }
  }

  public static async get(
    context: NcContext,
    commentId: string,
    ncMeta = Noco.ncMeta,
  ) {
    const comment = await ncMeta.metaGet2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      commentId,
    );

    return comment && new Comment(comment);
  }

  public static async listByModel(
    context: NcContext,
    fk_model_id: string,
    pagination?: { limit: number; offset: number },
    ncMeta = Noco.ncMeta,
  ): Promise<Comment[]> {
    const comments = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      {
        condition: {
          fk_model_id,
        },
        orderBy: {
          id: 'asc',
        },
        limit: pagination?.limit,
        offset: pagination?.offset,
        xcCondition: {
          _or: [{ is_deleted: { eq: null } }, { is_deleted: { neq: true } }],
        },
      },
    );

    return comments.map((comment) => new Comment(comment));
  }

  public static async list(
    context: NcContext,
    {
      row_id,
      fk_model_id,
    }: {
      row_id: string;
      fk_model_id: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    const commentList = await ncMeta
      .knex(MetaTable.COMMENTS)
      .select(`${MetaTable.COMMENTS}.*`)
      .where('row_id', row_id)
      // Model ids are unique per base (MODELS is keyed on `base_id, id`), so
      // `(row_id, fk_model_id)` alone identifies a discussion in EVERY base at
      // once — the caller's authorized base has to be part of the predicate.
      .where('base_id', context.base_id)
      .where('fk_model_id', fk_model_id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .orderBy('created_at', 'asc');

    return commentList.map((comment) => new Comment(comment));
  }

  public static async insert(
    context: NcContext,
    comment: Partial<Comment>,
    ncMeta = Noco.ncMeta,
  ) {
    // `id`, `base_id` and `source_id` are deliberately NOT accepted from the
    // caller. A chosen `id` collides with an existing comment, and the client
    // renders bodies from a map keyed on comment id — the later body wins and
    // shows under the earlier comment's author.
    const insertObj = extractProps(comment, [
      'fk_model_id',
      'row_id',
      'comment',
      'parent_comment_id',
      'created_by',
      'created_by_email',
      'attachments',
      'meta',
    ]);

    if (Array.isArray(insertObj.attachments)) {
      insertObj.attachments = Comment.sanitizeAttachments(
        insertObj.attachments,
      );
    }

    if (!insertObj.fk_model_id) NcError.tableNotFound(insertObj.fk_model_id);

    // Always resolve the model inside the authorized base — this is what binds
    // the comment to the caller's context. It used to be skipped whenever the
    // caller supplied `source_id`, which made the check opt-out.
    const model = await Model.getByIdOrName(
      context,
      { id: insertObj.fk_model_id },
      ncMeta,
    );
    if (!model) NcError.tableNotFound(insertObj.fk_model_id);
    insertObj.source_id = model.source_id;

    const res = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(insertObj, ['attachments', 'meta']),
    );

    const commentObj = new Comment(res);

    // Link each attachment to a FileReference (keyed by comment id) so it can be
    // served through the authenticated attachment proxy, then persist the
    // injected ids back onto the comment.
    if (commentObj.attachments?.length) {
      await Comment.reconcileAttachments(context, commentObj, ncMeta);
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COMMENTS,
        prepareForDb({ attachments: commentObj.attachments }, ['attachments']),
        commentObj.id,
      );
    }

    return commentObj;
  }
  public static async update(
    context: NcContext,
    commentId: string,
    comment: Partial<Comment>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(comment, [
      'comment',
      'resolved_by',
      'resolved_by_email',
      'attachments',
      'meta',
    ]);

    const attachmentsChanged = Array.isArray(updateObj.attachments);
    if (attachmentsChanged) {
      updateObj.attachments = Comment.sanitizeAttachments(
        updateObj.attachments,
      );
    }

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(updateObj, ['attachments', 'meta']),
      commentId,
    );

    const updated = await Comment.get(context, commentId, ncMeta);

    // Reconcile FileReferences only when attachments were part of this update —
    // creates refs for new files, soft-deletes ones that were removed.
    if (attachmentsChanged && updated) {
      await Comment.reconcileAttachments(context, updated, ncMeta);
      await ncMeta.metaUpdate(
        context.workspace_id,
        context.base_id,
        MetaTable.COMMENTS,
        prepareForDb({ attachments: updated.attachments }, ['attachments']),
        commentId,
      );
    }

    return updated;
  }

  public static async resolve(
    context,
    commentId: string,
    comment: Partial<Comment>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(comment, [
      'resolved_by',
      'resolved_by_email',
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(updateObj),
      commentId,
      {},
      true,
    );

    return Comment.get(context, commentId, ncMeta);
  }

  static async delete(
    context: NcContext,
    commentId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      { is_deleted: true },
      commentId,
    );

    // Comments have no restore path, so reclaim attachment refs immediately —
    // otherwise they stay counted against workspace storage forever.
    const refIds = await FileReference.listIdsForComment(
      context,
      commentId,
      ncMeta,
    );
    if (refIds.length) {
      await FileReference.delete(context, refIds, ncMeta);
    }

    return true;
  }

  static async deleteModelComments(
    context: NcContext,
    fk_model_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    return ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      {
        fk_model_id,
      },
    );
  }

  public static async commentsCount(
    context: NcContext,
    args: {
      ids: string[];
      fk_model_id: string;
    },
  ) {
    const audits = await Noco.ncMeta
      .knex(MetaTable.COMMENTS)
      .count('id', { as: 'count' })
      .select('row_id')
      .whereIn('row_id', args.ids)
      // Base-scoped for the same reason as `list` above.
      .where('base_id', context.base_id)
      .where('fk_model_id', args.fk_model_id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .groupBy('row_id');

    return audits?.map((a) => new Comment(a));
  }

  /**
   * List all non-deleted comments for a document, ordered by created_at asc.
   */
  public static async listByDoc(
    context: NcContext,
    fk_doc_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    const commentList = await ncMeta
      .knex(MetaTable.COMMENTS)
      .select(`${MetaTable.COMMENTS}.*`)
      .where('fk_doc_id', fk_doc_id)
      .where('base_id', context.base_id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .orderBy('created_at', 'asc');

    return commentList.map((comment) => new Comment(comment));
  }

  /**
   * Insert a document comment (does not require fk_model_id / source_id).
   */
  public static async insertDocComment(
    context: NcContext,
    comment: Partial<Comment>,
    ncMeta = Noco.ncMeta,
  ) {
    // No caller-supplied `id` — see the note on `insert`. `base_id` comes from
    // the context inside metaInsert2.
    const insertObj = extractProps(comment, [
      'fk_doc_id',
      'anchor_id',
      'comment',
      'parent_comment_id',
      'created_by',
      'created_by_email',
    ]);

    if (!insertObj.fk_doc_id) {
      NcError.badRequest('fk_doc_id is required for document comments');
    }

    const res = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(insertObj),
    );

    return res;
  }

  /**
   * Soft-delete all comments for a given document (cascade on doc delete).
   */
  static async deleteDocComments(
    context: NcContext,
    fk_doc_id: string,
    ncMeta = Noco.ncMeta,
  ) {
    return ncMeta
      .knex(MetaTable.COMMENTS)
      .where('fk_doc_id', fk_doc_id)
      .where('base_id', context.base_id)
      .update({ is_deleted: true });
  }

  /**
   * Count comments per document (for sidebar badge).
   */
  public static async docCommentsCount(
    context: NcContext,
    docIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    const results = await ncMeta
      .knex(MetaTable.COMMENTS)
      .count('id', { as: 'count' })
      .select('fk_doc_id')
      .whereIn('fk_doc_id', docIds)
      .where('base_id', context.base_id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .groupBy('fk_doc_id');

    return results?.map((r) => new Comment(r));
  }

  /**
   * Keep only the canonical, persistable attachment fields — drops transient
   * ones (signedUrl/signedPath/data/thumbnails) so we never store time-limited
   * URLs. Files are served through the authenticated attachment proxy via their
   * FileReference id (see reconcileAttachments). Invalid entries (no url/path)
   * are filtered out.
   */
  protected static sanitizeAttachments(
    attachments: AttachmentType[],
  ): AttachmentType[] {
    return (attachments || [])
      .filter((att) => att && (att.url || att.path))
      .map((att) =>
        extractProps(att, [
          'id',
          'url',
          'path',
          'title',
          'mimetype',
          'size',
          'icon',
          'width',
          'height',
        ]),
      );
  }

  /**
   * Link a comment's attachments to FileReference rows (keyed by comment id),
   * mutating each attachment's `id` in place. Mirrors how docs / SmartText track
   * attachments so they can be served through the authenticated attachment proxy
   * — no time-limited signed URLs involved.
   *
   * - New attachments (no/invalid id) get a fresh FileReference.
   * - FileReferences whose file is no longer present are soft-deleted.
   */
  protected static async reconcileAttachments(
    context: NcContext,
    comment: Comment,
    ncMeta = Noco.ncMeta,
  ) {
    const attachments = comment.attachments || [];

    const storageAdapter = await NcPluginMgrv2.storageAdapter();

    // Validate any pre-existing ids actually belong to this comment (e.g. an
    // attachment copied from another comment carries a foreign id) — treat
    // those as new and fork a fresh reference.
    const preExistingIds = attachments
      .map((att) => att.id)
      .filter((id): id is string => !!id);

    const refById = new Map<string, FileReference>();
    if (preExistingIds.length) {
      const refs = await FileReference.listByIds(
        context,
        preExistingIds,
        ncMeta,
      );
      for (const ref of refs) refById.set(ref.id, ref);
    }

    for (const att of attachments) {
      const existing = att.id ? refById.get(att.id) : undefined;
      if (
        existing &&
        !existing.deleted &&
        existing.fk_comment_id === comment.id
      ) {
        continue;
      }

      att.id = await FileReference.insert(
        context,
        {
          storage: storageAdapter.name,
          file_url: att.path || att.url,
          file_size: att.size || 0,
          fk_user_id: comment.created_by || 'anonymous',
          source_id: comment.source_id,
          // fk_model_id lets Model.delete's bulkDelete({ fk_model_id })
          // reclaim these refs when the table is deleted.
          fk_model_id: comment.fk_model_id,
          fk_comment_id: comment.id,
        },
        ncMeta,
      );
    }

    // Soft-delete references that are no longer attached to the comment.
    const newIds = new Set(attachments.map((att) => att.id).filter(Boolean));
    const existingIds = await FileReference.listIdsForComment(
      context,
      comment.id,
      ncMeta,
    );
    const removedIds = existingIds.filter((id) => !newIds.has(id));
    if (removedIds.length) {
      await FileReference.delete(context, removedIds, ncMeta);
    }

    return comment;
  }
}
