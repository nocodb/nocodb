import type { CommentType } from 'nocodb-sdk';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { prepareForDb } from '~/utils/modelUtils';
import { extractProps } from '~/helpers/extractProps';
import Model from '~/models/Model';

export default class Comment implements CommentType {
  id?: string;
  fk_model_id?: string;
  row_id?: string;
  comment?: string;
  parent_comment_id?: string;
  source_id?: string;
  base_id?: string;
  created_by?: string;
  resolved_by?: string;
  created_by_email?: string;
  resolved_by_email?: string;
  is_deleted?: boolean;

  constructor(comment: Partial<Comment>) {
    Object.assign(this, comment);
  }

  public static async get(commentId: string, ncMeta = Noco.ncMeta) {
    const comment = await ncMeta.metaGet2(
      null,
      null,
      MetaTable.COMMENTS,
      commentId,
    );

    return comment && new Comment(comment);
  }

  public static async list(
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

  public static async insert(comment: Partial<Comment>, ncMeta = Noco.ncMeta) {
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

    if ((!insertObj.base_id || !insertObj.source_id) && insertObj.fk_model_id) {
      const model = await Model.getByIdOrName(
        { id: insertObj.fk_model_id },
        ncMeta,
      );

      insertObj.base_id = model.base_id;
      insertObj.source_id = model.source_id;
    }

    const res = await ncMeta.metaInsert2(
      null,
      null,
      MetaTable.COMMENTS,
      prepareForDb(insertObj),
    );

    return res;
  }
  public static async update(
    commentId: string,
    comment: Partial<Comment>,
    ncMeta = Noco.ncMeta,
  ) {
    const updateObj = extractProps(comment, ['comment', 'resolved_by']);

    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COMMENTS,
      prepareForDb(updateObj),
      commentId,
    );

    return this.get(commentId, ncMeta);
  }

  static async delete(commentId: string, ncMeta = Noco.ncMeta) {
    await ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COMMENTS,
      { is_deleted: true },
      commentId,
    );

    return true;
  }

  static async deleteRowComments(fk_model_id: string, ncMeta = Noco.ncMeta) {
    return ncMeta.metaUpdate(
      null,
      null,
      MetaTable.COMMENTS,
      {
        is_deleted: true,
      },
      {
        fk_model_id,
      },
    );
  }

  public static async commentsCount(args: {
    ids: string[];
    fk_model_id: string;
  }) {
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
