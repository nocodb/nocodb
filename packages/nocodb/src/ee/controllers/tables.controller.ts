import {
  Body,
  Controller,
  Param,
  Post, Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { TableReqType } from 'nocodb-sdk';
import { TablesController as TablesControllerCE } from 'src/controllers/tables.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TablesService } from '~/services/tables.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesController extends TablesControllerCE {
  constructor(private readonly tablesServiceEE: TablesService) {
    super(tablesServiceEE);
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/:sourceId/tables/magic',
    '/api/v2/meta/bases/:baseId/:sourceId/tables/magic',
  ])
  @Acl('tableCreateMagic')
  async tableCreateMagic(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    return await this.tablesServiceEE.tableCreateMagic({
      baseId,
      sourceId,
      title: body.title,
      tableName: body.table_name,
      user: req.user,
      req
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/:sourceId/schema/magic',
    '/api/v2/meta/bases/:baseId/:sourceId/schema/magic',
  ])
  @Acl('schemaMagic')
  async schemaMagic(
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: any,
    @Req() req: any
  ) {
    return await this.tablesServiceEE.schemaMagic({
      baseId: baseId,
      sourceId: sourceId,
      title: body.title,
      schemaName: body.schema_name,
      req
    });
  }
}
