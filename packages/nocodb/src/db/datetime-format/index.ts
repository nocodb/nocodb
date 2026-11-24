import { ClientType } from 'nocodb-sdk';
import type {
  DatetimeFormatHandler,
  DatetimeParseHandler,
} from '~/db/datetime-format/datetime-format.interface';
import { NcError } from '~/helpers/catchError';
import { MysqlDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.mysql.handler';
import { PgDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.pg.handler';
import { SqliteDatetimeFormatHandler } from '~/db/datetime-format/handlers/datetime-format.sqlite.handler';
import { MysqlDatetimeParseHandler } from '~/db/datetime-format/handlers/datetime-parse.mysql.handler';
import { PgDatetimeParseHandler } from '~/db/datetime-format/handlers/datetime-parse.pg.handler';
import { SqliteDatetimeParseHandler } from '~/db/datetime-format/handlers/datetime-parse.sqlite.handler';

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

const DATETIME_PARSE_HANDLERS: Partial<
  Record<ClientType, DatetimeParseHandler>
> = {
  [ClientType.PG]: new PgDatetimeParseHandler(),
  [ClientType.MYSQL]: new MysqlDatetimeParseHandler(),
  [ClientType.SQLITE]: new SqliteDatetimeParseHandler(),
};

// DATETIME_PARSE strategy for a dialect; the UI gates the rest off via sqlUi
export function getDatetimeParseHandler(
  client: ClientType,
): DatetimeParseHandler {
  const handler = DATETIME_PARSE_HANDLERS[client];
  if (!handler) {
    NcError.badRequest(
      `DATETIME_PARSE is not supported for the "${client}" database`,
    );
  }
  return handler;
}

export type {
  DatetimeFormatHandler,
  DatetimeParseHandler,
} from '~/db/datetime-format/datetime-format.interface';
