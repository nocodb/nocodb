import { Module } from '@nestjs/common';
import { GridColumnsService } from './grid-columns.service';
import { GridColumnsController } from './grid-columns.controller';

@Module({
  controllers: [GridColumnsController],
  providers: [GridColumnsService],
})
export class GridColumnsModule {}
