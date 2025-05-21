import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { PublicMetasService } from '~/services/public-metas.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@UseGuards(PublicApiLimiterGuard)
@Controller()
export class PublicMetasController {
  constructor(private readonly publicMetasService: PublicMetasService) {}

  @Get([
    '/api/v1/db/public/shared-view/:sharedViewUuid/meta',
    '/api/v2/public/shared-view/:sharedViewUuid/meta',
  ])
  async viewMetaGet(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedViewUuid') sharedViewUuid: string,
  ) {
    return await this.publicMetasService.viewMetaGet(context, {
      password: req.headers?.['xc-password'] as string,
      sharedViewUuid: sharedViewUuid,
    });
  }

  @Get([
    '/api/v1/db/public/shared-base/:sharedBaseUuid/meta',
    '/api/v2/public/shared-base/:sharedBaseUuid/meta',
  ])
  async publicSharedBaseGet(
    @TenantContext() context: NcContext,
    @Param('sharedBaseUuid') sharedBaseUuid: string,
  ): Promise<any> {
    return await this.publicMetasService.publicSharedBaseGet(context, {
      sharedBaseUuid,
    });
  }
}
