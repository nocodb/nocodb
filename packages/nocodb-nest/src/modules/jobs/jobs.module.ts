import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GlobalModule } from '../global/global.module';
import { DatasModule } from '../datas/datas.module';
import { MetasModule } from '../metas/metas.module';
import { ExportService } from './export-import/export.service';
import { ImportService } from './export-import/import.service';
import { DuplicateController } from './export-import/duplicate.controller';
import { DuplicateProcessor } from './export-import/duplicate.processor';

@Module({
  imports: [
    GlobalModule,
    DatasModule,
    MetasModule,
    BullModule.registerQueue({
      name: 'duplicate',
    }),
  ],
  controllers: [DuplicateController],
  providers: [DuplicateProcessor, ExportService, ImportService],
})
export class JobsModule {}
