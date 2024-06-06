import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { CommentsController as CommentsControllerCE } from 'src/controllers/comments.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { CommentsService } from '~/services/comments.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class CommentsController extends CommentsControllerCE {
  constructor(protected readonly commentsService: CommentsService) {
    super(commentsService);
  }

  @Post(['/api/v2/meta/comment/:commentId/resolve'])
  @Acl('commentUpdate')
  async commentResolve(@Param('commentId') commentId: string, @Req() req: any) {
    return await this.commentsService.commentResolve({
      commentId: commentId,
      user: req.user,
      req,
    });
  }
}
