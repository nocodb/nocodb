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
import { PageDao } from '~/daos/page.dao';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { DocsPageHistoryService } from '~/services/docs/history/docs-page-history.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, AuthGuard('jwt'))
export class DocsPagesHistoryController {
  constructor(
    private readonly pageDao: PageDao,
    private readonly pagesHistoryService: DocsPageHistoryService,
  ) {}

  @Get('/api/v1/docs/:baseId/pages/:pageId/history')
  @Acl('pageHistoryList')
  async list(
    @Param('pageId') pageId: string,
    @Param('baseId') baseId: string,
    @Query('pageNumber') pageNumber: number,
    @Query('pageSize') pageSize: number,
  ) {
    return await this.pagesHistoryService.list({
      pageId,
      baseId,
      pageNumber,
      pageSize,
    });
  }

  @Post('/api/v1/docs/:baseId/pages/:pageId/history/sync')
  @Acl('pageHistorySync')
  async sync(
    @Param('pageId') pageId: string,
    @Param('baseId') baseId: string,
    @Req() req: Request,
  ) {
    const page = await this.pageDao.get({
      id: pageId,
      baseId,
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

  @Post('/api/v1/docs/:baseId/pages/:pageId/history/:snapshotId/restore')
  @Acl('pageHistoryRestore')
  async restore(
    @Param('pageId') pageId: string,
    @Param('baseId') baseId: string,
    @Param('snapshotId') snapshotId: string,
    @Req() req: Request,
  ) {
    return await this.pagesHistoryService.restore({
      pageId,
      baseId,
      user: req.user,
      snapshotId: snapshotId,
      workspaceId: req.ncWorkspaceId,
    });
  }
}
