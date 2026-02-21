import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { MapsController as MapsControllerCE } from 'src/controllers/maps.controller';
import { ViewCreateReqType } from 'nocodb-sdk';
import { Response } from 'express';
import { checkForFeature, PlanFeatureTypes } from '~/helpers/paymentHelpers';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcContext, NcRequest } from '~/interface/config';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
export class MapsController extends MapsControllerCE {
  @Get([
    '/api/v1/bases/:baseId/maptile/:z/:x/:y.png',
    '/api/v1/db/public/shared-view/:sharedViewUuid/maptile/:z/:x/:y.png',
  ])
  async getMapTile(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('z') z: string,
    @Param('x') x: string,
    @Param('y') y: string,
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    await this.mapsService.proxyMapTile(context, {
      z,
      x,
      y,
      res,
    });
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
    await checkForFeature(context, PlanFeatureTypes.FEATURE_MAP_VIEW);

    return super.mapViewCreate(context, tableId, body, req);
  }
}
