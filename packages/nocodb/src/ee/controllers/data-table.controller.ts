import { Controller, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DataTableController as DataTableControllerCE } from 'src/controllers/data-table.controller';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { GlobalGuard } from '~/guards/global/global.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DataTableController extends DataTableControllerCE {
  @Post(['/api/v2/tables/:modelId/bulk/aggregate'])
  @Acl('dataAggregate')
  async bulkAggregate(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('modelId') modelId: string,
    @Query('viewId') viewId: string,
  ) {
    return await this.dataTableService.bulkAggregate(context, {
      query: req.query,
      modelId,
      viewId,
      body: req.body,
    });
  }
}
