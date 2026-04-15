import { Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { NcContext, NcRequest, PlanFeatureTypes } from 'nocodb-sdk';
import { AiCompletionService } from '~/integrations/ai/module/services/ai-completion.service';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';
import { TenantContext } from '~/decorators/tenant-context.decorator';
import { License } from '~/decorators/license.decorator';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
@License(PlanFeatureTypes.FEATURE_AI)
export class AiCompletionController {
  constructor(private readonly aiCompletionService: AiCompletionService) {}

  @Post(['/api/v2/ai/bases/:baseId/completion'])
  @HttpCode(200)
  aiCompletion(@TenantContext() context: NcContext, @Req() req: NcRequest) {
    return this.aiCompletionService.aiCompletion(context, req);
  }
}
