import { Module } from '@nestjs/common';
import { DataAliasController } from './data-alias.controller'
import { DatasService } from './datas.service';
import { DatasController } from './datas.controller';
import { BulkDataAliasController } from './bulk-data-alias/bulk-data-alias.controller';
import { DataAliasExportController } from './data-alias-export/data-alias-export.controller';
import { OldDatasController } from './old-datas/old-datas.controller';
import { BulkDataAliasService } from './bulk-data-alias/bulk-data-alias.service';
import { DataAliasNestedService } from './data-alias-nested/data-alias-nested.service';

@Module({
  controllers: [
    DataAliasController,
    DatasController,
    BulkDataAliasController,
    DataAliasExportController,
    OldDatasController,
  ],
  providers: [DatasService, BulkDataAliasService, DataAliasNestedService]
})
export class DatasModule {}
