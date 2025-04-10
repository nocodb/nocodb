import { Controller } from '@nestjs/common';
import { TablesController as TablesControllerCE } from 'src/controllers/tables.controller';
import { TablesService } from '~/services/tables.service';

@Controller()
export class TablesController extends TablesControllerCE {
  constructor(private readonly tablesServiceEE: TablesService) {
    super(tablesServiceEE);
  }
}
