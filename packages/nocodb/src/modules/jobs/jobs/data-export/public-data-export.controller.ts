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
import { PublicDatasService } from '~/services/public-datas.service';
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
    protected readonly publicDatasService: PublicDatasService,
  ) {}

  @Post(['/api/v2/public/export/:publicDataUuid/:exportAs'])
  @HttpCode(200)
  async exportModelData(
    @TenantContext() context: NcContext,
    @Req() req: NcRequest,
    @Param('publicDataUuid') publicDataUuid: string,
    @Param('exportAs') exportAs: 'csv' | 'json' | 'excel',
    @Body() options: DataExportJobData['options'],
  ) {
    const view = await View.getByUUID(context, publicDataUuid);

    if (!view) NcError.viewNotFound(publicDataUuid);
    if (view.type === ViewTypes.FORM) NcError.notFound('Not found');

    if (
      !(await View.verifyPassword(view, req.headers?.['xc-password'] as string))
    ) {
      NcError.invalidSharedViewPassword();
    }

    // check if download is allowed
    if (!view.meta?.allowCSVDownload) {
      NcError.forbidden('Download is not allowed for this view');
    }

    if (!view) NcError.viewNotFound(publicDataUuid);

    // Strip filterArrJson / sortArrJson entries referencing columns that
    // are hidden in this shared view. Without this, an unauthenticated
    // viewer can probe hidden-column values by filtering on them and
    // observing which visible rows remain in the export (CWE-200).
    await this.publicDatasService.sanitizeExportJobOptions(
      context,
      view,
      options,
    );

    const job = await this.jobsService.add(JobTypes.DataExport, {
      context,
      options: {
        ...(options ?? {}),
        // includeByteOrderMark when export is triggered from controller
        includeByteOrderMark: true,
      },
      modelId: view.fk_model_id,
      viewId: view.id,
      user: req.user,
      exportAs,
      ncSiteUrl: req.ncSiteUrl,
      locale:
        (req.headers?.['accept-language'] || '').split(',')[0] || undefined,
    });

    return {
      id: job.id,
    };
  }
}
