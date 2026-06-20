import { GenericPgFieldHandler } from '../generic.pg';
import { LongTextGeneralHandler } from './long-text.general.handler';

/**
 * On Postgres `LIKE` is case-sensitive, whereas every other supported dialect's
 * `LIKE` (and NocoDB's intent for the "contains" filter) is case-insensitive.
 * LongText routes through FieldHandler, so without a PG-specific handler it
 * inherits `GenericFieldHandler`'s plain `LIKE` and the filter becomes
 * case-sensitive on PG.
 *
 * Delegate only the `like` / `nlike` comparisons to `GenericPgFieldHandler`
 * (which uses `ILIKE`) — mirroring the `UserPgHandler` pattern — while keeping
 * all LongText-specific behaviour (AI-prompt field extraction in `filter()`,
 * `applySort()`, `parseUserInput()`) inherited from `LongTextGeneralHandler`.
 */
export class LongTextPgHandler extends LongTextGeneralHandler {
  pgHandler = new GenericPgFieldHandler();

  override filterLike = (
    ...args: Parameters<GenericPgFieldHandler['filterLike']>
  ) => this.pgHandler.filterLike(...args);

  override filterNlike = (
    ...args: Parameters<GenericPgFieldHandler['filterNlike']>
  ) => this.pgHandler.filterNlike(...args);
}
