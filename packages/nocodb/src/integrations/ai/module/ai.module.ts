import { forwardRef, Module } from '@nestjs/common';
import { AiSchemaController } from '~/integrations/ai/module/controllers/ai-schema.controller';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';
import { AiUtilsController } from '~/integrations/ai/module/controllers/ai-utils.controller';
import { AiUtilsService } from '~/integrations/ai/module/services/ai-utils.service';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [AiSchemaController, AiUtilsController],
  providers: [AiSchemaService, AiUtilsService],
  exports: [AiSchemaService, AiUtilsService],
})
export class NocoAiModule {}
