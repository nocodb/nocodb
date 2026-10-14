jest.mock('~/helpers/ncError', () => ({
  NcError: {
    badRequest: (message: string) => {
      throw new Error(message);
    },
  },
}));

import {
  extractNotNullColumnName,
  handleNotNullConstraintError,
} from './notNullConstraintErrorHandler';

describe('extractNotNullColumnName', () => {
  it.each([
    [
      'pg (driver column)',
      { code: '23502', column: 'title', message: 'whatever' },
      'title',
    ],
    [
      'pg (message)',
      {
        code: '23502',
        message:
          'null value in column "title" of relation "nc_t1" violates not-null constraint',
      },
      'title',
    ],
    [
      'mysql no default',
      {
        code: 'ER_NO_DEFAULT_FOR_FIELD',
        message: "ER_NO_DEFAULT_FOR_FIELD: Field 'title' doesn't have a default value",
      },
      'title',
    ],
    [
      'mysql bad null',
      { code: 'ER_BAD_NULL_ERROR', message: "Column 'title' cannot be null" },
      'title',
    ],
    [
      'sqlite',
      {
        code: 'SQLITE_CONSTRAINT',
        message:
          'insert into `nc_t1` (`a`) values (1) - SQLITE_CONSTRAINT: NOT NULL constraint failed: nc_t1.title',
      },
      'title',
    ],
    [
      'mssql',
      {
        number: 515,
        message:
          "Cannot insert the value NULL into column 'title', table 'db.dbo.nc_t1'; column does not allow nulls. INSERT fails.",
      },
      'title',
    ],
    ['unrelated error', { code: '23505', message: 'duplicate key' }, undefined],
    ['no error', undefined, undefined],
  ])('%s', (_label, error, expected) => {
    expect(extractNotNullColumnName(error)).toBe(expected);
  });
});

describe('handleNotNullConstraintError', () => {
  const baseModel = {
    model: {
      getColumns: async () => [
        { column_name: 'id', title: 'Id' },
        { column_name: 'title', title: 'Project Name' },
      ],
    },
  } as any;

  it('throws a bad request naming the field by its title', async () => {
    await expect(
      handleNotNullConstraintError({
        error: { code: '23502', column: 'title' },
        baseModel,
      }),
    ).rejects.toThrow("A value is required for field 'Project Name'.");
  });

  it('does nothing for other errors or unknown columns', async () => {
    await expect(
      handleNotNullConstraintError({
        error: { code: '23505', message: 'duplicate key' },
        baseModel,
      }),
    ).resolves.toBeUndefined();
    await expect(
      handleNotNullConstraintError({
        error: { code: '23502', column: 'missing' },
        baseModel,
      }),
    ).resolves.toBeUndefined();
  });
});
