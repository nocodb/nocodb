import { Injectable } from '@nestjs/common';
import { AppEvents, EventType } from 'nocodb-sdk';
import { Base, Model, Source } from '../models';
import type {
  AttachmentType,
  CommentReqType,
  CommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { assertAttachmentRefOwned } from '~/helpers/attachmentHelpers';
import { sanitizeCommentBody } from '~/helpers/sanitizeCommentBody';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Comment from '~/models/Comment';
import { MailService } from '~/services/mail/mail.service';
import { MailEvent } from '~/interface/Mail';
import NocoSocket from '~/socket/NocoSocket';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';

// Sanitizing can leave a body with no visible text, e.g. `<p></p>`.
function assertCommentNotEmpty(
  context: NcContext,
  body: string,
  attachments?: unknown[] | null,
) {
  const text = body
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (!text && !attachments?.length) {
    NcError.get(context).badRequest('Comment cannot be empty');
  }
}

// Comment files are served by the row each attachment creates, so a new one
// must name a file the author uploaded or this base already holds. Files the
// comment already had were checked when they were added.
async function assertCommentAttachmentsOwned(
  context: NcContext,
  attachments: AttachmentType[] | undefined,
  userId: string | undefined,
  kept: AttachmentType[] = [],
) {
  if (!Array.isArray(attachments)) return;
  for (const att of attachments) {
    if (!att) continue;
    const isKept = kept.some(
      (k) =>
        k?.id && k.id === att.id && k.path === att.path && k.url === att.url,
    );
    if (!isKept) await assertAttachmentRefOwned(context, att, userId);
  }
}

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
      /** Interface-scoped callers stamp their surface — see `RowCommentEvent.source`. */
      source?: { interfaceId: string; pageId: string };
    },
  ) {
    validatePayload('swagger.json#/components/schemas/CommentReq', param.body);

    const sanitizedComment = sanitizeCommentBody(param.body.comment);
    assertCommentNotEmpty(context, sanitizedComment, param.body.attachments);
    await assertCommentAttachmentsOwned(
      context,
      param.body.attachments,
      param.user?.id,
    );

    const model = await Model.getByIdOrName(context, {
      id: param.body.fk_model_id,
    });
    if (!model) NcError.get(context).tableNotFound(param.body.fk_model_id);

    const source = await Source.get(context, model.source_id);
    const baseModel = await Model.getBaseModelSQL(context, {
      id: model.id,
      dbDriver: await NcConnectionMgrv2.get(source),
      source,
    });
    if (!(await baseModel.exist(param.body.row_id))) {
      NcError.get(context).recordNotFound(param.body.row_id);
    }

    const res = await Comment.insert(context, {
      ...param.body,
      comment: sanitizedComment,
      created_by: param.user?.id,
      created_by_email: param.user?.email,
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
      ...(param.source ? { source: param.source } : {}),
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

    // An unknown id and a soft-deleted comment are both "gone" — answer
    // not-found rather than dereferencing null (500) or claiming an
    // authorship problem (403).
    if (!comment || comment.is_deleted) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    if (comment.created_by !== param.user.id) {
      NcError.get(context).insufficientPrivilege(
        'Only the user who wrote this comment can delete it.',
      );
    }

    const res = await Comment.delete(context, param.commentId);

    const model = await Model.getByIdOrName(context, {
      id: comment.fk_model_id,
    });

    this.appHooksService.emit(AppEvents.COMMENT_DELETE, {
      base: await Base.getByTitleOrId(context, model.base_id),
      model: model,
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
    return await Comment.list(context, param.query);
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
      /** Interface-scoped callers stamp their surface — see `RowCommentEvent.source`. */
      source?: { interfaceId: string; pageId: string };
    },
  ) {
    validatePayload(
      'swagger.json#/components/schemas/CommentUpdateReq',
      param.body,
    );

    const comment = await Comment.get(context, param.commentId);

    // See `commentDelete` — missing or soft-deleted is a not-found, not a 500
    // and not an authorship error.
    if (!comment || comment.is_deleted) {
      NcError.get(context).genericNotFound('Comment', param.commentId);
    }

    if (comment.created_by !== param.user.id) {
      NcError.get(context).insufficientPrivilege(
        'Only the user who wrote this comment can edit it.',
      );
    }

    const sanitizedComment = sanitizeCommentBody(param.body.comment);
    if (
      param.body.comment !== undefined ||
      param.body.attachments !== undefined
    ) {
      assertCommentNotEmpty(
        context,
        param.body.comment !== undefined
          ? sanitizedComment
          : comment.comment ?? '',
        param.body.attachments !== undefined
          ? param.body.attachments
          : comment.attachments,
      );
    }

    await assertCommentAttachmentsOwned(
      context,
      param.body.attachments,
      param.user.id,
      comment.attachments,
    );

    const res = await Comment.update(context, param.commentId, {
      // only overwrite text / attachments when explicitly provided, so an
      // edit of one doesn't wipe the other
      ...(param.body.comment !== undefined
        ? { comment: sanitizedComment }
        : {}),
      ...(param.body.attachments !== undefined
        ? { attachments: param.body.attachments }
        : {}),
      ...(param.body.meta !== undefined ? { meta: param.body.meta } : {}),
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
        comment: res.comment,
      },
      rowId: comment.row_id,
      req: param.req,
      context,
      ...(param.source ? { source: param.source } : {}),
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
}
