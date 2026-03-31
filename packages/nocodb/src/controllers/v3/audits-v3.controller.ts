import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import type { NcContext } from '~/interface/config';
import { AuditsV3Service } from '~/services/v3/audits-v3.service';
import { PREFIX_APIV3_METABASE } from '~/constants/controllers';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AuditsV3Controller {
  constructor(protected readonly auditsV3Service: AuditsV3Service) {}

  @Get(
    `${PREFIX_APIV3_METABASE}/tables/:tableId/records/:recordId/audits`,
  )
  @Acl('v3AuditRecordList')
  async recordAuditList(
    @TenantContext() context: NcContext,
    @Param('tableId') tableId: string,
    @Param('recordId') recordId: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    return await this.auditsV3Service.recordAuditList(context, {
      tableId,
      recordId,
      limit: limit ? parseInt(limit, 10) : undefined,
      cursor,
    });
  }
}
