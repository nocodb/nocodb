import { Controller } from '@nestjs/common';
import { HookFiltersService } from '../services/hook-filters.service';

@Controller()
export class HookFiltersController {
  constructor(private readonly hookFiltersService: HookFiltersService) {}
}
