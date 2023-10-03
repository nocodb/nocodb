import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { AuditsService } from '~/services/audits.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post(['/api/v1/db/meta/audits/comments', '/api/v1/meta/audits/comments'])
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(@Request() req) {
    return await this.auditsService.commentRow({
      user: (req as any).user,
      body: req.body,
    });
  }

  @Post([
    '/api/v1/db/meta/audits/rows/:rowId/update',
    '/api/v1/meta/audits/rows/:rowId/update',
  ])
  @HttpCode(200)
  @Acl('auditRowUpdate')
  async auditRowUpdate(@Param('rowId') rowId: string, @Body() body: any) {
    return await this.auditsService.auditRowUpdate({
      rowId,
      body,
    });
  }

  @Get(['/api/v1/db/meta/audits/comments', '/api/v1/meta/audits/comments'])
  @Acl('commentList')
  async commentList(@Request() req) {
    return new PagedResponseImpl(
      await this.auditsService.commentList({ query: req.query }),
    );
  }

  @Patch([
    '/api/v1/db/meta/audits/:auditId/comment',
    '/api/v1/meta/audits/:auditId/comment',
  ])
  @Acl('commentUpdate')
  async commentUpdate(
    @Param('auditId') auditId: string,
    @Request() req,
    @Body() body: any,
  ) {
    return await this.auditsService.commentUpdate({
      auditId,
      userEmail: req.user?.email,
      body: body,
    });
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/audits/',
    '/api/v1/meta/bases/:baseId/audits/',
  ])
  @Acl('auditList')
  async auditList(@Request() req, @Param('baseId') baseId: string) {
    return new PagedResponseImpl(
      await this.auditsService.auditList({
        query: req.query,
        baseId,
      }),
      {
        count: this.auditsService.auditCount({ baseId }),
        ...req.query,
      },
    );
  }

  @Get([
    '/api/v1/db/meta/audits/comments/count',
    '/api/v1/meta/audits/comments/count',
  ])
  @Acl('commentsCount')
  async commentsCount(
    @Query('fk_model_id') fk_model_id: string,
    @Query('ids') ids: string[],
  ) {
    return await this.auditsService.commentsCount({
      fk_model_id,
      ids,
    });
  }
}
