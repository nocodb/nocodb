import {
  Controller,
  Get,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditsController as AuditsControllerCE } from 'src/controllers/audits.controller';
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

  @Get(['/api/v2/meta/workspaces/:workspaceId/audits/'])
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
        count: await this.auditsService.workspaceAuditCount({ workspaceId }),
        ...req.query,
      },
    );
  }
}
