import { Module } from '@nestjs/common';
import { AiSchemaController } from '~/modules/noco-ai/controllers/schema.controller';
import { AiSchemaService } from '~/modules/noco-ai/services/schema.service';
import { MetasModule } from '~/modules/metas/metas.module';
import { DatasModule } from '~/modules/datas/datas.module';

@Module({
  imports: [MetasModule, DatasModule],
  controllers: [AiSchemaController],
  providers: [AiSchemaService],
  exports: [AiSchemaService],
})
export class NocoAiModule {}
