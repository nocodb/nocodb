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
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import { PagedResponseImpl } from '../helpers/PagedResponse';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { Audit } from '../models';
import { AuditsService } from '../services/audits.service';
import { ExtractProjectAndWorkspaceIdMiddleware } from '../middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, GlobalGuard)
export class AuditsController {
  constructor(private readonly auditsService: AuditsService) {}

  @Post('/api/v1/db/meta/audits/comments')
  @HttpCode(200)
  @Acl('commentRow')
  async commentRow(@Request() req) {
    return await this.auditsService.commentRow({
      user: (req as any).user,
      body: req.body,
    });
  }

  @Post('/api/v1/db/meta/audits/rows/:rowId/update')
  @HttpCode(200)
  @Acl('auditRowUpdate')
  async auditRowUpdate(@Param('rowId') rowId: string, @Body() body: any) {
    return await this.auditsService.auditRowUpdate({
      rowId,
      body,
    });
  }

  @Get('/api/v1/db/meta/audits/comments')
  @Acl('commentList')
  async commentList(@Request() req) {
    return new PagedResponseImpl(
      await this.auditsService.commentList({ query: req.query }),
    );
  }

  @Patch('/api/v1/db/meta/audits/:auditId/comment')
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

  @Get('/api/v1/db/meta/projects/:projectId/audits')
  @Acl('auditList')
  async auditList(@Request() req, @Param('projectId') projectId: string) {
    return new PagedResponseImpl(
      await this.auditsService.auditList({
        query: req.query,
        projectId,
      }),
      {
        count: await Audit.projectAuditCount(projectId),
        ...req.query,
      },
    );
  }

  @Get('/api/v1/db/meta/audits/comments/count')
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
