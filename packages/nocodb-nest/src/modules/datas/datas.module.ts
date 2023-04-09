import { Module } from '@nestjs/common';
import { DatasService } from './datas.service';
import { DatasController } from './datas.controller';

@Module({
  controllers: [DatasController],
  providers: [DatasService]
})
export class DatasModule {}
