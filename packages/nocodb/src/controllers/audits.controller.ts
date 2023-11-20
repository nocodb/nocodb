import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { AuditsService } from '~/services/audits.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post(['/api/v1/db/meta/audits/comments', '/api/v2/meta/audits/comments'])
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(@Req() req: Request) {
    return await this.auditsService.commentRow({
      user: (req as any).user,
      body: req.body,
    });
  }

  @Post([
    '/api/v1/db/meta/audits/rows/:rowId/update',
    '/api/v2/meta/audits/rows/:rowId/update',
  ])
  @HttpCode(200)
  @Acl('auditRowUpdate')
  async auditRowUpdate(@Param('rowId') rowId: string, @Body() body: any) {
    return await this.auditsService.auditRowUpdate({
      rowId,
      body,
    });
  }

  @Get(['/api/v1/db/meta/audits/comments', '/api/v2/meta/audits/comments'])
  @Acl('commentList')
  async commentList(@Req() req: Request) {
    return new PagedResponseImpl(
      await this.auditsService.commentList({ query: req.query }),
    );
  }

  @Patch([
    '/api/v1/db/meta/audits/:auditId/comment',
    '/api/v2/meta/audits/:auditId/comment',
  ])
  @Acl('commentUpdate')
  async commentUpdate(
    @Param('auditId') auditId: string,
    @Req() req: Request,
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
    '/api/v2/meta/bases/:baseId/audits/',
  ])
  @Acl('auditList')
  async auditList(@Req() req: Request, @Param('baseId') baseId: string) {
    return new PagedResponseImpl(
      await this.auditsService.auditList({
        query: req.query,
        baseId,
      }),
      {
        count: await this.auditsService.auditCount({ baseId }),
        ...req.query,
      },
    );
  }

  @Get([
    '/api/v1/db/meta/audits/comments/count',
    '/api/v2/meta/audits/comments/count',
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
