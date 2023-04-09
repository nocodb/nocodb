import { Controller } from '@nestjs/common';
import { HookFiltersService } from './hook-filters.service';

@Controller('hook-filters')
export class HookFiltersController {
  constructor(private readonly hookFiltersService: HookFiltersService) {}

}
