import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { PagedResponseImpl } from '~/helpers/PagedResponse';
import { AuditsService } from '~/services/audits.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsController {
  constructor(protected readonly auditsService: AuditsService) {}

  @Get(['/api/v1/db/meta/audits/', '/api/v2/meta/audits/'])
  @Acl('auditListRow')
  async auditListRow(
    @Req() req: NcRequest,
    @Query('row_id') rowId: string,
    @Query('fk_model_id') fkModelId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return new PagedResponseImpl(
      await this.auditsService.auditOnlyList({
        query: {
          row_id: rowId,
          fk_model_id: fkModelId,
          limit,
          offset,
        },
      }),
      {
        count: await this.auditsService.auditOnlyCount({
          query: {
            row_id: rowId,
            fk_model_id: fkModelId,
          },
        }),
        ...req.query,
      },
    );
  }

  @Get([
    '/api/v1/db/meta/projects/:baseId/audits/',
    '/api/v2/meta/bases/:baseId/audits/',
  ])
  @Acl('baseAuditList')
  async auditList(@Req() req: NcRequest, @Param('baseId') baseId: string) {
    return new PagedResponseImpl(
      await this.auditsService.auditList({
        query: req.query,
        baseId,
      }),
      {
        count: await this.auditsService.auditCount({
          query: req.query,
          baseId,
        }),
        ...req.query,
      },
    );
  }
  @Get(['/api/v1/db/meta/projects/audits/', '/api/v2/meta/projects/audits/'])
  @Acl('projectAuditList')
  async projectAuditList(@Req() req: NcRequest) {
    return new PagedResponseImpl(
      await this.auditsService.projectAuditList({
        query: req.query,
      }),
      {
        count: await this.auditsService.projectAuditCount(),
        ...req.query,
      },
    );
  }
}
