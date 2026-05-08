import { ClientType } from '../enums';
import { getTestDatabaseName } from '../helperFunctions';
import { SqlUiFactory } from './SqlUiFactory';
import { SqliteUi } from './SqliteUi';

describe('SqlUiFactory', () => {
  it('returns SQLite-compatible UI for Cloudflare D1', () => {
    expect(SqlUiFactory.create({ client: ClientType.D1 })).toBeInstanceOf(
      SqliteUi
    );
  });

  it('does not substitute a fake test database name for Cloudflare D1', () => {
    expect(getTestDatabaseName({ client: ClientType.D1 })).toBeUndefined();
  });
});
