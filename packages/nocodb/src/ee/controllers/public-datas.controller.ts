import { Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { PublicDatasController as PublicDatasControllerCE } from 'src/controllers/public-datas.controller';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class PublicDatasController extends PublicDatasControllerCE {
  @Post([
    '/api/v1/db/public/shared-view/:sharedViewUuid/bulk/aggregate',
    '/api/v2/public/shared-view/:sharedViewUuid/bulk/aggregate',
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
      body: req.body,
    });

    return response;
  }
}
