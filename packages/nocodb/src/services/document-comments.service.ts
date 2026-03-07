import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import type {
  DocumentCommentReqType,
  DocumentCommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Comment from '~/models/Comment';
import CommentReaction from '~/models/CommentReaction';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class DocumentCommentsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async commentCreate(
    context: NcContext,
    param: {
      body: DocumentCommentReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    if (!param.body.fk_doc_id) {
      NcError.badRequest('fk_doc_id is required');
    }
    if (!param.body.comment) {
      NcError.badRequest('comment is required');
    }

    const res = await Comment.insertDocComment(context, {
      ...param.body,
      base_id: context.base_id,
      created_by: param.user?.id,
      created_by_email: param.user?.email,
    });

    this.appHooksService.emit(AppEvents.DOCUMENT_COMMENT_CREATE, {
      context,
      req: param.req,
      comment: res,
      user: param.user,
      docId: param.body.fk_doc_id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_COMMENT_EVENT,
        payload: {
          action: 'add',
          payload: res,
          id: param.body.fk_doc_id,
        },
      },
      context.socket_id,
    );

    return res;
  }

  async commentList(
    context: NcContext,
    param: { fk_doc_id: string },
  ) {
    if (!param.fk_doc_id) {
      NcError.badRequest('fk_doc_id is required');
    }

    return await Comment.listByDoc(context, param.fk_doc_id);
  }

  async commentUpdate(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      body: DocumentCommentUpdateReqType;
      req: NcRequest;
    },
  ) {
    const comment = await Comment.get(context, param.commentId);

    if (!comment || !comment.fk_doc_id) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    if (comment.created_by !== param.user.id || comment.is_deleted) {
      NcError.get(context).unauthorized('Unauthorized access');
    }

    const res = await Comment.update(context, param.commentId, {
      comment: param.body.comment,
    });

    this.appHooksService.emit(AppEvents.DOCUMENT_COMMENT_UPDATE, {
      context,
      req: param.req,
      comment: res,
      user: param.user,
      docId: comment.fk_doc_id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_COMMENT_EVENT,
        payload: {
          action: 'update',
          payload: res,
          id: comment.fk_doc_id,
        },
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

    if (!comment || !comment.fk_doc_id) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    if (comment.created_by !== param.user.id || comment.is_deleted) {
      NcError.get(context).unauthorized('Unauthorized access');
    }

    const res = await Comment.delete(context, param.commentId);

    this.appHooksService.emit(AppEvents.DOCUMENT_COMMENT_DELETE, {
      context,
      req: param.req,
      comment,
      user: param.user,
      docId: comment.fk_doc_id,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_COMMENT_EVENT,
        payload: {
          action: 'delete',
          payload: comment,
          id: comment.fk_doc_id,
        },
      },
      context.socket_id,
    );

    return res;
  }

  async commentCount(
    context: NcContext,
    param: { docIds: string[] },
  ) {
    if (!param.docIds?.length) {
      return [];
    }

    return await Comment.docCommentsCount(context, param.docIds);
  }

  async reactionToggle(
    context: NcContext,
    param: {
      commentId: string;
      reaction: string;
      user: UserType;
    },
  ) {
    if (!param.commentId || !param.reaction) {
      NcError.badRequest('commentId and reaction are required');
    }

    const comment = await Comment.get(context, param.commentId);
    if (!comment || !comment.fk_doc_id) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    const result = await CommentReaction.toggle(context, {
      comment_id: param.commentId,
      reaction: param.reaction,
      user_id: param.user.id,
    });

    return result;
  }

  async reactionList(
    context: NcContext,
    param: { commentIds: string[] },
  ) {
    if (!param.commentIds?.length) return {};

    const map = await CommentReaction.listByComments(context, param.commentIds);

    // Convert Map to plain object for serialization
    const result: Record<string, CommentReaction[]> = {};
    for (const [key, value] of map) {
      result[key] = value;
    }
    return result;
  }
}
