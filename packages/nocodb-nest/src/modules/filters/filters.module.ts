import { Module } from '@nestjs/common';
import { FiltersService } from '../../services/filters.service';
import { FiltersController } from '../../controllers/filters.controller';

@Module({
  controllers: [FiltersController],
  providers: [FiltersService],
})
export class FiltersModule {}
