import { Module } from '@nestjs/common';
import { HookFiltersService } from './hook-filters.service';
import { HookFiltersController } from './hook-filters.controller';

@Module({
  controllers: [HookFiltersController],
  providers: [HookFiltersService]
})
export class HookFiltersModule {}
