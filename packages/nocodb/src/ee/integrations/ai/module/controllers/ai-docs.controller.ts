import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { NcContext } from '~/interface/config';
import { NcError } from '~/helpers/ncError';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { AiDocsService } from '~/integrations/ai/module/services/ai-docs.service';
import { Acl } from '~/middlewares/extract-ids/extract-ids.middleware';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiDocsController {
  constructor(private readonly aiDocsService: AiDocsService) {}

  @Post(['/api/v2/ai/bases/:baseId/docs'])
  @Acl('aiUtils', {
    scope: 'base',
  })
  @HttpCode(200)
  async aiDocs(
    @TenantContext() context: NcContext,
    @Req() req: Request,
    @Body()
    body: {
      operation: string;
      input: any;
    },
  ) {
    const { operation } = body;

    if (operation === 'docAiWrite') {
      return await this.aiDocsService.aiWrite(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'docAiContinue') {
      return await this.aiDocsService.aiContinue(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'docAiImprove') {
      return await this.aiDocsService.aiImprove(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'docAiSummarize') {
      return await this.aiDocsService.aiSummarize(context, {
        input: body.input,
        req,
      });
    } else if (operation === 'docAiTranslate') {
      return await this.aiDocsService.aiTranslate(context, {
        input: body.input,
        req,
      });
    } else {
      NcError.badRequest(`Unknown document AI operation: ${operation}`);
    }
  }
}
