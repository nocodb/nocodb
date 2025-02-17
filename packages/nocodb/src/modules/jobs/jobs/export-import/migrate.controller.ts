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
import { MigrateService } from 'src/modules/jobs/jobs/export-import/migrate.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';
import { BasesService } from '~/services/bases.service';
import { Base } from '~/models';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { IJobsService } from '~/modules/jobs/jobs-service.interface';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext, NcRequest } from '~/interface/config';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class MigrateController {
  constructor(
    @Inject('JobsService') protected readonly jobsService: IJobsService,
    protected readonly basesService: BasesService,
    protected readonly migrateService: MigrateService,
  ) {}

  @Post(['/api/v2/meta/migrate/:baseId'])
  @HttpCode(200)
  @Acl('migrateBase')
  async migrateBase(
    @TenantContext() context: NcContext,
    @Param('baseId') baseId: string,
    @Req() req: NcRequest,
    @Body()
    body: {
      migrationUrl: string;
    },
  ) {
    const base = await Base.get(context, baseId);

    if (!base) {
      throw new Error(`Base not found for id '${baseId}'`);
    }

    const source = (await base.getSources())[0];

    if (!source) {
      throw new Error(`Source not found!`);
    }

    const url = new URL(body.migrationUrl);

    const instanceUrl = url.origin;

    // secret query param
    const secret = url.searchParams.get('secret');

    if (!instanceUrl || !secret) {
      throw new Error(`Invalid migration url`);
    }

    return await this.migrateService.migrateBase({
      context,
      base,
      source,
      secret: secret,
      instanceUrl: instanceUrl,
      req,
    });
  }
}
