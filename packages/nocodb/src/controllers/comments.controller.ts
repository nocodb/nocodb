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
import { NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  @Acl('commentList')
  async commentList(@Req() req: any) {
    return new PagedResponseImpl(
      await this.commentsService.commentList({ query: req.query }),
    );
  }

  @Post(['/api/v1/db/meta/comments', '/api/v2/meta/comments'])
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(@Req() req: NcRequest, @Body() body: any) {
    return await this.commentsService.commentRow({
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
    @Req() req: NcRequest,
    @Param('commentId') commentId: string,
  ) {
    return await this.commentsService.commentDelete({
      commentId,
      user: req.user,
    });
  }

  @Patch([
    '/api/v1/db/meta/comment/:commentId',
    '/api/v2/meta/comment/:commentId',
  ])
  @Acl('commentUpdate')
  async commentUpdate(
    @Param('commentId') commentId: string,
    @Req() req: any,
    @Body() body: any,
  ) {
    return await this.commentsService.commentUpdate({
      commentId: commentId,
      user: req.user,
      body: body,
      req,
    });
  }

  @Get(['/api/v1/db/meta/comments/count', '/api/v2/meta/comments/count'])
  @Acl('commentsCount')
  async commentsCount(
    @Query('fk_model_id') fk_model_id: string,
    @Query('ids') ids: string[],
  ) {
    return await this.commentsService.commentsCount({
      fk_model_id,
      ids,
    });
  }
}
