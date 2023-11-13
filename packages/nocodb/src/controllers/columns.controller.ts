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
import { Request } from 'express';
import { ColumnReqType } from 'nocodb-sdk';
import type { Column } from '~/models';
import { GlobalGuard } from '~/guards/global/global.guard';
import { ColumnsService } from '~/services/columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class ColumnsController {
  constructor(private readonly columnsService: ColumnsService) {}

  @Post([
    '/api/v1/db/meta/tables/:tableId/columns/',
    '/api/v2/meta/tables/:tableId/columns/',
  ])
  @HttpCode(200)
  @Acl('columnAdd')
  async columnAdd(
    @Param('tableId') tableId: string,
    @Body() body: ColumnReqType,
    @Req() req: Request,
  ) {
    return await this.columnsService.columnAdd({
      tableId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Patch([
    '/api/v1/db/meta/columns/:columnId',
    '/api/v2/meta/columns/:columnId',
  ])
  @Acl('columnUpdate')
  async columnUpdate(
    @Param('columnId') columnId: string,
    @Body() body: ColumnReqType,
    @Req() req: Request,
  ) {
    return await this.columnsService.columnUpdate({
      columnId: columnId,
      column: body,
      req,
      user: req.user,
    });
  }

  @Delete([
    '/api/v1/db/meta/columns/:columnId',
    '/api/v2/meta/columns/:columnId',
  ])
  @Acl('columnDelete')
  async columnDelete(@Param('columnId') columnId: string, @Req() req: Request) {
    return await this.columnsService.columnDelete({
      columnId,
      req,
      user: req.user,
    });
  }

  @Get(['/api/v1/db/meta/columns/:columnId', '/api/v2/meta/columns/:columnId'])
  @Acl('columnGet')
  async columnGet(@Param('columnId') columnId: string) {
    return await this.columnsService.columnGet({ columnId });
  }

  @Post([
    '/api/v1/db/meta/columns/:columnId/primary',
    '/api/v2/meta/columns/:columnId/primary',
  ])
  @HttpCode(200)
  @Acl('columnSetAsPrimary')
  async columnSetAsPrimary(@Param('columnId') columnId: string) {
    return await this.columnsService.columnSetAsPrimary({ columnId });
  }

  @Get([
    '/api/v1/db/meta/tables/:tableId/columns/hash',
    '/api/v2/meta/tables/:tableId/columns/hash',
  ])
  @Acl('columnsHash')
  async columnsHash(@Param('tableId') tableId: string) {
    return await this.columnsService.columnsHash(tableId);
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/columns/bulk',
    '/api/v2/meta/tables/:tableId/columns/bulk',
  ])
  @HttpCode(200)
  @Acl('columnBulk')
  async columnBulk(
    @Param('tableId') tableId: string,
    @Body()
    body: {
      hash: string;
      ops: {
        op: 'add' | 'update' | 'delete';
        column: Partial<Column>;
      }[];
    },
    @Req() req: Request,
  ) {
    return await this.columnsService.columnBulk(tableId, body, req);
  }
}
