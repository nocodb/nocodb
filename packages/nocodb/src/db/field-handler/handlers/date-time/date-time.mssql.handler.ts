import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

export class DateTimeMssqlHandler extends DateTimeGeneralHandler {
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

    // Emit the UTC wall-clock WITHOUT a timezone offset.
    // SQL Server's legacy `datetime` / `smalldatetime` types reject the
    // `+00:00` suffix the generic handler appends ("Conversion failed when
    // converting date and/or time from character string"). `datetime2` /
    // `datetimeoffset` accept the suffix but read the value as UTC anyway —
    // which is what NocoDB stores — so a plain 'YYYY-MM-DD HH:mm:ss' is the
    // single format accepted by every SQL Server temporal type.
    // Filters need no override: comparing those types against UTC-formatted
    // string bounds already resolves correctly (datetimeoffset compares by
    // UTC instant), unlike MySQL which stores in the server timezone.
    const val = dayjsUtcValue?.format('YYYY-MM-DD HH:mm:ss');
    return { value: val };
  }
}
