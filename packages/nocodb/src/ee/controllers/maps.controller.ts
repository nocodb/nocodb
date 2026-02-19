import { Body, Controller, HttpCode, Param, Post, Req } from '@nestjs/common';
import type { ViewCreateReqType } from 'nocodb-sdk';
import { MapsController as MapsControllerCE } from 'src/controllers/maps.controller';
import {
  checkForFeature,
  PlanFeatureTypes,
} from '~/helpers/paymentHelpers';
import { MapsService } from '~/services/maps.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { NcContext, NcRequest } from '~/interface/config';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
export class MapsController extends MapsControllerCE {
  constructor(private readonly mapsServiceEE: MapsService) {
    super(mapsServiceEE);
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
