import { Module } from '@nestjs/common';
import { ViewColumnsService } from './view-columns.service';
import { ViewColumnsController } from './view-columns.controller';

@Module({
  controllers: [ViewColumnsController],
  providers: [ViewColumnsService]
})
export class ViewColumnsModule {}
