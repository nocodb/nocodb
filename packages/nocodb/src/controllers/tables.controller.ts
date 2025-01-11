import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Request,
  UseGuards,
} from '@nestjs/common';
import { extractRolesObj, NcRequest, TableReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TablesService } from '~/services/tables.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/tables',
    '/api/v1/db/meta/projects/:baseId/:sourceId/tables',
    '/api/v2/meta/bases/:baseId/tables',
    '/api/v2/meta/bases/:baseId/:sourceId/tables',
  ])
  @Acl('tableList')
  async tableList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Query('includeM2M') includeM2M: string,
    @Request() req,
  ) {
    return new PagedResponseImpl(
      await this.tablesService.getAccessibleTables(context, {
        baseId,
        sourceId,
        includeM2M: includeM2M === 'true',
        roles: extractRolesObj(req.user.base_roles),
      }),
    );
  }

  @Post([
    '/api/v1/db/meta/projects/:baseId/tables',
    '/api/v1/db/meta/projects/:baseId/:sourceId/tables',
    '/api/v2/meta/bases/:baseId/tables',
    '/api/v2/meta/bases/:baseId/:sourceId/tables',
  ])
  @HttpCode(200)
  @Acl('tableCreate')
  async tableCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    const result = await this.tablesService.tableCreate(context, {
      baseId: baseId,
      sourceId: sourceId,
      table: body,
      user: req.user,
      req,
    });

    return result;
  }

  @Get(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  @Acl('tableGet')
  async tableGet(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Request() req,
  ) {
    const table = await this.tablesService.getTableWithAccessibleViews(
      context,
      {
        tableId: req.params.tableId,
        user: req.user,
      },
    );

    return table;
  }

  @Patch(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  @Acl('tableUpdate')
  async tableUpdate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: TableReqType,
    @Request() req,
  ) {
    await this.tablesService.tableUpdate(context, {
      tableId: tableId,
      table: body,
      baseId: req.ncBaseId,
      user: req.ncBaseId,
      req,
    });
    return { msg: 'The table has been updated successfully' };
  }

  @Delete(['/api/v1/db/meta/tables/:tableId', '/api/v2/meta/tables/:tableId'])
  @Acl('tableDelete')
  async tableDelete(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Request() req,
  ) {
    const result = await this.tablesService.tableDelete(context, {
      tableId: req.params.tableId,
      user: (req as any).user,
      req,
    });

    return result;
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/reorder',
    '/api/v2/meta/tables/:tableId/reorder',
  ])
  @Acl('tableReorder')
  @HttpCode(200)
  async tableReorder(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: { order: number },
    @Req() req: NcRequest,
  ) {
    return this.tablesService.reorderTable(context, {
      tableId,
      order: body.order,
      req,
    });
  }
}
