import { Module } from '@nestjs/common';
import { ColumnsService } from './columns.service';
import { ColumnsController } from './columns.controller';

@Module({
  controllers: [ColumnsController],
  providers: [ColumnsService],
})
export class ColumnsModule {}
