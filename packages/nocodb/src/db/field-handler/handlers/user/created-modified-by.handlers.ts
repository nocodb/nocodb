import { UserGeneralHandler } from './user.general.handler';
import { UserPgHandler } from './user.pg.handler';
import { UserSqliteHandler } from './user.sqlite.handler';
import type { Column } from '~/models';

/**
 * Mix-in for CreatedBy / LastModifiedBy columns: same filter behavior as the
 * corresponding User handler (user-id → display-name substitution for
 * like/nlike), but `parseUserInput` returns undefined since these columns
 * are auto-populated by the system and never accept user-supplied writes.
 *
 * The User-handler hierarchy already implements the right SQL for each
 * dialect; we just narrow `parseUserInput` to match ComputedFieldHandler.
 */
function withComputedParseUserInput<T extends new (...a: any[]) => any>(
  Base: T,
) {
  return class extends Base {
    async parseUserInput(_params: {
      value: any;
      row: any;
      column: Column;
      options?: any;
    }): Promise<{ value: any }> {
      return { value: undefined };
    }
  };
}

export const CreatedByGeneralHandler =
  withComputedParseUserInput(UserGeneralHandler);
export const CreatedByPgHandler = withComputedParseUserInput(UserPgHandler);
export const CreatedBySqliteHandler =
  withComputedParseUserInput(UserSqliteHandler);

// LastModifiedBy is structurally identical — same handler chain works.
export const LastModifiedByGeneralHandler = CreatedByGeneralHandler;
export const LastModifiedByPgHandler = CreatedByPgHandler;
export const LastModifiedBySqliteHandler = CreatedBySqliteHandler;
