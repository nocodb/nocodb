import type { CommentReactionType } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

export default class CommentReaction implements CommentReactionType {
  id?: string;
  row_id?: string;
  comment_id?: string;
  reaction?: string;
  source_id?: string;
  fk_model_id?: string;
  base_id?: string;
  fk_workspace_id?: string;
  created_by?: string;
  created_at?: string;

  constructor(reaction: Partial<CommentReaction>) {
    Object.assign(this, reaction);
  }

  public static async insert(
    context: NcContext,
    reaction: Partial<CommentReaction>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(reaction, [
      'comment_id',
      'row_id',
      'reaction',
      'source_id',
      'fk_model_id',
      'base_id',
      'created_by',
    ]);

    const res = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      insertObj,
    );

    return new CommentReaction(res);
  }

  public static async listByCommentIds(
    context: NcContext,
    commentIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<CommentReaction[]> {
    if (!commentIds.length) return [];

    const reactions = await ncMeta
      .knex(MetaTable.COMMENTS_REACTIONS)
      .select(`${MetaTable.COMMENTS_REACTIONS}.*`)
      .whereIn('comment_id', commentIds);

    return reactions.map((r) => new CommentReaction(r));
  }

  public static async getByUserReaction(
    context: NcContext,
    {
      commentId,
      reaction,
      userId,
    }: {
      commentId: string;
      reaction: string;
      userId: string;
    },
    ncMeta = Noco.ncMeta,
  ): Promise<CommentReaction | null> {
    const row = await ncMeta
      .knex(MetaTable.COMMENTS_REACTIONS)
      .where({
        comment_id: commentId,
        reaction,
        created_by: userId,
      })
      .first();

    return row ? new CommentReaction(row) : null;
  }

  public static async delete(
    context: NcContext,
    {
      commentId,
      reaction,
      userId,
    }: {
      commentId: string;
      reaction: string;
      userId: string;
    },
    ncMeta = Noco.ncMeta,
  ) {
    return ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      {
        comment_id: commentId,
        reaction,
        created_by: userId,
      },
    );
  }

  public static async deleteByComment(
    context: NcContext,
    commentId: string,
    ncMeta = Noco.ncMeta,
  ) {
    return ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      {
        comment_id: commentId,
      },
    );
  }

  public static async deleteByCommentIds(
    context: NcContext,
    commentIds: string[],
    ncMeta = Noco.ncMeta,
  ) {
    if (!commentIds.length) return;

    return ncMeta
      .knex(MetaTable.COMMENTS_REACTIONS)
      .whereIn('comment_id', commentIds)
      .delete();
  }
}
