import { Module } from '@nestjs/common';
import { DataAliasController } from './data-alias.controller';
import { DatasService } from '../../services/datas.service';
import { DatasController } from './datas.controller';
import { BulkDataAliasController } from '../../controllers/bulk-data-alias.controller';
import { DataAliasExportController } from '../../controllers/data-alias-export.controller';
import { DataAliasNestedController } from '../../controllers/data-alias-nested.controller';
import { OldDatasController } from '../../controllers/old-datas/old-datas.controller';
import { BulkDataAliasService } from '../../services/bulk-data-alias.service';
import { DataAliasNestedService } from '../../services/data-alias-nested.service';
import { OldDatasService } from '../../controllers/old-datas/old-datas.service';

@Module({
  controllers: [
    DatasController,
    BulkDataAliasController,
    DataAliasController,
    DataAliasNestedController,
    DataAliasExportController,
    OldDatasController,
  ],
  providers: [
    DatasService,
    BulkDataAliasService,
    DataAliasNestedService,
    OldDatasService,
  ],
})
export class DatasModule {}
