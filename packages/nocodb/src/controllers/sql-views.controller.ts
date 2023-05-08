import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { Acl } from '../middlewares/extract-project-id/extract-project-id.middleware';
import { SqlViewsService } from '../services/sql-views.service';
import { GlobalGuard } from '../guards/global/global.guard';

@Controller()
@UseGuards(GlobalGuard)
export class SqlViewsController {
  constructor(private readonly sqlViewsService: SqlViewsService) {}

  @Post('/api/v1/db/meta/projects/:projectId/bases/:baseId/sqlView')
  @Acl('sqlViewCreate')
  async sqlViewCreate(
    @Param('projectId') projectId: string,
    @Param('baseId') baseId: string,
    @Request() req,
    @Body() body,
  ) {
    const table = await this.sqlViewsService.sqlViewCreate({
      clientIp: (req as any).clientIp,
      body,
      projectId,
      baseId,
      user: (req as any).user,
    });
    return table;
  }
}
