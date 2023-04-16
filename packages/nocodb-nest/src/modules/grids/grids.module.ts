import { Module } from '@nestjs/common';
import { GridsService } from '../../services/grids.service';
import { GridsController } from '../../controllers/grids.controller';

@Module({
  controllers: [GridsController],
  providers: [GridsService],
})
export class GridsModule {}
