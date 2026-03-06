import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import { Base, Model } from '../models';
import type {
  CommentReqType,
  CommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Comment from '~/models/Comment';
import CommentReaction from '~/models/CommentReaction';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class CommentsService {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {}

  async commentRow(
    context: NcContext,
    param: {
      body: CommentReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload('swagger.json#/components/schemas/CommentReq', param.body);

    if (param.body.parent_comment_id) {
      const parentComment = await Comment.get(
        context,
        param.body.parent_comment_id,
      );

      if (!parentComment || parentComment.is_deleted) {
        NcError.get(context).genericNotFound(
          'Comment',
          param.body.parent_comment_id,
        );
      }

      if (parentComment.parent_comment_id) {
        NcError.get(context).badRequest(
          'Nested replies are not supported',
        );
      }
    }

    const res = await Comment.insert(context, {
      ...param.body,
      created_by: param.user?.id,
      created_by_email: param.user?.email,
    });

    const model = await Model.getByIdOrName(context, {
      id: param.body.fk_model_id,
    });

    const base = await Base.getByTitleOrId(context, model.base_id);

    await this.mailService.sendMail({
      mailEvent: MailEvent.COMMENT_CREATE,
      payload: {
        base,
        model,
        user: param.user,
        comment: res,
        rowId: param.body.row_id,
        req: param.req,
      },
    });

    this.appHooksService.emit(AppEvents.COMMENT_CREATE, {
      base,
      model,
      user: param.user,
      comment: res,
      rowId: param.body.row_id,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.COMMENT_EVENT,
        payload: {
          action: 'add',
          payload: res,
          id: param.body.row_id,
        },
        scopes: [model.id],
      },
      context.socket_id,
    );

    return res;
  }

  async commentDelete(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const comment = await Comment.get(context, param.commentId);

    if (comment.created_by !== param.user.id || comment.is_deleted) {
      NcError.get(context).unauthorized('Unauthorized access');
    }

    const res = await Comment.delete(context, param.commentId);

    await CommentReaction.deleteByComment(context, param.commentId);

    const model = await Model.getByIdOrName(context, {
      id: comment.fk_model_id,
    });

    const base = await Base.getByTitleOrId(context, model.base_id);

    // Cascade soft-delete replies and their reactions
    if (!comment.parent_comment_id) {
      const replies = await Comment.listReplies(context, param.commentId);

      if (replies.length) {
        const replyIds = replies.map((r) => r.id).filter(Boolean);

        await CommentReaction.deleteByCommentIds(context, replyIds);
        await Comment.deleteReplies(context, param.commentId);

        for (const reply of replies) {
          this.appHooksService.emit(AppEvents.COMMENT_DELETE, {
            base,
            model,
            user: param.user,
            comment: reply,
            rowId: reply.row_id,
            req: param.req,
            context,
          });
        }
      }
    }

    this.appHooksService.emit(AppEvents.COMMENT_DELETE, {
      base,
      model,
      user: param.user,
      comment: comment,
      rowId: comment.row_id,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.COMMENT_EVENT,
        payload: {
          action: 'delete',
          payload: comment,
          id: comment.row_id,
        },
        scopes: [model.id],
      },
      context.socket_id,
    );

    return res;
  }

  async commentList(
    context: NcContext,
    param: {
      query: {
        row_id: string;
        fk_model_id: string;
      };
    },
  ) {
    const comments = await Comment.list(context, param.query);

    const commentIds = comments
      .map((c) => c.id)
      .filter(Boolean) as string[];

    if (commentIds.length) {
      const reactions = await CommentReaction.listByCommentIds(
        context,
        commentIds,
      );

      const reactionsByComment = new Map<
        string,
        CommentReaction[]
      >();
      for (const r of reactions) {
        const list = reactionsByComment.get(r.comment_id) || [];
        list.push(r);
        reactionsByComment.set(r.comment_id, list);
      }

      for (const comment of comments) {
        (comment as Record<string, unknown>).reactions =
          reactionsByComment.get(comment.id) || [];
      }
    }

    return comments;
  }

  async commentsCount(
    context: NcContext,
    param: { fk_model_id: string; ids: string[] },
  ) {
    return await Comment.commentsCount(context, {
      fk_model_id: param.fk_model_id as string,
      ids: param.ids as string[],
    });
  }

  async commentUpdate(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      body: CommentUpdateReqType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/CommentUpdateReq',
      param.body,
    );

    const comment = await Comment.get(context, param.commentId);

    if (comment.created_by !== param.user.id || comment.is_deleted) {
      NcError.get(context).unauthorized('Unauthorized access');
    }

    const res = await Comment.update(context, param.commentId, {
      comment: param.body.comment,
    });

    const model = await Model.getByIdOrName(context, {
      id: comment.fk_model_id,
    });

    const base = await Base.getByTitleOrId(context, model.base_id);

    await this.mailService.sendMail({
      mailEvent: MailEvent.COMMENT_CREATE,
      payload: {
        base,
        model,
        user: param.user,
        comment: res,
        rowId: res.row_id,
        req: param.req,
      },
    });

    this.appHooksService.emit(AppEvents.COMMENT_UPDATE, {
      base,
      model,
      user: param.user,
      comment: {
        ...comment,
        comment: param.body.comment,
      },
      rowId: comment.row_id,
      req: param.req,
      context,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.COMMENT_EVENT,
        payload: {
          action: 'update',
          payload: res,
          id: comment.row_id,
        },
        scopes: [model.id],
      },
      context.socket_id,
    );

    return res;
  }

  async reactionAdd(
    context: NcContext,
    param: {
      commentId: string;
      reaction: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    if (
      !param.reaction ||
      typeof param.reaction !== 'string' ||
      param.reaction.length > 64
    ) {
      NcError.get(context).badRequest('Invalid reaction');
    }

    const comment = await Comment.get(context, param.commentId);

    if (!comment) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    const existing = await CommentReaction.getByUserReaction(context, {
      commentId: param.commentId,
      reaction: param.reaction,
      userId: param.user.id,
    });

    if (existing) {
      return existing;
    }

    const model = await Model.getByIdOrName(context, {
      id: comment.fk_model_id,
    });

    const res = await CommentReaction.insert(context, {
      comment_id: param.commentId,
      row_id: comment.row_id,
      reaction: param.reaction,
      source_id: comment.source_id,
      fk_model_id: comment.fk_model_id,
      base_id: comment.base_id,
      created_by: param.user.id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.COMMENT_EVENT,
        payload: {
          action: 'reactionAdd',
          payload: res,
          id: comment.row_id,
        },
        scopes: [model.id],
      },
      context.socket_id,
    );

    return res;
  }

  async reactionRemove(
    context: NcContext,
    param: {
      commentId: string;
      reaction: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    if (
      !param.reaction ||
      typeof param.reaction !== 'string' ||
      param.reaction.length > 64
    ) {
      NcError.get(context).badRequest('Invalid reaction');
    }

    const comment = await Comment.get(context, param.commentId);

    if (!comment) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    await CommentReaction.delete(context, {
      commentId: param.commentId,
      reaction: param.reaction,
      userId: param.user.id,
    });

    const model = await Model.getByIdOrName(context, {
      id: comment.fk_model_id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.COMMENT_EVENT,
        payload: {
          action: 'reactionRemove',
          payload: {
            comment_id: param.commentId,
            reaction: param.reaction,
            created_by: param.user.id,
          },
          id: comment.row_id,
        },
        scopes: [model.id],
      },
      context.socket_id,
    );

    return true;
  }
}
