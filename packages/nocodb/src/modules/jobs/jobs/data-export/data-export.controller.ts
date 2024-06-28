import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { DataExportJobData } from '~/interface/Jobs';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { View } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class DataExportController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
  ) {}

  @Post(['/api/v2/export/:viewId/:exportAs'])
  @HttpCode(200)
  // TODO add new ACL
  @Acl('dataList')
  async exportModelData(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('viewId') viewId: string,
    @Param('exportAs') exportAs: 'csv' | 'json' | 'xlsx',
    @Body() options: DataExportJobData['options'],
  ) {
    const view = await View.get(context, viewId);

    if (!view) NcError.viewNotFound(viewId);

    const job = await this.jobsService.add(JobTypes.DataExport, {
      context,
      options,
      modelId: view.fk_model_id,
      viewId,
      user: req.user,
      exportAs,
      ncSiteUrl: req.ncSiteUrl,
    });

    return job;
  }
}
