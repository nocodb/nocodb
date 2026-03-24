import type { NcContext } from '~/interface/config';
import Noco from '~/Noco';
import { MetaTable } from '~/utils/globals';
import { extractProps } from '~/helpers/extractProps';

export default class CommentReaction {
  id?: string;
  row_id?: string;
  comment_id?: string;
  source_id?: string;
  fk_model_id?: string;
  base_id?: string;
  reaction?: string;
  created_by?: string;
  fk_workspace_id?: string;
  created_at?: string;
  updated_at?: string;

  constructor(data: Partial<CommentReaction>) {
    Object.assign(this, data);
  }

  public static async insert(
    context: NcContext,
    reaction: Partial<CommentReaction>,
    ncMeta = Noco.ncMeta,
  ) {
    const insertObj = extractProps(reaction, [
      'comment_id',
      'reaction',
      'created_by',
      'base_id',
      'fk_workspace_id',
    ]);

    const res = await ncMeta.metaInsert2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      insertObj,
    );

    return new CommentReaction({ ...insertObj, ...res });
  }

  public static async delete(
    context: NcContext,
    reactionId: string,
    ncMeta = Noco.ncMeta,
  ) {
    await ncMeta.metaDelete(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      reactionId,
    );

    return true;
  }

  public static async listByComment(
    context: NcContext,
    commentId: string,
    ncMeta = Noco.ncMeta,
  ): Promise<CommentReaction[]> {
    const list = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      {
        condition: { comment_id: commentId },
        orderBy: {
          created_at: 'asc',
        },
      },
    );

    return list.map((r: any) => new CommentReaction(r));
  }

  public static async listByComments(
    context: NcContext,
    commentIds: string[],
    ncMeta = Noco.ncMeta,
  ): Promise<Map<string, CommentReaction[]>> {
    if (!commentIds.length) return new Map();

    const list = await ncMeta
      .knexConnection(MetaTable.COMMENTS_REACTIONS)
      .where('fk_workspace_id', context.workspace_id)
      .where('base_id', context.base_id)
      .whereIn('comment_id', commentIds)
      .orderBy('created_at', 'asc');

    const map = new Map<string, CommentReaction[]>();
    for (const row of list) {
      const commentId = row.comment_id;
      if (!map.has(commentId)) map.set(commentId, []);
      map.get(commentId)!.push(new CommentReaction(row));
    }

    return map;
  }

  /**
   * Toggle a reaction: add if not present, remove if already present.
   * Returns { added: true/false, reaction: CommentReaction | null }
   */
  public static async toggle(
    context: NcContext,
    params: { comment_id: string; reaction: string; user_id: string },
    ncMeta = Noco.ncMeta,
  ): Promise<{ added: boolean; reaction: CommentReaction | null }> {
    const existing = await ncMeta.metaList2(
      context.workspace_id,
      context.base_id,
      MetaTable.COMMENTS_REACTIONS,
      {
        condition: {
          comment_id: params.comment_id,
          reaction: params.reaction,
          created_by: params.user_id,
        },
      },
    );

    if (existing.length > 0) {
      await CommentReaction.delete(context, existing[0].id, ncMeta);
      return { added: false, reaction: null };
    }

    const newReaction = await CommentReaction.insert(
      context,
      {
        comment_id: params.comment_id,
        reaction: params.reaction,
        created_by: params.user_id,
        base_id: context.base_id,
        fk_workspace_id: context.workspace_id,
      },
      ncMeta,
    );

    return { added: true, reaction: newReaction };
  }
}
