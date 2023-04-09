import { Module } from '@nestjs/common';
import { PublicDatasService } from './public-datas.service';
import { PublicDatasController } from './public-datas.controller';

@Module({
  controllers: [PublicDatasController],
  providers: [PublicDatasService]
})
export class PublicDatasModule {}
