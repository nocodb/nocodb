import { forwardRef, Module } from '@nestjs/common';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';
import { AiDataController } from '~/integrations/ai/module/controllers/ai-data.controller';
import { AiUtilsController } from '~/integrations/ai/module/controllers/ai-utils.controller';
import { AiCompletionController } from '~/integrations/ai/module/controllers/ai-completion.controller';
import { AiUtilsService } from '~/integrations/ai/module/services/ai-utils.service';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';
import { NocoModule } from '~/modules/noco.module';
import { AiCompletionService } from '~/integrations/ai/module/services/ai-completion.service';
import { AiSchemaController } from '~/integrations/ai/module/controllers/ai-schema.controller';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [
    AiSchemaController,
    AiUtilsController,
    AiDataController,
    AiCompletionController,
  ],
  providers: [
    AiSchemaService,
    AiUtilsService,
    AiDataService,
    AiCompletionService,
  ],
  exports: [AiSchemaService, AiUtilsService, AiDataService],
})
export class NocoAiModule {}
