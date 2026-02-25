import { Injectable } from '@nestjs/common';
import { CommentsV3Service as CommentsV3ServiceCE } from 'src/services/v3/comments-v3.service';
import type { UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { CommentsService } from '~/services/comments.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

const commentBuilder = builderGenerator({
  allowed: [
    'id',
    'row_id',
    'comment',
    'created_by',
    'created_by_email',
    'resolved_by',
    'resolved_by_email',
    'parent_comment_id',
    'is_deleted',
    'created_at',
    'updated_at',
  ],
  transformFn: (data: Record<string, unknown>) => ({
    ...data,
    is_deleted: data.is_deleted ?? false,
  }),
});

@Injectable()
export class CommentsV3Service extends CommentsV3ServiceCE {
  constructor(protected readonly commentsService: CommentsService) {
    super(commentsService);
  }

  async commentRow(
    context: NcContext,
    param: {
      body: any;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const result = await this.commentsService.commentRow(context, param);
    return commentBuilder().build(result);
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
    const result = await this.commentsService.commentList(context, param);
    return commentBuilder().build(result);
  }

  async commentUpdate(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      body: any;
      req: NcRequest;
    },
  ) {
    const result = await this.commentsService.commentUpdate(context, param);
    return commentBuilder().build(result);
  }

  async commentResolve(
    context: NcContext,
    param: {
      commentId: string;
      user: UserType;
      req: NcRequest;
    },
  ) {
    const result = await this.commentsService.commentResolve(context, param);
    return commentBuilder().build(result);
  }

  async commentsCount(
    context: NcContext,
    param: { fk_model_id: string; ids: string[] },
  ) {
    return this.commentsService.commentsCount(context, param);
  }
}
