import { Injectable } from '@nestjs/common';
import { CommentsService as CommentsServiceCE } from 'src/services/comments.service';
import type { UserType } from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import Comment from '~/models/Comment';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';

@Injectable()
export class CommentsService extends CommentsServiceCE {
  constructor(protected readonly appHooksService: AppHooksService) {
    super(appHooksService);
  }

  async commentResolve(param: {
    commentId: string;
    user: UserType;
    req: NcRequest;
  }) {
    const comment = await Comment.get(param.commentId);

    const res = await Comment.update(param.commentId, {
      resolved_by: comment.resolved_by ? null : param.user.id,
      resolved_by_email: comment.resolved_by ? null : param.user.email,
    });

    return res;
  }
}
