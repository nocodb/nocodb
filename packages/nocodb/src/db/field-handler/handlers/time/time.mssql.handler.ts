import { TimeGeneralHandler } from '~/db/field-handler/handlers/time/time.general.handler';

/**
 * MSSQL stores Time columns as the T-SQL `time(7)` type — pure
 * `HH:mm:ss[.fffffff]` with no date or timezone component. Insert/update
 * strings need to match that shape: emitting the generic
 * `YYYY-MM-DD HH:mm:ssZ` (with offset, used by pg/sqlite) errors with
 * "Conversion failed when converting date and/or time from character
 * string." The mysql override drops the offset; this one also drops the
 * date prefix so the value lands cleanly in `time(7)`.
 */
export class TimeMssqlHandler extends TimeGeneralHandler {
  override getTimeFormat(): string {
    return 'HH:mm:ss';
  }
}
