import {
  Body,
  Controller,
  HttpCode,
  Param,
  Post,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Request } from 'express';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import type { FileType, UITypes } from 'nocodb-sdk';
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

  @Post(['/api/v2/ai/tables/:modelId/rows/generate'])
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
            uidt: UITypes.Button;
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

  @Post(['/api/v2/ai/tables/:modelId/extract'])
  @Acl('aiData', {
    scope: 'base',
  })
  @HttpCode(200)
  @UseInterceptors(
    AnyFilesInterceptor({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10 MB
      },
    }),
  )
  async extractRows(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Param('modelId') modelId: string,
    @UploadedFiles() files: Array<FileType>,
    @Body()
    body: {
      input: string;
    },
  ) {
    return await this.aiDataService.extractRowsFromInput(context, {
      modelId,
      input: body.input,
      files,
      req,
    });
  }
}
