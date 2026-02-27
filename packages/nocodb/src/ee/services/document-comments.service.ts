import { Injectable } from '@nestjs/common';
import { DocumentCommentsService as DocumentCommentsServiceCE } from 'src/services/document-comments.service';
import { EventType, type UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Comment from '~/models/Comment';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import NocoSocket from '~/socket/NocoSocket';

@Injectable()
export class DocumentCommentsService extends DocumentCommentsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async commentResolve(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const comment = await Comment.get(context, param.commentId);

    if (!comment || !comment.fk_doc_id) {
      throw new Error('Comment not found');
    }

    const res = await Comment.resolve(context, param.commentId, {
      resolved_by: comment.resolved_by ? null : param.user.id,
      resolved_by_email: comment.resolved_by ? null : param.user.email,
    });

    NocoSocket.broadcastEvent(
      context,
      {
        event: EventType.DOCUMENT_COMMENT_EVENT,
        payload: {
          action: 'resolve',
          payload: res,
          id: comment.fk_doc_id,
        },
      },
      context.socket_id,
    );

    return res;
  }
}
