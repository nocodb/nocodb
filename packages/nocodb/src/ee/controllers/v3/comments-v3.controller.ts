import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { CommentReqType, CommentUpdateReqType } from 'nocodb-sdk';
import { PlanFeatureTypes } from 'nocodb-sdk';
import { checkForFeature } from '~/ee/helpers/paymentHelpers';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { NcContext, NcRequest } from '~/interface/config';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { CommentsV3Service } from '~/ee/services/v3/comments-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsV3Controller {
  constructor(private readonly commentsV3Service: CommentsV3Service) {}

  @Get(
    `${PREFIX_APIV3_METABASE}/tables/:tableId/records/:rowId/comments`,
  )
  @Acl('commentList')
  async commentList(
    @TenantContext() context: NcContext,
    @Param('rowId') rowId: string,
    @Param('tableId') tableId: string,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return new PagedResponseImpl(
      await this.commentsV3Service.commentList(context, {
        query: {
          row_id: rowId,
          fk_model_id: tableId,
        },
      }),
    );
  }

  @Post(
    `${PREFIX_APIV3_METABASE}/tables/:tableId/records/:rowId/comments`,
  )
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(
    @TenantContext() context: NcContext,
    @Param('rowId') rowId: string,
    @Param('tableId') tableId: string,
    @Req() req: NcRequest,
    @Body() body: CommentReqType,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return await this.commentsV3Service.commentRow(context, {
      user: req.user,
      body: { ...body, row_id: rowId, fk_model_id: tableId },
      req,
    });
  }

  @Patch(`${PREFIX_APIV3_METABASE}/comments/:commentId`)
  @Acl('commentUpdate')
  async commentUpdate(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: NcRequest,
    @Body() body: CommentUpdateReqType,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return await this.commentsV3Service.commentUpdate(context, {
      commentId,
      user: req.user,
      body,
      req,
    });
  }

  @Delete(`${PREFIX_APIV3_METABASE}/comments/:commentId`)
  @Acl('commentDelete')
  async commentDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('commentId') commentId: string,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return await this.commentsV3Service.commentDelete(context, {
      commentId,
      user: req.user,
      req,
    });
  }

  @Post(`${PREFIX_APIV3_METABASE}/comments/:commentId/resolve`)
  @HttpCode(200)
  @Acl('commentResolve')
  async commentResolve(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: NcRequest,
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return await this.commentsV3Service.commentResolve(context, {
      commentId,
      user: req.user,
      req,
    });
  }

  @Get(`${PREFIX_APIV3_METABASE}/tables/:tableId/comments/count`)
  @Acl('commentCount')
  async commentsCount(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Query('ids') ids: string | string[],
  ) {
    await checkForFeature(context, PlanFeatureTypes.FEATURE_API_COMMENT_V3);

    return await this.commentsV3Service.commentsCount(context, {
      fk_model_id: tableId,
      ids: Array.isArray(ids) ? ids : [ids],
    });
  }
}
