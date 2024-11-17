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
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { CommentsService } from '~/services/comments.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsController {
  constructor(protected readonly commentsService: CommentsService) {}

  @Get(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  @Acl('commentList')
  async commentList(@TenantContext() context: NcContext, @Req() req: any) {
    return new PagedResponseImpl(
      await this.commentsService.commentList(context, { query: req.query }),
    );
  }

  @Post(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Body() body: any,
  ) {
    return await this.commentsService.commentRow(context, {
      user: req.user,
      body: body,
      req,
    });
  }

  @Delete([
    '/api/v1/db/meta/comment/:commentId',
    '/api/v2/meta/comment/:commentId',
  ])
  @Acl('commentDelete')
  async commentDelete(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('commentId') commentId: string,
  ) {
    return await this.commentsService.commentDelete(context, {
      commentId,
      user: req.user,
      req,
    });
  }

  @Patch([
    '/api/v1/db/meta/comment/:commentId',
    '/api/v2/meta/comment/:commentId',
  ])
  @Acl('commentUpdate')
  async commentUpdate(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return await this.commentsService.commentUpdate(context, {
      commentId: commentId,
      user: req.user,
      body: body,
      req,
    });
  }

  @Get(['/api/v1/db/meta/comments/count', '/api/v2/meta/comments/count'])
  @Acl('commentsCount')
  async commentsCount(
    @TenantContext() context: NcContext,
    @Query('fk_model_id') fk_model_id: string,
    @Query('ids') ids: string[],
  ) {
    return await this.commentsService.commentsCount(context, {
      fk_model_id,
      ids,
    });
  }
}
