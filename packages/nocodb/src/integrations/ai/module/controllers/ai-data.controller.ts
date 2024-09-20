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
import type { UITypes } from 'nocodb-sdk';
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

  @Post(['/api/v2/ai/:modelId/generate'])
  @Acl('aiData', {
    scope: 'base',
  })
  @HttpCode(200)
  async generateRows(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @Body()
    body: {
      rowIds: string[];
      column:
        | string
        | {
            title: string;
            prompt_raw: string;
            fk_integration_id: string;
            uidt: UITypes.AI | UITypes.Button;
            output_column_ids?: string;
            model?: string;
          };
      preview?: boolean;
    },
  ) {
    return await this.aiDataService.generateRows(context, {
      modelId,
      ...(typeof body.column === 'string'
        ? { columnId: body.column }
        : { aiPayload: body.column }),
      rowIds: body.rowIds,
      preview: body.preview,
      req,
    });
  }
}
