import { Injectable } from '@nestjs/common';
import { AppEvents } from 'nocodb-sdk';
import { Base, Model } from '../models';
import type {
  CommentReqType,
  CommentUpdateReqType,
  UserType,
} from 'nocodb-sdk';
import type { NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { validatePayload } from '~/helpers';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import Comment from '~/models/Comment';

@Injectable()
export class CommentsService {
  constructor(protected readonly appHooksService: AppHooksService) {}

  async commentRow(param: { body: CommentReqType; user: any; req: NcRequest }) {
    validatePayload('swagger.json#/components/schemas/CommentReq', param.body);

    const res = await Comment.insert({
      ...param.body,
      created_by: param.user?.id,
      created_by_email: param.user?.email,
    });

    const model = await Model.getByIdOrName({ id: param.body.fk_model_id });

    this.appHooksService.emit(AppEvents.COMMENT_CREATE, {
      base: await Base.getByTitleOrId(model.base_id),
      model: model,
      user: param.user,
      comment: param.body.comment,
      rowId: param.body.row_id,
      req: param.req,
    });

    return res;
  }

  async commentDelete(param: { commentId: string; user: UserType }) {
    const comment = await Comment.get(param.commentId);

    if (comment.created_by !== param.user.id) {
      NcError.unauthorized('Unauthorized access');
    }

    return await Comment.delete(param.commentId);
  }

  async commentList(param: { query: any }) {
    return await Comment.list(param.query);
  }

  async commentsCount(param: { fk_model_id: string; ids: string[] }) {
    return await Comment.commentsCount({
      fk_model_id: param.fk_model_id as string,
      ids: param.ids as string[],
    });
  }

  async commentUpdate(param: {
    commendId: string;
    user: UserType;
    body: CommentUpdateReqType;
    req: NcRequest;
  }) {
    validatePayload(
      'swagger.json#/components/schemas/CommentUpdateReq',
      param.body,
    );

    const comment = await Comment.get(param.commendId);

    if (comment.created_by !== param.user.id || comment.is_deleted) {
      NcError.unauthorized('Unauthorized access');
    }

    const res = await Comment.update(param.commendId, {
      comment: param.body.comment,
    });

    const model = await Model.getByIdOrName({ id: param.body.fk_model_id });

    this.appHooksService.emit(AppEvents.COMMENT_CREATE, {
      base: await Base.getByTitleOrId(model.base_id),
      model: model,
      user: param.user,
      comment: param.body.comment,
      rowId: comment.row_id,
      req: param.req,
    });

    return res;
  }
}
