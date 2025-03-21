import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { CommentsV3Service } from '~/services/v3/comments-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsV3Controller {
  constructor(protected readonly commentsV3Service: CommentsV3Service) {}

  @Get(`${PREFIX_APIV3_METABASE}/tables/:tableId/records/:rowId/comments`)
  @Acl('commentList')
  async commentList(
    @TenantContext() context: NcContext,
    @Req() req: any,
    @Param('rowId') rowId: string,
    @Param('tableId') tableId: string,
  ) {
    return new PagedResponseImpl(
      await this.commentsV3Service.commentList(context, {
        query: {
          row_id: rowId,
          fk_model_id: tableId,
        },
      }),
    );
  }

  @Post(`${PREFIX_APIV3_METABASE}/tables/:tableId/records/:rowId/comments`)
  @Acl('commentRow')
  async commentRow(
    @TenantContext() context: NcContext,
    @Param('rowId') rowId: string,
    @Param('tableId') tableId: string,
    @Req() req: NcRequest,
    @Body() body: any,
  ) {
    return await this.commentsV3Service.commentRow(context, {
      user: req.user,
      body: { ...body, row_id: rowId, fk_model_id: tableId },
      req,
    });
  }

  @Delete(`${PREFIX_APIV3_METABASE}/comment/:commentId`)
  @Acl('commentDelete')
  async commentDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('commentId') commentId: string,
  ) {
    return await this.commentsV3Service.commentDelete(context, {
      commentId,
      user: req.user,
      req,
    });
  }

  @Patch(`${PREFIX_APIV3_METABASE}/comment/:commentId`)
  @Acl('commentUpdate')
  async commentUpdate(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return await this.commentsV3Service.commentUpdate(context, {
      commentId: commentId,
      user: req.user,
      body: body,
      req,
    });
  }
}
