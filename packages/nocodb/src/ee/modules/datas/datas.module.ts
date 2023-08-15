import { Module } from '@nestjs/common';
import { dataModuleMetadata } from 'src/modules/datas/datas.module';
import { DataOptService } from '~/services/data-opt/data-opt.service';

@Module({
  ...dataModuleMetadata,
  providers: [...dataModuleMetadata.providers, DataOptService],
  exports: [DataOptService],
})
export class DatasModule {}
