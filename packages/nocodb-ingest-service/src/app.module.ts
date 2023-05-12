import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import {ClickhouseService} from "./clickhouse/clickhouse.service";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [ClickhouseService],
})
export class AppModule {}
