import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PublicDatasController as PublicDatasControllerCE } from 'src/controllers/public-datas.controller';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class PublicDatasController extends PublicDatasControllerCE {
  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/bulkAggregate',
    '/api/v2/public/shared-view/:sharedViewUuid/bulkAggregate',
  ])
  async bulkDataAggregate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    const response = await this.publicDatasService.bulkAggregate(context, {
      query: req.query,
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid,
    });

    return response;
  }
}
