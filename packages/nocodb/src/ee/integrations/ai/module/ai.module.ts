import { forwardRef, Module } from '@nestjs/common';
import { AiSchemaController } from '~/integrations/ai/module/controllers/ai-schema.controller';
import { AiSchemaService } from '~/integrations/ai/module/services/ai-schema.service';
import { AiDataController } from '~/integrations/ai/module/controllers/ai-data.controller';
import { AiUtilsController } from '~/integrations/ai/module/controllers/ai-utils.controller';
import { AiUtilsService } from '~/integrations/ai/module/services/ai-utils.service';
import { AiDataService } from '~/integrations/ai/module/services/ai-data.service';
import { NocoModule } from '~/modules/noco.module';

@Module({
  imports: [forwardRef(() => NocoModule)],
  controllers: [AiSchemaController, AiUtilsController, AiDataController],
  providers: [AiSchemaService, AiUtilsService, AiDataService],
  exports: [AiSchemaService, AiUtilsService, AiDataService],
})
export class NocoAiModule {}
