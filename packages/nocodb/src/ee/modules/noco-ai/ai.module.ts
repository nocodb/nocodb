import { forwardRef, Module } from '@nestjs/common';
import { AiSchemaController } from '~/modules/noco-ai/controllers/ai-schema.controller';
import { AiSchemaService } from '~/modules/noco-ai/services/ai-schema.service';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [AiSchemaController],
  providers: [AiSchemaService],
  exports: [AiSchemaService],
})
export class NocoAiModule {}
