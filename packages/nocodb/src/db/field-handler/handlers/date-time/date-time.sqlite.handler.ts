import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class DateTimeSQLiteHandler extends DateTimeGeneralHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    options?: {
      baseModel?: IBaseModelSqlV2;
      context?: NcContext;
      metaService?: MetaService;
    };
  }): Promise<{ value: any }> {
    const dayjsUtcValue: dayjs.Dayjs = super.parseDateTime(params).value;

    // convert to UTC
    // e.g. 2022-01-01T10:00:00.000Z -> 2022-01-01 04:30:00+00:00
    const val = dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ');
    return { value: val };
  }
}
