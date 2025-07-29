import { Controller, Get, Param, Req } from '@nestjs/common';
import { PublicMetasController as PublicMetasControllerCE } from 'src/controllers/public-metas.controller';
import { PublicMetasService } from '~/services/public-metas.service';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
@Controller()
export class PublicMetasController extends PublicMetasControllerCE {
  constructor(protected readonly publicMetasService: PublicMetasService) {
    super(publicMetasService);
  }

  @Get(['/api/v2/db/public/shared-dashboard/:sharedDashboardUuid/meta'])
  async dashboardMetaGet(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('sharedDashboardUuid') sharedDashboardUuid: string,
  ) {
    return await this.publicMetasService.dashboardMetaGet(context, {
      password: req.headers?.['xc-password'] as string,
      sharedDashboardUuid: sharedDashboardUuid,
    });
  }
}
