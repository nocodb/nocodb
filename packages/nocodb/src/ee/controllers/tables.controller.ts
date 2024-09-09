import { Controller, UseGuards } from '@nestjs/common';
import { TablesController as TablesControllerCE } from 'src/controllers/tables.controller';
import { GlobalGuard } from '~/guards/global/global.guard';
import { TablesService } from '~/services/tables.service';
import { MetaApiLimiterGuard } from '~/guards/meta-api-limiter.guard';

@Controller()
@UseGuards(MetaApiLimiterGuard, GlobalGuard)
export class TablesController extends TablesControllerCE {
  constructor(private readonly tablesServiceEE: TablesService) {
    super(tablesServiceEE);
  }
}
