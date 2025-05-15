import type { CommentType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { prepareForDb } from '~/utils/modelUtils';
import { extractProps } from '~/helpers/extractProps';
import Model from '~/models/Model';
import { NcError } from '~/helpers/catchError';

export default class Comment implements CommentType {
  id?: string;
  fk_model_id?: string;
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

  constructor(comment: Partial<Comment>) {
    Object.assign(this, comment);
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
          _or: [{ is_deleted: { eq: null } }, { is_deleted: { eq: true } }],
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
    const insertObj = extractProps(comment, [
      'id',
      'fk_model_id',
      'row_id',
      'comment',
      'parent_comment_id',
      'source_id',
      'base_id',
      'fk_model_id',
      'created_by',
      'created_by_email',
    ]);

    if (!insertObj.fk_model_id) NcError.tableNotFound(insertObj.fk_model_id);

    if (!insertObj.source_id) {
      const model = await Model.getByIdOrName(
        context,
        { id: insertObj.fk_model_id },
        ncMeta,
      );
      insertObj.source_id = model.source_id;
    }

    const res = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(insertObj),
    );

    return res;
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
    ]);

    await ncMeta.metaUpdate(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS,
      prepareForDb(updateObj),
      commentId,
    );

    return Comment.get(context, commentId, ncMeta);
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
      .where('fk_model_id', args.fk_model_id)
      .where(function () {
        this.whereNull('is_deleted').orWhere('is_deleted', '!=', true);
      })
      .groupBy('row_id');

    return audits?.map((a) => new Comment(a));
  }
}
