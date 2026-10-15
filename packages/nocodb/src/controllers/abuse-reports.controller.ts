import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AbuseReportReqType } from 'nocodb-sdk';
import { AbuseReportsService } from '~/services/abuse-reports.service';
import { PublicApiLimiterGuard } from '~/guards/public-api-limiter.guard';
import { NcRequest } from '~/interface/config';

// Anonymous by design: reporters are visitors of public shares.
@UseGuards(PublicApiLimiterGuard)
@Controller()
export class AbuseReportsController {
  constructor(protected readonly abuseReportsService: AbuseReportsService) {}

  @Post('/api/v2/public/abuse-reports')
  @HttpCode(204)
  async create(@Req() req: NcRequest, @Body() body: AbuseReportReqType) {
    await this.abuseReportsService.create({ body, req });
  }
}
