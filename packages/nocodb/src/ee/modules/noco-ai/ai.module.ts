import { forwardRef, Module } from '@nestjs/common';
import { AiSchemaController } from '~/modules/noco-ai/controllers/ai-schema.controller';
import { AiSchemaService } from '~/modules/noco-ai/services/ai-schema.service';
import { AiUtilsController } from '~/modules/noco-ai/controllers/ai-utils.controller';
import { AiUtilsService } from '~/modules/noco-ai/services/ai-utils.service';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [AiSchemaController, AiUtilsController],
  providers: [AiSchemaService, AiUtilsService],
  exports: [AiSchemaService, AiUtilsService],
})
export class NocoAiModule {}
