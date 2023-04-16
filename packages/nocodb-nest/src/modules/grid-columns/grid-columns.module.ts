import { Module } from '@nestjs/common';
import { GridColumnsService } from '../../services/grid-columns.service';
import { GridColumnsController } from '../../controllers/grid-columns.controller';

@Module({
  controllers: [GridColumnsController],
  providers: [GridColumnsService],
})
export class GridColumnsModule {}
