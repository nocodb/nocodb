import { Injectable } from '@nestjs/common';
import { DataTableService as DataTableServiceCE } from 'src/services/data-table.service';

@Injectable()
export class DataTableService extends DataTableServiceCE {}
