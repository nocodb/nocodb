import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { GlobalModule } from '../global/global.module';
import { DatasModule } from '../datas/datas.module';
import { MetasModule } from '../metas/metas.module';
import { JobsService } from './jobs.service';
import { ExportService } from './export-import/export.service';
import { ImportService } from './export-import/import.service';
import { DuplicateController } from './export-import/duplicate.controller';
import { DuplicateProcessor } from './export-import/duplicate.processor';
import { JobsGateway } from './jobs.gateway';
import { QueueService } from './fallback-queue.service';
import { JobsEventService } from './jobs-event.service';
import { AtImportController } from './at-import/at-import.controller';
import { AtImportProcessor } from './at-import/at-import.processor';

@Module({
  imports: [
    GlobalModule,
    DatasModule,
    MetasModule,
    BullModule.registerQueue({
      name: 'jobs',
    }),
  ],
  controllers: [DuplicateController, AtImportController],
  providers: [
    QueueService,
    JobsGateway,
    JobsService,
    JobsEventService,
    DuplicateProcessor,
    ExportService,
    ImportService,
    AtImportProcessor,
  ],
})
export class JobsModule {}
