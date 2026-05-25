import { expect } from 'chai';
import 'mocha';
import { ClientType } from 'nocodb-sdk';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';

// Pure-unit coverage for PgDBErrorExtractor — feeds synthetic pg-error
// shapes through the extractor without spinning up a live database.
// Complements pg-error-extractor.test.ts (which runs against a real PG
// instance and only exercises 22011 / 42601).
function pgErrorExtractorUnitTests() {
  const extract = (error: any) =>
    DBErrorExtractor.get().extractDbError(error, { clientType: ClientType.PG });

  describe('23502 (not_null_violation)', () => {
    // The 23502 base message stays generic — downstream consumers
    // (e.g. the data-import error formatter) layer the column name on
    // top via `details.column` to keep the assertion shape consistent
    // with other SQLSTATEs that don't carry a column.
    it('exposes column via details when error.column is set', () => {
      const result = extract({
        code: '23502',
        column: 'priority',
        message:
          'null value in column "priority" of relation "tasks" violates not-null constraint',
      });
      expect(result.message).to.equal('A value is required for this field.');
      expect((result as any).details).to.deep.equal({ column: 'priority' });
    });

    it('parses column out of error.message when error.column is missing', () => {
      const result = extract({
        code: '23502',
        message:
          'null value in column "priority" of relation "tasks" violates not-null constraint',
      });
      expect(result.message).to.equal('A value is required for this field.');
      expect((result as any).details).to.deep.equal({ column: 'priority' });
    });

    it('falls back to generic message + no details when the column cannot be parsed', () => {
      const result = extract({
        code: '23502',
        message: 'null value violates not-null constraint',
      });
      expect(result.message).to.equal('A value is required for this field.');
      expect((result as any).details).to.be.undefined;
    });
  });

  describe('23503 (foreign_key_violation)', () => {
    it('strips physical table name from "is not present" detail', () => {
      const result = extract({
        code: '23503',
        constraint: 'tasks_owner_fkey',
        detail: 'Key (owner_id)=(42) is not present in table "nc_abc___users".',
      });
      // Physical table name must NOT be exposed
      expect(result.message).to.not.include('nc_abc___users');
      expect(result.message).to.include('Key (owner_id)=(42) is not present');
      expect((result as any).details).to.deep.equal({
        constraint: 'tasks_owner_fkey',
      });
    });

    it('strips physical table name from "is still referenced" detail', () => {
      const result = extract({
        code: '23503',
        constraint: 'comments_task_fkey',
        detail:
          'Key (id)=(7) is still referenced from table "nc_abc___comments".',
      });
      expect(result.message).to.not.include('nc_abc___comments');
      expect(result.message).to.include('Cannot delete this record');
      expect(result.message).to.include('Key (id)=(7) is still referenced');
    });

    it('uses generic message when detail is absent', () => {
      const result = extract({
        code: '23503',
        constraint: 'tasks_owner_fkey',
      });
      expect(result.message).to.include('Foreign-key constraint violation');
    });
  });

  describe('23514 (check_violation)', () => {
    it('uses constraint name + hint when both present', () => {
      const result = extract({
        code: '23514',
        constraint: 'tasks_priority_check',
        hint: 'priority must be one of low, medium, high',
      });
      expect(result.message).to.include('tasks_priority_check');
      expect(result.message).to.include(
        'priority must be one of low, medium, high',
      );
    });

    it('uses constraint name alone when no hint', () => {
      const result = extract({
        code: '23514',
        constraint: 'tasks_priority_check',
      });
      expect(result.message).to.equal(
        "Check constraint 'tasks_priority_check' violated.",
      );
    });
  });

  describe('P0001 (raise_exception)', () => {
    it('surfaces error.original.message when present', () => {
      const result = extract({
        code: 'P0001',
        message: 'insert into "x" - some pg wrapper text',
        original: { message: 'priority must be set' },
      });
      expect(result.message).to.equal('priority must be set');
    });

    it('strips Knex SQL prefix from error.message', () => {
      const result = extract({
        code: 'P0001',
        message:
          'insert into "tasks" ("title") values ($1) - priority must be set',
      });
      expect(result.message).to.equal('priority must be set');
    });

    it('preserves user-authored " - " inside the message after stripping prefix', () => {
      // Regression: lastIndexOf would have returned only "see field help";
      // indexOf preserves the full author-written message.
      const result = extract({
        code: 'P0001',
        message:
          'insert into "tasks" values ($1) - priority must be set - see field help',
      });
      expect(result.message).to.equal('priority must be set - see field help');
    });

    it('joins HINT onto the message with an em-dash', () => {
      const result = extract({
        code: 'P0001',
        original: { message: 'priority must be set' },
        hint: 'open the row to fill it',
      });
      expect(result.message).to.equal(
        'priority must be set — open the row to fill it',
      );
    });
  });
}

export function pgErrorExtractorUnitTest() {
  describe('PgErrorExtractorUnitTest', pgErrorExtractorUnitTests);
}

// Allow running this file standalone (e.g. `mocha <this-file>`) without
// going through tests/unit/index.test.ts. The full unit runner sets
// `process.env.TEST` (see tests/unit/index.test.ts) — when it's set we
// skip the top-level invocation so index.test.ts can register the suite
// itself.
if (!process.env.TEST) {
  pgErrorExtractorUnitTest();
}
