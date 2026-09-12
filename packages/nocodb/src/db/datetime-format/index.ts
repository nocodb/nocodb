import { ClientType } from 'nocodb-sdk';
import type { DatetimeFormatHandler } from '~/db/datetime-format/datetime-format.interface';
import { NcError } from '~/helpers/catchError';
import { MysqlDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.mysql.handler';
import { PgDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.pg.handler';
import { SqliteDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.sqlite.handler';

// Default format applied when DATETIME_FORMAT is called without a format arg.
export const DEFAULT_DATETIME_FORMAT = 'YYYY-MM-DD HH:mm';

// Strategy registry keyed by dialect. Handlers are stateless, so a single
// instance per dialect is reused. Only the dialects with a clean native
// mapping are wired up — DATETIME_FORMAT is gated off elsewhere for the rest.
const DATETIME_FORMAT_HANDLERS: Partial<
  Record<ClientType, DatetimeFormatHandler>
> = {
  [ClientType.PG]: new PgDatetimeFormatHandler(),
  [ClientType.MYSQL]: new MysqlDatetimeFormatHandler(),
  [ClientType.SQLITE]: new SqliteDatetimeFormatHandler(),
};

// Resolves the DATETIME_FORMAT strategy for a dialect, throwing a clear error
// when the dialect has no implementation (the UI gates it off via sqlUi, this
// is the backend guard).
export function getDatetimeFormatHandler(
  client: ClientType,
): DatetimeFormatHandler {
  const handler = DATETIME_FORMAT_HANDLERS[client];
  if (!handler) {
    NcError.badRequest(
      `DATETIME_FORMAT is not supported for the "${client}" database`,
    );
  }
  return handler;
}

export type { DatetimeFormatHandler } from '~/db/datetime-format/datetime-format.interface';
