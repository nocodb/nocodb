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
import { ViewTypes } from 'nocodb-sdk';
import type { DataExportJobData } from '~/interface/Jobs';
import { BasesService } from '~/services/bases.service';
import { View } from '~/models';
import { JobTypes } from '~/interface/Jobs';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';
import { NcError } from '~/helpers/catchError';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';

@Controller()
@UseGuards(PublicApiLimiterGuard)
export class PublicDataExportController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
  ) {}

  @Post(['/api/v2/public/export/:publicDataUuid/:exportAs'])
  @HttpCode(200)
  async exportModelData(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('publicDataUuid') publicDataUuid: string,
    @Param('exportAs') exportAs: 'csv' | 'json' | 'xlsx',
    @Body() options: DataExportJobData['options'],
  ) {
    const view = await View.getByUUID(context, publicDataUuid);

    if (!view) NcError.viewNotFound(publicDataUuid);
    if (
      view.type !== ViewTypes.GRID &&
      view.type !== ViewTypes.KANBAN &&
      view.type !== ViewTypes.GALLERY &&
      view.type !== ViewTypes.CALENDAR &&
      view.type !== ViewTypes.MAP
    )
      NcError.notFound('Not found');

    if (view.password && view.password !== req.headers?.['xc-password']) {
      NcError.invalidSharedViewPassword();
    }

    // check if download is allowed
    if (!view.meta?.allowCSVDownload) {
      NcError.forbidden('Download is not allowed for this view');
    }

    if (!view) NcError.viewNotFound(publicDataUuid);

    const job = await this.jobsService.add(JobTypes.DataExport, {
      context,
      options,
      modelId: view.fk_model_id,
      viewId: view.id,
      user: req.user,
      exportAs,
      ncSiteUrl: req.ncSiteUrl,
    });

    return {
      id: job.id,
    };
  }
}
