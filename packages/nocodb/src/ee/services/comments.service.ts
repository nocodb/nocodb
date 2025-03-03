import { Injectable } from '@nestjs/common';
import { CommentsService as CommentsServiceCE } from 'src/services/comments.service';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import Comment from '~/models/Comment';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { MailService } from '~/services/mail/mail.service';

@Injectable()
export class CommentsService extends CommentsServiceCE {
  constructor(
    protected readonly appHooksService: AppHooksService,
    protected readonly mailService: MailService,
  ) {
    super(appHooksService, mailService);
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

    const res = await Comment.resolve(context, param.commentId, {
      resolved_by: comment.resolved_by ? null : param.user.id,
      resolved_by_email: comment.resolved_by ? null : param.user.email,
    });

    return res;
  }
}
