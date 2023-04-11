import { Module } from '@nestjs/common';
import { PublicDatasExportService } from './public-datas-export.service';
import { PublicDatasExportController } from './public-datas-export.controller';

@Module({
  controllers: [PublicDatasExportController],
  providers: [PublicDatasExportService],
})
export class PublicDatasExportModule {}
