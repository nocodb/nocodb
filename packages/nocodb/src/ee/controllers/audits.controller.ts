import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { AuditsController as AuditsControllerCE } from 'src/controllers/audits.controller';
import { OrgUserRoles } from 'nocodb-sdk';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { AuditsService } from '~/services/audits.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsController extends AuditsControllerCE {
  constructor(protected readonly auditsService: AuditsService) {
    super(auditsService);
  }

  @Get(['/api/v2/meta/workspace/:workspaceId/audits/'])
  @Acl('workspaceAuditList')
  async workspaceAuditList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('workspaceId') workspaceId: string,
  ) {
    return new PagedResponseImpl(
      await this.auditsService.workspaceAuditList({
        query: req.query,
        workspaceId,
      }),
      {
        count: await this.auditsService.workspaceAuditCount({
          query: req.query,
          workspaceId,
        }),
        ...req.query,
      },
    );
  }

  @Get(['/api/v2/meta/audits/'])
  @Acl('globalAuditList', {
    scope: 'org',
    allowedRoles: [OrgUserRoles.SUPER_ADMIN],
    blockApiTokenAccess: true,
  })
  async globalAuditList(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
  ) {
    return new PagedResponseImpl(
      await this.auditsService.globalAuditList({
        query: req.query,
      }),
      {
        count: await this.auditsService.globalAuditCount({
          query: req.query,
        }),
        ...req.query,
      },
    );
  }
}
