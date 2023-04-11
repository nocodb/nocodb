import { Module } from '@nestjs/common';
import { FiltersService } from './filters.service';
import { FiltersController } from './filters.controller';

@Module({
  controllers: [FiltersController],
  providers: [FiltersService],
})
export class FiltersModule {}
