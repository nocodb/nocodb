import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { NC_ATTACHMENT_FIELD_SIZE } from '~/constants';
import { DataTableController } from '~/controllers/data-table.controller';
import { DataTableService } from '~/services/data-table.service';
import { DataAliasController } from '~/controllers/data-alias.controller';
import { PublicDatasExportController } from '~/controllers/public-datas-export.controller';
import { PublicDatasController } from '~/controllers/public-datas.controller';
import { DatasService } from '~/services/datas.service';
import { DatasController } from '~/controllers/datas.controller';
import { BulkDataAliasController } from '~/controllers/bulk-data-alias.controller';
import { DataAliasExportController } from '~/controllers/data-alias-export.controller';
import { DataAliasNestedController } from '~/controllers/data-alias-nested.controller';
import { OldDatasController } from '~/controllers/old-datas/old-datas.controller';
import { BulkDataAliasService } from '~/services/bulk-data-alias.service';
import { DataAliasNestedService } from '~/services/data-alias-nested.service';
import { OldDatasService } from '~/controllers/old-datas/old-datas.service';
import { PublicDatasExportService } from '~/services/public-datas-export.service';
import { PublicDatasService } from '~/services/public-datas.service';

export const dataModuleMetadata = {
  imports: [
    MulterModule.register({
      storage: multer.diskStorage({}),
      limits: {
        fieldSize: NC_ATTACHMENT_FIELD_SIZE,
      },
    }),
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [
          DataTableController,
          DatasController,
          BulkDataAliasController,
          DataAliasController,
          DataAliasNestedController,
          DataAliasExportController,
          OldDatasController,
          PublicDatasController,
          PublicDatasExportController,
        ]
      : []),
  ],
  providers: [
    DataTableService,
    DatasService,
    BulkDataAliasService,
    DataAliasNestedService,
    OldDatasService,
    PublicDatasService,
    PublicDatasExportService,
  ],
  exports: [
    DatasService,
    BulkDataAliasService,
    DataAliasNestedService,
    OldDatasService,
    PublicDatasService,
    PublicDatasExportService,
  ],
};

@Module(dataModuleMetadata)
export class DatasModule {}
