import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ExtractProjectAndWorkspaceIdMiddleware } from 'src/middlewares/extract-project-and-workspace-id/extract-project-and-workspace-id.middleware';
import { UseAclMiddleware } from 'src/middlewares/extract-project-id/extract-project-id.middleware';
import { DocsPageHistoryService } from 'src/services/docs/history/docs-page-history.service';

@Controller()
@UseGuards(ExtractProjectAndWorkspaceIdMiddleware, AuthGuard('jwt'))
export class DocsPagesHistoryController {
  constructor(private readonly pagesHistoryService: DocsPageHistoryService) {}

  @Get('/api/v1/docs/project/:projectId/page/:pageId/history')
  @UseAclMiddleware({
    permissionName: 'pageHistoryList',
  })
  async list(
    @Param('pageId') pageId: string,
    @Param('projectId') projectId: string,
    @Query('pageNumber') pageNumber: number,
    @Query('pageSize') pageSize: number,
  ) {
    return await this.pagesHistoryService.list({
      pageId,
      projectId,
      pageNumber,
      pageSize,
    });
  }

  @Post(
    '/api/v1/docs/project/:projectId/page/:pageId/history/:snapshotId/restore',
  )
  @UseAclMiddleware({
    permissionName: 'pageHistoryRestore',
  })
  async restore(
    @Param('pageId') pageId: string,
    @Param('projectId') projectId: string,
    @Param('snapshotId') snapshotId: string,
    @Request() req,
  ) {
    return await this.pagesHistoryService.restore({
      pageId,
      projectId,
      user: req.user,
      snapshotId: snapshotId,
      workspaceId: req.ncWorkspaceId,
    });
  }
}
