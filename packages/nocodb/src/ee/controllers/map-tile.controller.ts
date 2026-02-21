import {
  Controller,
  Get,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { Response } from 'express';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MapsService } from '~/services/maps.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MapTileController {
  constructor(private readonly mapsService: MapsService) {}

  @Get('/api/v1/bases/:baseId/maptile')
  async getMapTile(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Query('z') z: string,
    @Query('x') x: string,
    @Query('y') y: string,
    @Query('tableId') tableId: string | undefined,
    @Req() req: NcRequest,
    @Res() res: Response,
  ) {
    await this.mapsService.proxyMapTile(context, {
      z,
      x,
      y,
      tableId,
      res,
    });
  }
}
