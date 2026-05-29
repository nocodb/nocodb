import { DateTimeGeneralHandler } from './date-time.general.handler';
import type dayjs from 'dayjs';
import type { NcContext } from 'nocodb-sdk';
import type { IBaseModelSqlV2 } from 'src/db/IBaseModelSqlV2';
import type { MetaService } from 'src/meta/meta.service';
import type { Column } from '~/models';

// SQL Server temporal types differ in fractional-second precision:
//   datetime         — accuracy 3.33 ms (rounded to .000, .003, .007)
//   smalldatetime    — minute precision (no seconds)
//   datetime2(n)     — 0–7 fractional digits (default 7 = 100 ns)
//   datetimeoffset(n)— 0–7 fractional digits + tz
// We emit milliseconds (.SSS) for the precision-supporting types so we don't
// silently drop sub-second data on round-trip. Legacy `datetime` rounds the
// fractional part anyway, so the format is harmless on it; `smalldatetime`
// would error on any fractional input though, so for that one we drop ms.
const TYPES_WITH_FRACTIONAL = new Set(['datetime2', 'datetimeoffset']);

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
    // which is what NocoDB stores — so a plain 'YYYY-MM-DD HH:mm:ss[.SSS]'
    // is the single format accepted by every SQL Server temporal type.
    //
    // Filters need no override: comparing those types against UTC-formatted
    // string bounds already resolves correctly (datetimeoffset compares by
    // UTC instant), unlike MySQL which stores in the server timezone.
    const dt = (params.column?.dt || '').toLowerCase();
    const preserveMs =
      // datetime is *accurate* to 3.33 ms but accepts .SSS input — keep it
      // so any sub-second wallclock survives at least to the nearest tick.
      dt === 'datetime' || TYPES_WITH_FRACTIONAL.has(dt);
    const val = dayjsUtcValue?.format(
      preserveMs ? 'YYYY-MM-DD HH:mm:ss.SSS' : 'YYYY-MM-DD HH:mm:ss',
    );
    return { value: val };
  }
}
