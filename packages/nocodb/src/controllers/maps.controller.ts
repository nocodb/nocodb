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
import { Request } from 'express';
import { MapUpdateReqType, ViewCreateReqType } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MapsService } from '~/services/maps.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get(['/api/v1/db/meta/maps/:mapViewId', '/api/v2/meta/maps/:mapViewId'])
  @Acl('mapViewGet')
  async mapViewGet(@Param('mapViewId') mapViewId: string) {
    return await this.mapsService.mapViewGet({ mapViewId });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/maps',
    '/api/v2/meta/tables/:tableId/maps',
  ])
  @HttpCode(200)
  @Acl('mapViewCreate')
  async mapViewCreate(
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: Request,
  ) {
    const view = await this.mapsService.mapViewCreate({
      tableId,
      map: body,
      user: req.user,
      req,
    });
    return view;
  }

  @Patch(['/api/v1/db/meta/maps/:mapViewId', '/api/v2/meta/maps/:mapViewId'])
  @Acl('mapViewUpdate')
  async mapViewUpdate(
    @Param('mapViewId') mapViewId: string,
    @Body() body: MapUpdateReqType,

    @Req() req: Request,
  ) {
    return await this.mapsService.mapViewUpdate({
      mapViewId: mapViewId,
      map: body,
      req,
    });
  }
}
