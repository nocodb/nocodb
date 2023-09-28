import {
  Body,
  Controller,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { SqlViewsService } from '~/services/sql-views.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class SqlViewsController {
  constructor(private readonly sqlViewsService: SqlViewsService) {}

  @Post([
    '/api/v1/db/meta/projects/:baseId/bases/:sourceId/sqlView',
    '/api/v1/meta/bases/:baseId/sources/:sourceId/sqlView',
  ])
  @Acl('sqlViewCreate')
  async sqlViewCreate(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Request() req,
    @Body() body,
  ) {
    const table = await this.sqlViewsService.sqlViewCreate({
      clientIp: (req as any).clientIp,
      body,
      baseId,
      sourceId,
      user: (req as any).user,
    });
    return table;
  }
}
