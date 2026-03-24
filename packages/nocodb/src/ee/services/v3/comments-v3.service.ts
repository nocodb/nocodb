import { Injectable } from '@nestjs/common';
import { CommentsV3Service as CommentsV3ServiceCE } from 'src/services/v3/comments-v3.service';
import type { CommentReqType, CommentUpdateReqType, UserType } from 'nocodb-sdk';
import type { NcContext, NcRequest } from '~/interface/config';
import { validatePayload } from '~/helpers';
import { CommentsService } from '~/services/comments.service';
import { builderGenerator } from '~/utils/api-v3-data-transformation.builder';

@Injectable()
export class CommentsV3Service extends CommentsV3ServiceCE {
  protected builder = builderGenerator({
    allowed: [
      'id',
      'row_id',
      'fk_model_id',
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
    mappings: {
      row_id: 'record_id',
      fk_model_id: 'table_id',
    },
    transformFn: (data: Record<string, unknown>) => ({
      ...data,
      is_deleted: data.is_deleted ?? false,
    }),
  });

  constructor(protected readonly commentsService: CommentsService) {
    super(commentsService);
  }

  async commentRow(
    context: NcContext,
    param: {
      body: CommentReqType;
      user: UserType;
      req: NcRequest;
    },
  ) {
    validatePayload(
      'swagger-v3.json#/components/schemas/CommentCreateRequest',
      param.body,
    );

    const result = await this.commentsService.commentRow(context, param);
    return this.builder().build(result);
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
    return this.builder().build(result);
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
      'swagger-v3.json#/components/schemas/CommentUpdateRequest',
      param.body,
    );

    const result = await this.commentsService.commentUpdate(context, param);
    return this.builder().build(result as any);
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
    return this.builder().build(result as any);
  }

  async commentsCount(
    context: NcContext,
    param: { fk_model_id: string; ids: string[] },
  ) {
    const result = await this.commentsService.commentsCount(context, param);
    return result.map((r: Record<string, unknown>) => ({
      record_id: r.row_id,
      count: r.count,
    }));
  }
}
