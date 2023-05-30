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
import { PageDao } from '../../daos/page.dao';
import { UseAclMiddleware } from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { DocsPageHistoryService } from '../../services/docs/history/docs-page-history.service';

@Controller()
@UseGuards(AuthGuard('jwt'))
export class DocsPagesHistoryController {
  constructor(
    private readonly pageDao: PageDao,
    private readonly pagesHistoryService: DocsPageHistoryService,
  ) {}

  @Get('/api/v1/docs/:projectId/pages/:pageId/history')
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

  @Post('/api/v1/docs/:projectId/pages/:pageId/history/sync')
  @UseAclMiddleware({
    permissionName: 'pageHistorySync',
  })
  async sync(
    @Param('pageId') pageId: string,
    @Param('projectId') projectId: string,
    @Request() req,
  ) {
    const page = await this.pageDao.get({
      id: pageId,
      projectId,
    });
    if (!page) throw new Error('Page not found');

    if (!(await this.pagesHistoryService.snapshotTimeWindowExpired({ page }))) {
      return;
    }

    return await this.pagesHistoryService.maybeInsert({
      newPage: page,
      workspaceId: req.ncWorkspaceId,
    });
  }

  @Post('/api/v1/docs/:projectId/pages/:pageId/history/:snapshotId/restore')
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
