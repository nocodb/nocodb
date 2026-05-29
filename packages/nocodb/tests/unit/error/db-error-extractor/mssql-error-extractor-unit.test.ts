import { expect } from 'chai';
import 'mocha';
import { ClientType } from 'nocodb-sdk';
import { DBErrorExtractor } from '~/helpers/db-error/extractor';

// Pure-unit coverage for MssqlDBErrorExtractor — feeds synthetic tedious-
// error shapes through the extractor without spinning up SQL Server.
//
// Every test constructs a minimal `{ number, message }` (server-side) or
// `{ code, message }` (driver-side) and asserts the resulting message,
// httpStatus, and details. This catches regressions in the per-error-code
// message + regex parsers that would otherwise only surface in prod with
// the wrong user-facing message.
//
// Reference for SQL Server error numbers:
//   https://learn.microsoft.com/sql/relational-databases/errors-events/database-engine-events-and-errors
//
// Note: extract() returns undefined for unhandled codes — we explicitly
// pass clientType: ClientType.MSSQL so the default extractor's fallback
// doesn't mask routing bugs.
function mssqlErrorExtractorUnitTests() {
  const extract = (error: any) =>
    DBErrorExtractor.get().extractDbError(error, {
      clientType: ClientType.MSSQL,
      ignoreDefault: true,
    });

  // ── Server errors (error.number) ────────────────────────────────────────

  describe('102 (syntax)', () => {
    it('returns the syntax message', () => {
      const r = extract({ number: 102, message: "Incorrect syntax near 'FROM'." });
      expect(r.message).to.equal('There was a syntax error in your SQL query.');
      expect(r.code).to.equal('102');
      expect(r.httpStatus).to.equal(422);
    });
  });

  describe('207 (invalid column name)', () => {
    it('parses the column name', () => {
      const r = extract({
        number: 207,
        message: "Invalid column name 'priority'.",
      });
      expect(r.message).to.equal("The column 'priority' does not exist.");
      expect((r as any).details).to.deep.equal({ column: 'priority' });
    });

    it('falls back to generic message when no name in the message', () => {
      const r = extract({ number: 207, message: 'Invalid column name.' });
      expect(r.message).to.equal('The column does not exist.');
      expect((r as any).details).to.be.undefined;
    });
  });

  describe('208 (invalid object name)', () => {
    it('strips schema prefix and surfaces bare table', () => {
      const r = extract({
        number: 208,
        message: "Invalid object name 'dbo.Tasks'.",
      });
      expect(r.message).to.equal("The table 'Tasks' does not exist.");
      expect((r as any).details).to.deep.equal({
        table: 'Tasks',
        qualified: 'dbo.Tasks',
      });
    });

    it('handles unqualified object name', () => {
      const r = extract({
        number: 208,
        message: "Invalid object name 'orders'.",
      });
      expect(r.message).to.equal("The table 'orders' does not exist.");
      expect((r as any).details).to.deep.equal({
        table: 'orders',
        qualified: 'orders',
      });
    });
  });

  describe('213 (column count mismatch)', () => {
    it('returns the generic message', () => {
      const r = extract({
        number: 213,
        message:
          'Column name or number of supplied values does not match table definition.',
      });
      expect(r.message).to.equal(
        'Column count or order does not match the table definition.',
      );
    });
  });

  describe('220 / 8115 (numeric overflow)', () => {
    it('220 returns out-of-range', () => {
      const r = extract({
        number: 220,
        message: 'Arithmetic overflow error for data type tinyint, value = 500.',
      });
      expect(r.message).to.equal('Number is out of range for this field.');
    });

    it('8115 returns out-of-range', () => {
      const r = extract({
        number: 8115,
        message: 'Arithmetic overflow error converting expression to data type int.',
      });
      expect(r.message).to.equal('Number is out of range for this field.');
    });
  });

  describe('229 / 230 / 262 (permission denied)', () => {
    it('parses permission + target from the object-permission form', () => {
      const r = extract({
        number: 229,
        message:
          "The SELECT permission was denied on the object 'Tasks', database 'app', schema 'dbo'.",
      });
      expect(r.message).to.equal("SELECT permission denied on 'Tasks'.");
      expect(r.httpStatus).to.equal(403);
      expect((r as any).details).to.deep.equal({
        permission: 'SELECT',
        target: 'Tasks',
      });
    });

    it('230 column-permission form', () => {
      const r = extract({
        number: 230,
        message:
          "The UPDATE permission was denied on the column 'salary' of the object 'employees'.",
      });
      expect(r.message).to.include('UPDATE permission denied');
      expect((r as any).details.permission).to.equal('UPDATE');
    });

    it('falls back to generic permission message when the regex misses', () => {
      const r = extract({
        number: 262,
        message: 'CREATE TABLE permission denied in database.',
      });
      expect(r.message).to.equal(
        'You do not have permission to perform this action.',
      );
      expect(r.httpStatus).to.equal(403);
    });
  });

  describe('297 (no permission)', () => {
    it('returns 403 with the generic permission message', () => {
      const r = extract({
        number: 297,
        message: 'The user does not have permission to perform this action.',
      });
      expect(r.httpStatus).to.equal(403);
      expect(r.message).to.include('do not have permission');
    });
  });

  describe('241 (bad date/time conversion)', () => {
    it('returns the date-time message', () => {
      const r = extract({
        number: 241,
        message:
          'Conversion failed when converting date and/or time from character string.',
      });
      expect(r.message).to.equal('The date / time value is invalid.');
    });
  });

  describe('245 / 8114 (conversion failure)', () => {
    it('245 parses value + target type', () => {
      const r = extract({
        number: 245,
        message:
          "Conversion failed when converting the nvarchar value 'foo' to data type int.",
      });
      expect(r.message).to.equal("Invalid int value 'foo'");
      expect((r as any).details).to.deep.equal({
        sourceType: 'nvarchar',
        targetType: 'int',
        value: 'foo',
      });
    });

    it('8114 falls back to source→target form', () => {
      const r = extract({
        number: 8114,
        message: 'Error converting data type nvarchar to numeric.',
      });
      expect(r.message).to.equal('Cannot convert nvarchar to numeric.');
      expect((r as any).details).to.deep.equal({
        sourceType: 'nvarchar',
        targetType: 'numeric',
      });
    });
  });

  describe('515 (not-null violation)', () => {
    it('parses column name', () => {
      const r = extract({
        number: 515,
        message:
          "Cannot insert the value NULL into column 'priority', table 'app.dbo.Tasks'; column does not allow nulls.",
      });
      expect(r.message).to.equal('A value is required for this field.');
      expect((r as any).details).to.deep.equal({ column: 'priority' });
    });
  });

  describe('537 (invalid length parameter)', () => {
    it('returns the generic message', () => {
      const r = extract({
        number: 537,
        message: 'Invalid length parameter passed to the LEFT or SUBSTRING function.',
      });
      expect(r.message).to.equal('Invalid length parameter.');
    });
  });

  describe('544 / 545 (IDENTITY_INSERT)', () => {
    it('544 — explicit value for identity column with IDENTITY_INSERT OFF', () => {
      const r = extract({
        number: 544,
        message:
          "Cannot insert explicit value for identity column in table 'Tasks' when IDENTITY_INSERT is set to OFF.",
      });
      expect(r.message).to.include(
        'Cannot insert an explicit value for an identity column',
      );
      expect((r as any).details).to.deep.equal({ table: 'Tasks' });
    });

    it('545 — explicit value required for identity column', () => {
      const r = extract({
        number: 545,
        message:
          "Explicit value must be specified for identity column in table 'Tasks' …",
      });
      expect(r.message).to.include(
        'explicit value is required for the identity column',
      );
      expect((r as any).details).to.deep.equal({ table: 'Tasks' });
    });
  });

  describe('547 (constraint conflict — three flavors)', () => {
    it('FK INSERT/UPDATE violation', () => {
      const r = extract({
        number: 547,
        message:
          'The INSERT statement conflicted with the FOREIGN KEY constraint "FK_Tasks_Owner". The conflict occurred in database "app", table "dbo.Users", column \'id\'.',
      });
      expect(r.message).to.equal(
        "Foreign-key constraint 'FK_Tasks_Owner' violated.",
      );
      expect((r as any).details).to.deep.equal({
        constraint: 'FK_Tasks_Owner',
      });
    });

    it('REFERENCE constraint — DELETE blocked by child rows', () => {
      const r = extract({
        number: 547,
        message:
          'The DELETE statement conflicted with the REFERENCE constraint "FK_Comments_Task". The conflict occurred in database "app", table "dbo.Comments", column \'task_id\'.',
      });
      expect(r.message).to.include('Cannot delete this record');
      expect(r.message).to.include('FK_Comments_Task');
    });

    it('CHECK constraint violation', () => {
      const r = extract({
        number: 547,
        message:
          'The INSERT statement conflicted with the CHECK constraint "CK_Tasks_Priority".',
      });
      expect(r.message).to.equal(
        "Check constraint 'CK_Tasks_Priority' violated.",
      );
      expect((r as any).details).to.deep.equal({
        constraint: 'CK_Tasks_Priority',
      });
    });

    it('falls back to generic FK message when constraint name is absent', () => {
      const r = extract({
        number: 547,
        message: 'The INSERT statement conflicted with the FOREIGN KEY constraint.',
      });
      expect(r.message).to.equal(
        'Foreign-key constraint violation. Please verify the linked record exists.',
      );
    });
  });

  describe('911 (database does not exist)', () => {
    it('parses the database name and returns 500', () => {
      const r = extract({
        number: 911,
        message: "Database 'old_data' does not exist. Make sure that the name is entered correctly.",
      });
      expect(r.message).to.equal("The database 'old_data' does not exist.");
      expect(r.httpStatus).to.equal(500);
      expect((r as any).details).to.deep.equal({ database: 'old_data' });
    });
  });

  describe('952 (database in transition)', () => {
    it('returns 503', () => {
      const r = extract({
        number: 952,
        message: "Database 'app' is in transition. Try the statement later.",
      });
      expect(r.message).to.include('in transition');
      expect(r.httpStatus).to.equal(503);
    });
  });

  describe('1205 (deadlock)', () => {
    it('returns 409', () => {
      const r = extract({
        number: 1205,
        message:
          'Transaction (Process ID 53) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. Rerun the transaction.',
      });
      expect(r.message).to.include('Deadlock');
      expect(r.httpStatus).to.equal(409);
    });
  });

  describe('1222 (lock timeout)', () => {
    it('returns 500', () => {
      const r = extract({
        number: 1222,
        message: 'Lock request time out period exceeded.',
      });
      expect(r.message).to.include('timeout');
      expect(r.httpStatus).to.equal(500);
    });
  });

  describe('1779 (PK already defined)', () => {
    it('returns the generic message', () => {
      const r = extract({
        number: 1779,
        message: "Table 'Tasks' already has a primary key defined on it.",
      });
      expect(r.message).to.include('already has a primary key');
    });
  });

  describe('2601 / 2627 (unique violation)', () => {
    it('2627 PK form — parses constraint + value', () => {
      const r = extract({
        number: 2627,
        message:
          "Violation of PRIMARY KEY constraint 'PK_Tasks'. Cannot insert duplicate key in object 'dbo.Tasks'. The duplicate key value is (42).",
      });
      expect(r.message).to.equal(
        "Primary key violation. Value '42' already exists.",
      );
      expect((r as any).details).to.deep.equal({
        constraint: 'PK_Tasks',
        value: '42',
      });
    });

    it('2627 UNIQUE form (non-PK)', () => {
      const r = extract({
        number: 2627,
        message:
          "Violation of UNIQUE KEY constraint 'UQ_Tasks_Handle'. Cannot insert duplicate key in object 'dbo.Tasks'. The duplicate key value is (foo).",
      });
      expect(r.message).to.equal(
        "Unique constraint violation. Value 'foo' already exists.",
      );
      expect((r as any).details).to.deep.equal({
        constraint: 'UQ_Tasks_Handle',
        value: 'foo',
      });
    });

    it('2601 — duplicate key with unique index name', () => {
      const r = extract({
        number: 2601,
        message:
          "Cannot insert duplicate key row in object 'dbo.Tasks' with unique index 'UX_Tasks_Handle'. The duplicate key value is (bar).",
      });
      expect(r.message).to.equal(
        "Unique constraint violation. Value 'bar' already exists.",
      );
      expect((r as any).details).to.deep.equal({
        index: 'UX_Tasks_Handle',
        value: 'bar',
      });
    });
  });

  describe('2628 / 8152 (data too long)', () => {
    it('2628 parses column name', () => {
      const r = extract({
        number: 2628,
        message:
          "String or binary data would be truncated in table 'app.dbo.Tasks', column 'title'. Truncated value: 'really long…'.",
      });
      expect(r.message).to.equal(
        "The data entered is too long for column 'title'.",
      );
      expect((r as any).details).to.deep.equal({ column: 'title' });
    });

    it('8152 legacy message without column', () => {
      const r = extract({
        number: 8152,
        message: 'String or binary data would be truncated.',
      });
      expect(r.message).to.equal('The data entered is too long for this field.');
      expect((r as any).details).to.be.undefined;
    });
  });

  describe('2705 (column already exists)', () => {
    it('parses the column name', () => {
      const r = extract({
        number: 2705,
        message:
          "Column names in each table must be unique. Column name 'title' in table 'Tasks' is specified more than once.",
      });
      expect(r.message).to.equal("The column 'title' already exists.");
      expect((r as any).details).to.deep.equal({ column: 'title' });
    });
  });

  describe('2714 (table already exists)', () => {
    it('parses the object name', () => {
      const r = extract({
        number: 2714,
        message:
          "There is already an object named 'Tasks' in the database.",
      });
      expect(r.message).to.equal("The table 'Tasks' already exists.");
      expect((r as any).details).to.deep.equal({ table: 'Tasks' });
    });
  });

  describe('3701 / 4902 (object does not exist on drop)', () => {
    it('returns the generic message', () => {
      const r = extract({
        number: 3701,
        message: "Cannot drop the table 'old_t', because it does not exist or you do not have permission.",
      });
      expect(r.message).to.equal('The object does not exist.');
    });
  });

  describe('3726 (drop blocked by FK)', () => {
    it('parses the object name', () => {
      const r = extract({
        number: 3726,
        message:
          "Could not drop object 'Tasks' because it is referenced by a FOREIGN KEY constraint.",
      });
      expect(r.message).to.equal(
        "Cannot drop 'Tasks' because it is referenced by a foreign key.",
      );
      expect((r as any).details).to.deep.equal({ object: 'Tasks' });
    });
  });

  describe('3727 (could not drop constraint)', () => {
    it('returns the generic message', () => {
      const r = extract({
        number: 3727,
        message: 'Could not drop constraint. See previous errors.',
      });
      expect(r.message).to.include('Could not drop the constraint');
    });
  });

  describe('3728 (not a constraint)', () => {
    it('parses the name', () => {
      const r = extract({
        number: 3728,
        message: "'CK_Foo' is not a constraint.",
      });
      expect(r.message).to.equal("'CK_Foo' is not a constraint.");
      expect((r as any).details).to.deep.equal({ constraint: 'CK_Foo' });
    });
  });

  describe('3960 (snapshot conflict)', () => {
    it('returns 409', () => {
      const r = extract({
        number: 3960,
        message:
          'Snapshot isolation transaction aborted due to update conflict.',
      });
      expect(r.httpStatus).to.equal(409);
      expect(r.message).to.include('serialization failure');
    });
  });

  describe('4060 (cannot open database)', () => {
    it('returns 500', () => {
      const r = extract({
        number: 4060,
        message: "Cannot open database 'app' requested by the login.",
      });
      expect(r.httpStatus).to.equal(500);
      expect(r.message).to.include('does not exist or is not accessible');
    });
  });

  describe('8623 (query too complex)', () => {
    it('returns 500', () => {
      const r = extract({
        number: 8623,
        message:
          'The query processor ran out of internal resources and could not produce a query plan.',
      });
      expect(r.message).to.include('too complex');
      expect(r.httpStatus).to.equal(500);
    });
  });

  describe('9002 (txn log full)', () => {
    it('returns 500', () => {
      const r = extract({
        number: 9002,
        message: "The transaction log for database 'app' is full due to 'ACTIVE_TRANSACTION'.",
      });
      expect(r.message).to.include('transaction log is full');
      expect(r.httpStatus).to.equal(500);
    });
  });

  describe('18452 / 18456 (login failure)', () => {
    it('returns 401', () => {
      const r = extract({
        number: 18456,
        message: "Login failed for user 'sa'.",
      });
      expect(r.httpStatus).to.equal(401);
      expect(r.message).to.include('do not have permission');
    });
  });

  describe('50000 (RAISERROR)', () => {
    it('surfaces the server-authored message', () => {
      const r = extract({
        number: 50000,
        message: 'Custom: Inventory cannot go below zero.',
      });
      expect(r.message).to.equal('Custom: Inventory cannot go below zero.');
    });

    it('falls back when the message is empty', () => {
      const r = extract({ number: 50000, message: '' });
      expect(r.message).to.equal('Database raised an exception.');
    });
  });

  describe('unhandled server error number', () => {
    it('returns undefined so the caller can fall through', () => {
      const r = extract({ number: 999999, message: 'some new error' });
      expect(r).to.be.undefined;
    });
  });

  // ── Driver errors (error.code without error.number) ─────────────────────

  describe('ELOGIN (driver)', () => {
    it('returns 401', () => {
      const r = extract({ code: 'ELOGIN', message: 'Login failed for user.' });
      expect(r.httpStatus).to.equal(401);
      expect(r.message).to.include('Authentication failed');
    });
  });

  describe('ETIMEOUT (driver)', () => {
    it('returns 500', () => {
      const r = extract({ code: 'ETIMEOUT', message: 'Connection timeout.' });
      expect(r.message).to.include('timeout');
      expect(r.httpStatus).to.equal(500);
    });
  });

  describe('ESOCKET (driver)', () => {
    it('returns the connection-lost message', () => {
      const r = extract({ code: 'ESOCKET', message: 'Connection lost.' });
      expect(r.message).to.equal('The connection to the database was lost.');
    });
  });

  describe('EREQUEST (driver, no server number)', () => {
    it('returns the generic request message', () => {
      const r = extract({ code: 'EREQUEST', message: 'Request rejected.' });
      expect(r.message).to.include('database error');
    });
  });

  describe('EABORT / ECANCEL (driver)', () => {
    it('returns the aborted message', () => {
      const r = extract({ code: 'EABORT', message: 'Aborted.' });
      expect(r.message).to.include('aborted');
    });
  });

  describe('EINVALIDSTATE (driver)', () => {
    it('returns the invalid-state message', () => {
      const r = extract({ code: 'EINVALIDSTATE', message: 'Invalid state.' });
      expect(r.message).to.include('invalid state');
    });
  });

  describe('unhandled driver code', () => {
    it('returns undefined', () => {
      const r = extract({ code: 'EFOOBAR', message: 'New unknown driver error.' });
      expect(r).to.be.undefined;
    });
  });

  // ── Routing: server number takes precedence over driver code ────────────

  describe('routing (server > driver)', () => {
    it('prefers error.number over error.code when both are present', () => {
      // tedious sets code='EREQUEST' on server-side errors AND attaches
      // number=2627 for the actual SQL Server error. The extractor must
      // dispatch on `number` (specific) not `code` (generic).
      const r = extract({
        code: 'EREQUEST',
        number: 2627,
        message:
          "Violation of UNIQUE KEY constraint 'UQ_x'. Cannot insert duplicate key in object 'dbo.t'. The duplicate key value is (42).",
      });
      expect((r as any).details).to.have.property('constraint', 'UQ_x');
      expect(r.message).to.include('Unique constraint violation');
    });
  });
}

export function mssqlErrorExtractorUnitTest() {
  describe('MssqlErrorExtractorUnitTest', mssqlErrorExtractorUnitTests);
}
