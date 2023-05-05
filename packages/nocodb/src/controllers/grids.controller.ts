import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { AuthGuard } from '@nestjs/passport';
import { GlobalGuard } from '../guards/global/global.guard';
import {
  Acl,
  ExtractProjectIdMiddleware,
} from '../middlewares/extract-project-id/extract-project-id.middleware';
import { GridsService } from '../services/grids.service';

@Controller()
@UseGuards(ExtractProjectIdMiddleware, GlobalGuard)
export class GridsController {
  get '/api/v1/db/meta/tables/:tableId/grids/'() {
    return this['_/api/v1/db/meta/tables/:tableId/grids/'];
  }
  constructor(private readonly gridsService: GridsService) {}

  @Post('/api/v1/db/meta/tables/:tableId/grids/')
  @HttpCode(200)
  @Acl('gridViewCreate')
  async gridViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
  ) {
    const view = await this.gridsService.gridViewCreate({
      grid: body,
      tableId,
    });
    return view;
  }
  @Patch('/api/v1/db/meta/grids/:viewId')
  async gridViewUpdate(@Param('viewId') viewId: string, @Body() body) {
    return await this.gridsService.gridViewUpdate({
      viewId,
      grid: body,
    });
  }
}
