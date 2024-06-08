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
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MapsController {
  constructor(private readonly mapsService: MapsService) {}

  @Get(['/api/v1/db/meta/maps/:mapViewId', '/api/v2/meta/maps/:mapViewId'])
  @Acl('mapViewGet')
  async mapViewGet(
    @TenantContext() context: NcContext,
    @Param('mapViewId') mapViewId: string,
  ) {
    return await this.mapsService.mapViewGet(context, { mapViewId });
  }

  @Post([
    '/api/v1/db/meta/tables/:tableId/maps',
    '/api/v2/meta/tables/:tableId/maps',
  ])
  @HttpCode(200)
  @Acl('mapViewCreate')
  async mapViewCreate(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Body() body: ViewCreateReqType,
    @Req() req: NcRequest,
  ) {
    const view = await this.mapsService.mapViewCreate(context, {
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
    @TenantContext() context: NcContext,
    @Param('mapViewId') mapViewId: string,
    @Body() body: MapUpdateReqType,

    @Req() req: NcRequest,
  ) {
    return await this.mapsService.mapViewUpdate(context, {
      mapViewId: mapViewId,
      map: body,
      req,
    });
  }
}
