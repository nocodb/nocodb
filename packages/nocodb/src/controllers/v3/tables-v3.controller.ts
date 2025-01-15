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
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  extractRolesObj,
  TableCreateV3Type,
  TableUpdateV3Type,
} from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { TablesV3Service } from '~/services/v3/tables-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesV3Controller {
  constructor(private readonly tablesV3Service: TablesV3Service) {}

  @Get('/api/v3/meta/bases/:baseId/tables')
  @Acl('tableList')
  async tableList(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Query('includeM2M') includeM2M: string,
    @Request() req,
  ) {
    return new PagedResponseImpl(
      await this.tablesV3Service.getAccessibleTables(context, {
        baseId,
        sourceId,
        includeM2M: includeM2M === 'true',
        roles: extractRolesObj(req.user.base_roles),
      }),
    );
  }

  @Post('/api/v3/meta/bases/:baseId/tables')
  @HttpCode(200)
  @Acl('tableCreate')
  async tableCreate(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Body() body: TableCreateV3Type,
    @Request() req,
  ) {
    const result = await this.tablesV3Service.tableCreate(context, {
      baseId: baseId,
      sourceId: sourceId,
      table: body,
      user: req.user,
    });

    return result;
  }

  @Get('/api/v3/meta/tables/:tableId')
  @Acl('tableGet')
  async tableGet(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Request() req,
  ) {
    const table = await this.tablesV3Service.getTableWithAccessibleViews(
      context,
      {
        tableId,
        user: req.user,
      },
    );

    return table;
  }

  @Patch('/api/v3/meta/tables/:tableId')
  @Acl('tableUpdate')
  async tableUpdate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: TableUpdateV3Type,
    @Request() req,
  ) {
    return await this.tablesV3Service.tableUpdate(context, {
      tableId: tableId,
      table: body,
      baseId: req.ncBaseId,
      user: req.user,
      req,
    });
  }

  @Delete('/api/v3/meta/tables/:tableId')
  @Acl('tableDelete')
  async tableDelete(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Request() req,
  ) {
    const result = await this.tablesV3Service.tableDelete(context, {
      tableId,
      user: (req as any).user,
      req,
    });

    return result;
  }
}
