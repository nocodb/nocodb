import { Module } from '@nestjs/common';
import { PublicDatasExportService } from '../../services/public-datas-export.service';
import { PublicDatasExportController } from '../../controllers/public-datas-export.controller';

@Module({
  controllers: [PublicDatasExportController],
  providers: [PublicDatasExportService],
})
export class PublicDatasExportModule {}
