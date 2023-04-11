import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { GridColumnReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../../middlewares/extract-project-id/extract-project-id.middleware';
import { GridColumnsService } from './grid-columns.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, AuthGuard('jwt'))
export class GridColumnsController {
  constructor(private readonly gridColumnsService: GridColumnsService) {}

  @Get('/api/v1/db/meta/grids/:gridViewId/grid-columns')
  @Acl('columnList')
  async columnList(@Param('gridViewId') gridViewId: string) {
    return await this.gridColumnsService.columnList({
      gridViewId,
    });
  }
  @Patch('/api/v1/db/meta/grid-columns/:gridViewColumnId')
  @Acl('gridColumnUpdate')
  async gridColumnUpdate(
    @Param('gridViewColumnId') gridViewColumnId: string,
    @Body() body: GridColumnReqType,
  ) {
    return this.gridColumnsService.gridColumnUpdate({
      gridViewColumnId,
      grid: body,
    });
  }
}
