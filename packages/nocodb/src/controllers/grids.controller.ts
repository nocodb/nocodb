import {
  Body,
  Controller,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { GridsService } from '~/services/grids.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class GridsController {
  constructor(private readonly gridsService: GridsService) {}

  @Post([
    '/api/v1/db/meta/tables/:tableId/grids/',
    '/api/v1/meta/tables/:tableId/grids/',
  ])
  @HttpCode(200)
  @Acl('gridViewCreate')
  async gridViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() _req: any,
  ) {
    const view = await this.gridsService.gridViewCreate({
      grid: body,
      tableId,
    });
    return view;
  }
  @Patch(['/api/v1/db/meta/grids/:viewId', '/api/v1/meta/grids/:viewId'])
  @Acl('gridViewUpdate')
  async gridViewUpdate(@Param('viewId') viewId: string, @Body() body) {
    return await this.gridsService.gridViewUpdate({
      viewId,
      grid: body,
    });
  }
}
