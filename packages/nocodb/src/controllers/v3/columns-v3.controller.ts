import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FieldUpdateV3Type, FieldV3Type } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { ColumnsV3Service } from '~/services/v3/columns-v3.service';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ColumnsV3Controller {
  constructor(private readonly columnsV3Service: ColumnsV3Service) {}

  @Post(['/api/v3/meta/tables/:tableId/fields/'])
  @HttpCode(200)
  @Acl('columnAdd')
  async columnAdd(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: FieldV3Type,
    @Req() req: NcRequest,
  ) {
    return await this.columnsV3Service.columnAdd(context, {
      tableId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Patch(['/api/v3/meta/fields/:columnId'])
  @Acl('columnUpdate')
  async columnUpdate(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
    @Body() body: FieldUpdateV3Type,
    @Req() req: NcRequest,
  ) {
    return await this.columnsV3Service.columnUpdate(context, {
      columnId: columnId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Delete(['/api/v3/meta/fields/:columnId'])
  @Acl('columnDelete')
  async columnDelete(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
    @Req() req: NcRequest,
  ) {
    return await this.columnsV3Service.columnDelete(context, {
      columnId,
      req,
      user: req.user,
    });
  }

  @Get(['/api/v3/meta/fields/:columnId'])
  @Acl('columnGet')
  async columnGet(
    @TenantContext() context: NcContext,
    @Param('columnId') columnId: string,
  ) {
    return await this.columnsV3Service.columnGet(context, { columnId });
  }
}
