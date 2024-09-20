import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiDataController {
  constructor(private readonly aiDataService: AiDataService) {}

  @Post(['/api/v2/ai/:modelId/:columnId/generate'])
  @Acl('aiData', {
    scope: 'base',
  })
  @HttpCode(200)
  async generateRows(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Param('columnId') columnId: string,
    @Body()
    body: {
      rowIds: string[];
      preview?: boolean;
    },
  ) {
    return await this.aiDataService.generateRows(context, {
      modelId,
      columnId,
      rowIds: body.rowIds,
      preview: body.preview,
      req,
    });
  }
}
