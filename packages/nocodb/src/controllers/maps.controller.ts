import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { MapUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MapsService } from '~/services/maps.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(GlobalGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('/api/v1/db/meta/maps/:mapViewId')
  @Acl('mapViewGet')
  async mapViewGet(@Param('mapViewId') mapViewId: string) {
    return await this.mapsService.mapViewGet({ mapViewId });
  }

  @Post('/api/v1/db/meta/tables/:tableId/maps')
  @HttpCode(200)
  @Acl('mapViewCreate')
  async mapViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: any,
  ) {
    const view = await this.mapsService.mapViewCreate({
      tableId,
      map: body,
      user: req.user,
    });
    return view;
  }

  @Patch('/api/v1/db/meta/maps/:mapViewId')
  @Acl('mapViewUpdate')
  async mapViewUpdate(
    @Param('mapViewId') mapViewId: string,
    @Body() body: MapUpdateReqType,
  ) {
    return await this.mapsService.mapViewUpdate({
      mapViewId: mapViewId,
      map: body,
    });
  }
}
