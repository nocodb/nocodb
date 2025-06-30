import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { NcContext, NcRequest } from 'nocodb-sdk';
import { AiCompletionService } from '~/integrations/ai/module/services/ai-completion.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class AiCompletionController {
  constructor(private readonly aiCompletionService: AiCompletionService) {}

  @Post(['/api/v2/ai/bases/:baseId/completion'])
  @HttpCode(200)
  aiCompletion(@TenantContext() context: NcContext, @Req() req: NcRequest) {
    return this.aiCompletionService.aiCompletion(context, req);
  }
}
