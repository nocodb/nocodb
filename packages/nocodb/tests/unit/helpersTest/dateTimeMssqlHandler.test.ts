import 'mocha';
import { expect } from 'chai';
import { DateTimeMssqlHandler } from '~/db/field-handler/handlers/date-time/date-time.mssql.handler';
import type { Column } from '~/models';

// SQL Server's legacy `datetime` / `smalldatetime` types reject a timezone
// offset suffix — `CONVERT(datetime, '2026-05-27 10:00:00+00:00')` throws
// "Conversion failed when converting date and/or time from character string".
// The generic/sqlite DateTime handlers emit that offset (`YYYY-MM-DD HH:mm:ssZ`),
// so the MSSQL handler overrides parseUserInput to emit a plain UTC wall-clock
// `YYYY-MM-DD HH:mm:ss` — the single format every SQL Server temporal type
// (datetime, datetime2, smalldatetime, datetimeoffset, date) accepts.

const buildColumn = (): Column =>
  ({
    column_name: 'CreatedAt',
    title: 'CreatedAt',
    uidt: 'DateTime',
    meta: null,
  }) as unknown as Column;

function dateTimeMssqlHandlerTests() {
  describe('DateTimeMssqlHandler — parseUserInput emits offset-less UTC', () => {
    const handler = new DateTimeMssqlHandler();

    it('emits a plain UTC wall-clock string with no timezone offset', async () => {
      const { value } = await handler.parseUserInput({
        value: '2026-05-27T10:00:00Z',
        row: {},
        column: buildColumn(),
      } as any);
      expect(value).to.equal('2026-05-27 10:00:00');
    });

    it('normalizes an offset-bearing input to UTC, still without an offset', async () => {
      const { value } = await handler.parseUserInput({
        value: '2026-05-27T18:00:00+08:00',
        row: {},
        column: buildColumn(),
      } as any);
      expect(value).to.equal('2026-05-27 10:00:00');
    });

    it('returns no value for null/empty input', async () => {
      const { value } = await handler.parseUserInput({
        value: null,
        row: {},
        column: buildColumn(),
      } as any);
      expect(value).to.be.undefined;
    });
  });
}

export function dateTimeMssqlHandlerTest() {
  dateTimeMssqlHandlerTests();
}
