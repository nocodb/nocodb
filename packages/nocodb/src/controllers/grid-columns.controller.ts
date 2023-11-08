import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { GridColumnReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { GridColumnsService } from '~/services/grid-columns.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class GridColumnsController {
  constructor(private readonly gridColumnsService: GridColumnsService) {}

  @Get([
    '/api/v1/db/meta/grids/:gridViewId/grid-columns',
    '/api/v2/meta/grids/:gridViewId/grid-columns',
  ])
  @Acl('columnList')
  async columnList(@Param('gridViewId') gridViewId: string) {
    return await this.gridColumnsService.columnList({
      gridViewId,
    });
  }
  @Patch([
    '/api/v1/db/meta/grid-columns/:gridViewColumnId',
    '/api/v2/meta/grid-columns/:gridViewColumnId',
  ])
  @Acl('gridColumnUpdate')
  async gridColumnUpdate(
    @Param('gridViewColumnId') gridViewColumnId: string,
    @Body() body: GridColumnReqType,

    @Req() req: Request,
  ) {
    return this.gridColumnsService.gridColumnUpdate({
      gridViewColumnId,
      grid: body,
      req,
    });
  }
}
