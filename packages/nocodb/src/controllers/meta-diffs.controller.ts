import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MetaDiffsController {
  constructor(private readonly metaDiffsService: MetaDiffsService) {}

  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff',
    '/api/v2/meta/bases/:baseId/meta-diff',
  ])
  @Acl('metaDiff', {
    blockApiTokenAccess: true,
  })
  async metaDiff(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
  ) {
    return await this.metaDiffsService.metaDiff(context, { baseId });
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/meta-diff/:sourceId',
    '/api/v2/meta/bases/:baseId/meta-diff/:sourceId',
  ])
  @Acl('metaDiff', {
    blockApiTokenAccess: true,
  })
  async baseMetaDiff(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Param('sourceId') sourceId: string,
    @Req() req: NcRequest,
  ) {
    return await this.metaDiffsService.baseMetaDiff(context, {
      sourceId,
      baseId,
      user: req.user,
    });
  }
}
