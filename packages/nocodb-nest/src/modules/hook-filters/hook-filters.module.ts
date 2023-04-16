import { Module } from '@nestjs/common';
import { HookFiltersService } from '../../services/hook-filters.service';
import { HookFiltersController } from '../../controllers/hook-filters.controller';

@Module({
  controllers: [HookFiltersController],
  providers: [HookFiltersService],
})
export class HookFiltersModule {}
