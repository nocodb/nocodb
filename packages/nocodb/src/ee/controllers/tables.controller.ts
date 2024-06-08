import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { TableReqType } from 'nocodb-sdk';
import { TablesController as TablesControllerCE } from 'src/controllers/tables.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TablesService } from '~/services/tables.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

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
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: TableReqType,
    @Req() req: NcRequest,
  ) {
    return await this.tablesServiceEE.tableCreateMagic(context, {
      baseId,
      sourceId,
      title: body.title,
      tableName: body.table_name,
      user: req.user,
      req,
    });
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/:sourceId/schema/magic',
    '/api/v2/meta/bases/:baseId/:sourceId/schema/magic',
  ])
  @Acl('schemaMagic')
  async schemaMagic(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: any,
    @Req() req: NcRequest,
  ) {
    return await this.tablesServiceEE.schemaMagic(context, {
      baseId: baseId,
      sourceId: sourceId,
      title: body.title,
      schemaName: body.schema_name,
      req,
    });
  }
}
