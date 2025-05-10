import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class DateTimeMySQLHandler extends DateTimeGeneralHandler {
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

    // first convert the value to utc
    // from UI
    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
    // from API
    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
    // if timezone info is not found - considered as utc
    // e.g. 2022-01-01 20:00:00 -> 2022-01-01 20:00:00
    // if timezone info is found
    // e.g. 2022-01-01 20:00:00Z -> 2022-01-01 20:00:00
    // e.g. 2022-01-01 20:00:00+00:00 -> 2022-01-01 20:00:00
    // e.g. 2022-01-01 20:00:00+08:00 -> 2022-01-01 12:00:00
    // then we use CONVERT_TZ to convert that in the db timezone
    const val = knex.raw(`CONVERT_TZ(?, '+00:00', @@GLOBAL.time_zone)`, [
      dayjsUtcValue.format('YYYY-MM-DD HH:mm:ss'),
    ]);
    return { value: val };
  }
}
