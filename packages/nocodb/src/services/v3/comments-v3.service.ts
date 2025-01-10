import { Injectable } from '@nestjs/common';
import type {
  CommentReqType,
  CommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { CommentsService } from '~/services/comments.service';

@Injectable()
export class CommentsV3Service {
  constructor(protected readonly commentsService: CommentsService) {}

  async commentRow(
    context: NcContext,
    param: {
      body: CommentReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return this.commentsService.commentRow(context, param);
  }

  async commentDelete(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    return this.commentsService.commentDelete(context, param);
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
    return this.commentsService.commentList(context, param);
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
    return this.commentsService.commentUpdate(context, param);
  }
}
