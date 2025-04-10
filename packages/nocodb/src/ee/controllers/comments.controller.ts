import { Controller, Param, Post, Req } from '@nestjs/common';
import { CommentsController as CommentsControllerCE } from 'src/controllers/comments.controller';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { CommentsService } from '~/services/comments.service';
import { NcContext } from '~/interface/config';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
export class CommentsController extends CommentsControllerCE {
  constructor(protected readonly commentsService: CommentsService) {
    super(commentsService);
  }

  @Post(['/api/v2/meta/comment/:commentId/resolve'])
  @Acl('commentUpdate')
  async commentResolve(
    @TenantContext() context: NcContext,
    @Param('commentId') commentId: string,
    @Req() req: any,
  ) {
    return await this.commentsService.commentResolve(context, {
      commentId: commentId,
      user: req.user,
      req,
    });
  }
}
