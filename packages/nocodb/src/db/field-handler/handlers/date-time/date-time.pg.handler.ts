import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';
import { formatPgDateTime } from '~/helpers/dateTimePrecision';

export class DateTimePGHandler extends DateTimeGeneralHandler {
  // pg stores sub-second values, so filter bounds must keep them: the
  // `+24h -1ms` day end truncated to `23:59:59` drops rows at `23:59:59.5`
  override dateValueFormat = 'YYYY-MM-DD HH:mm:ss.SSS';

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
    const knex = params.options.baseModel.dbDriver;
    const dayjsUtcValue: dayjs.Dayjs = super.parseDateTime(params).value;

    // convert to UTC
    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00.000+00:00
    // then convert to db timezone
    const val = dayjsUtcValue
      ? knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
          formatPgDateTime(dayjsUtcValue, params.column),
        ])
      : undefined;
    return { value: val };
  }
}
