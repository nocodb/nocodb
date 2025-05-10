import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class DateTimePGHandler extends DateTimeGeneralHandler {
  override async parseUserInput(params: {
    value: any;
    row: any;
    column: Column;
    baseModel: IBaseModelSqlV2;
    options?: { context?: NcContext; metaService?: MetaService };
  }): Promise<{ value: any }> {
    const knex = params.baseModel.dbDriver;
    const dayjsUtcValue: dayjs.Dayjs = super.parseDateTime(params).value;

    // convert to UTC
    // e.g. 2023-01-01T12:00:00.000Z -> 2023-01-01 12:00:00+00:00
    // then convert to db timezone
    const val = knex.raw(`? AT TIME ZONE CURRENT_SETTING('timezone')`, [
      dayjsUtcValue.format('YYYY-MM-DD HH:mm:ssZ'),
    ]);
    return { value: val };
  }
}
