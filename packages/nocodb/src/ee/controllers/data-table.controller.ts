import { Controller } from '@nestjs/common';
import { DataTableController as DataTableControllerCE } from 'src/controllers/data-table.controller';

@Controller()
export class DataTableController extends DataTableControllerCE {}
