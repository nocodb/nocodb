import { Module } from '@nestjs/common';
import { GridsService } from './grids.service';
import { GridsController } from './grids.controller';

@Module({
  controllers: [GridsController],
  providers: [GridsService],
})
export class GridsModule {}
