import { NcErrorType } from 'nocodb-sdk';
import { DBError } from './utils';
import type { Logger } from '@nestjs/common';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';

/**
 * MSSQL error extractor.
 *
 * `tedious` (the underlying driver knex uses for the `mssql` dialect)
 * attaches two diagnostic fields:
 *
 *   - `error.code`: driver-level string — `'EREQUEST'`, `'ELOGIN'`,
 *     `'ETIMEOUT'`, `'ESOCKET'`, `'EABORT'`, `'ECANCEL'`,
 *     `'EINVALIDSTATE'`. Set for ALL errors, including the wrapper around
 *     a server-side error.
 *
 *   - `error.number`: the numeric SQL Server error number (207 "invalid
 *     column name", 2627 "unique constraint", 547 "FK conflict", …). Set
 *     ONLY for server-side errors; this is the field to switch on.
 *
 * Strategy: prefer `error.number` when present (server-side error, most
 * specific). Fall back to `error.code` for transport-level errors
 * (login / timeout / socket).
 *
 * Reference: https://learn.microsoft.com/sql/relational-databases/errors-events/database-engine-events-and-errors
 */
export class MssqlDBErrorExtractor implements IClientDbErrorExtractor {
  constructor(
    private readonly option?: {
      dbErrorLogger?: Logger;
    },
  ) {}

  extract(error: any): DBErrorExtractResult {
    // Most reliable signal — SQL Server error number, when present.
    if (typeof error?.number === 'number') {
      return this.extractServerError(error);
    }

    // Driver-level error without a server number (login / timeout / socket).
    if (typeof error?.code === 'string') {
      return this.extractDriverError(error);
    }

    return;
  }

  private extractServerError(error: any): DBErrorExtractResult {
    let message: string;
    let _extra: Record<string, any>;
    let _type: DBError;
    let httpStatus = 422;
    const number = error.number as number;
    const errorMessage: string = error.message ?? '';

    switch (number) {
      case 102: // Incorrect syntax near '...'
        message = 'There was a syntax error in your SQL query.';
        break;

      case 207: {
        // Invalid column name '...'
        message = 'The column does not exist.';
        const m = errorMessage.match(/Invalid column name '([^']+)'/i);
        if (m?.[1]) {
          message = `The column '${m[1]}' does not exist.`;
          _type = DBError.COLUMN_NOT_EXIST;
          _extra = { column: m[1] };
        }
        break;
      }

      case 208: {
        // Invalid object name '...' (table/view not found)
        message = 'The table does not exist.';
        const m = errorMessage.match(/Invalid object name '([^']+)'/i);
        if (m?.[1]) {
          // Strip schema prefix (e.g. "dbo.Tasks" → "Tasks") for the surface
          // message; keep the raw qualified name in `_extra.table` for
          // anyone who needs to disambiguate.
          const qualified = m[1];
          const bare = qualified.split('.').pop();
          message = `The table '${bare}' does not exist.`;
          _type = DBError.TABLE_NOT_EXIST;
          _extra = { table: bare, qualified };
        }
        break;
      }

      case 213: // Column name or number of supplied values does not match table definition.
        message = 'Column count or order does not match the table definition.';
        break;

      case 220: // Arithmetic overflow error for data type ...
      case 8115: // Arithmetic overflow error converting ... to data type ...
        message = 'Number is out of range for this field.';
        _type = DBError.DATA_TYPE_MISMATCH;
        break;

      case 229: // The <permission> permission was denied on the object '...'
      case 230: // The <permission> permission was denied on the column '...'
      case 262: {
        // <PERMISSION> permission denied in database '...'.
        message = 'You do not have permission to perform this action.';
        httpStatus = 403;
        const m = errorMessage.match(
          /The (\w+) permission was denied on (?:the )?(?:object|column) '([^']+)'/i,
        );
        if (m) {
          message = `${m[1]} permission denied on '${m[2]}'.`;
          _extra = { permission: m[1], target: m[2] };
        }
        break;
      }

      case 297: // The user does not have permission to perform this action.
        message = 'You do not have permission to perform this action.';
        httpStatus = 403;
        break;

      case 241: // Conversion failed when converting date and/or time from character string.
        message = 'The date / time value is invalid.';
        _type = DBError.DATA_TYPE_MISMATCH;
        break;

      case 245: // Conversion failed when converting the <type> value '<v>' to data type <target>
      case 8114: {
        // Error converting data type <source> to <target>
        message = 'Invalid data type or value for column.';
        _type = DBError.DATA_TYPE_MISMATCH;
        const m = errorMessage.match(
          /converting (?:the )?(\w+) (?:value )?'([^']+)' to data type (\w+)/i,
        );
        if (m) {
          const [, sourceType, invalidValue, targetType] = m;
          message = `Invalid ${targetType} value '${invalidValue}'`;
          _extra = { sourceType, targetType, value: invalidValue };
        } else {
          const m2 = errorMessage.match(
            /Error converting data type (\w+) to (\w+)/i,
          );
          if (m2) {
            const [, sourceType, targetType] = m2;
            message = `Cannot convert ${sourceType} to ${targetType}.`;
            _extra = { sourceType, targetType };
          }
        }
        break;
      }

      case 515: {
        // Cannot insert the value NULL into column '...', table '...'; …
        message = 'A value is required for this field.';
        _type = DBError.COLUMN_NOT_NULL;
        const m = errorMessage.match(
          /Cannot insert (?:the )?value NULL into column '([^']+)'/i,
        );
        if (m?.[1]) {
          _extra = { column: m[1] };
        }
        break;
      }

      case 537: // Invalid length parameter passed to the LEFT or SUBSTRING function.
        message = 'Invalid length parameter.';
        break;

      case 544: {
        // Cannot insert explicit value for identity column in table '...'
        // when IDENTITY_INSERT is set to OFF.
        message =
          'Cannot insert an explicit value for an identity column. Identity columns are auto-generated.';
        const m = errorMessage.match(
          /identity column in table '([^']+)'/i,
        );
        if (m?.[1]) {
          _extra = { table: m[1] };
        }
        break;
      }

      case 545: {
        // Explicit value must be specified for identity column in table '...'
        // either when IDENTITY_INSERT is set to ON or when a replication user
        // is inserting into a NOT FOR REPLICATION identity column.
        message =
          'An explicit value is required for the identity column on this table.';
        const m = errorMessage.match(
          /identity column in table '([^']+)'/i,
        );
        if (m?.[1]) {
          _extra = { table: m[1] };
        }
        break;
      }

      case 547: {
        // 547 covers THREE constraint-conflict scenarios — disambiguate
        // by the constraint-type wording in the message:
        //   - "FOREIGN KEY constraint" — INSERT/UPDATE FK violation
        //   - "REFERENCE constraint"   — DELETE blocked by FK referencing
        //   - "CHECK constraint"       — CHECK violation
        const isCheck = /CHECK constraint/i.test(errorMessage);
        const isDelete = /REFERENCE constraint/i.test(errorMessage);

        if (isCheck) {
          message = 'Check constraint violated.';
          const m = errorMessage.match(
            /conflicted with the CHECK constraint "([^"]+)"/i,
          );
          if (m?.[1]) {
            message = `Check constraint '${m[1]}' violated.`;
            _extra = { constraint: m[1] };
          }
        } else {
          message = isDelete
            ? 'Cannot delete this record because other records depend on it.'
            : 'Foreign-key constraint violation. Please verify the linked record exists.';
          const m = errorMessage.match(
            /conflicted with the (?:FOREIGN KEY|REFERENCE)\s+constraint "([^"]+)"/i,
          );
          if (m?.[1]) {
            _extra = { constraint: m[1] };
            message = isDelete
              ? `Cannot delete this record because other records depend on it (constraint '${m[1]}').`
              : `Foreign-key constraint '${m[1]}' violated.`;
          }
        }
        break;
      }

      case 911: { // Database '...' does not exist. Make sure that the name is entered correctly.
        message = 'The database does not exist.';
        const m = errorMessage.match(/Database '([^']+)' does not exist/i);
        if (m?.[1]) {
          message = `The database '${m[1]}' does not exist.`;
          _extra = { database: m[1] };
        }
        httpStatus = 500;
        break;
      }

      case 952: // Database '...' is in transition. Try the statement later.
        message = 'The database is in transition. Please retry the operation.';
        httpStatus = 503;
        break;

      case 1205: // Transaction (Process ID ...) was deadlocked
        message = 'Deadlock detected. Please retry the operation.';
        httpStatus = 409;
        break;

      case 1222: // Lock request time out period exceeded
        message = 'A timeout occurred while waiting for a table lock.';
        httpStatus = 500;
        break;

      case 1779: // Table '...' already has a primary key defined on it.
        message = 'This table already has a primary key defined.';
        break;

      case 2601: // Cannot insert duplicate key row in object '...' with unique index '...'.
      case 2627: {
        // Violation of PRIMARY KEY / UNIQUE KEY constraint '...'. Cannot
        // insert duplicate key in object '...'. The duplicate key value is (<v>).
        const isPk = /PRIMARY KEY constraint/i.test(errorMessage);
        message = isPk
          ? 'Primary key violation. This record already exists.'
          : 'This record already exists.';
        _type = DBError.UNIQUE_CONSTRAINT_VIOLATION;

        const constraintMatch = errorMessage.match(/constraint '([^']+)'/i);
        const valueMatch = errorMessage.match(
          /duplicate key value is \(([^)]+)\)/i,
        );
        const indexMatch = errorMessage.match(/unique index '([^']+)'/i);

        if (constraintMatch || valueMatch || indexMatch) {
          _extra = {};
          if (constraintMatch) _extra.constraint = constraintMatch[1];
          if (indexMatch) _extra.index = indexMatch[1];
          if (valueMatch) {
            _extra.value = valueMatch[1];
            message = isPk
              ? `Primary key violation. Value '${valueMatch[1]}' already exists.`
              : `Unique constraint violation. Value '${valueMatch[1]}' already exists.`;
          }
        }
        break;
      }

      case 2628: // String or binary data would be truncated in table '...', column '...'. (SQL 2017+)
      case 8152: {
        // String or binary data would be truncated. (legacy)
        message = 'The data entered is too long for this field.';
        const m = errorMessage.match(/column '([^']+)'/i);
        if (m?.[1]) {
          message = `The data entered is too long for column '${m[1]}'.`;
          _extra = { column: m[1] };
        }
        break;
      }

      case 2705: {
        // Column names in each table must be unique. Column name '...' in table '...' is specified more than once.
        message = 'The column already exists.';
        const m = errorMessage.match(
          /Column name '([^']+)' in (?:table|object) '([^']+)' is specified more than once/i,
        );
        if (m?.[1]) {
          message = `The column '${m[1]}' already exists.`;
          _type = DBError.COLUMN_EXIST;
          _extra = { column: m[1] };
        }
        break;
      }

      case 2714: {
        // There is already an object named '...' in the database.
        message = 'The table already exists.';
        const m = errorMessage.match(
          /There is already an object named '([^']+)' in the database/i,
        );
        if (m?.[1]) {
          message = `The table '${m[1]}' already exists.`;
          _type = DBError.TABLE_EXIST;
          _extra = { table: m[1] };
        }
        break;
      }

      case 3701: // Cannot drop the X '...', because it does not exist
      case 4902: // Cannot find the object '...' because it does not exist or you do not have permissions.
        message = 'The object does not exist.';
        break;

      case 3726: { // Could not drop object '...' because it is referenced by a FOREIGN KEY constraint.
        message =
          'Cannot drop this object because it is referenced by a foreign key.';
        const m = errorMessage.match(
          /Could not drop object '([^']+)' because it is referenced by a FOREIGN KEY constraint/i,
        );
        if (m?.[1]) {
          message = `Cannot drop '${m[1]}' because it is referenced by a foreign key.`;
          _extra = { object: m[1] };
        }
        break;
      }

      case 3727: // Could not drop constraint. See previous errors.
        message =
          'Could not drop the constraint. It may be referenced by other constraints.';
        break;

      case 3728: { // '...' is not a constraint.
        message = 'The specified constraint does not exist.';
        const m = errorMessage.match(/'([^']+)' is not a constraint/i);
        if (m?.[1]) {
          message = `'${m[1]}' is not a constraint.`;
          _type = DBError.CONSTRAINT_NOT_EXIST;
          _extra = { constraint: m[1] };
        }
        break;
      }

      case 3960: // Snapshot isolation transaction aborted due to update conflict.
        message = 'Transaction serialization failure. Please retry.';
        httpStatus = 409;
        break;

      case 4060: // Cannot open database '...' requested by the login.
        message = 'The database does not exist or is not accessible.';
        httpStatus = 500;
        break;

      case 8623: // The query processor ran out of internal resources / memory.
        message =
          'The query is too complex. Please simplify it and try again.';
        httpStatus = 500;
        break;

      case 9002: // The transaction log for database '...' is full due to '...'.
        message =
          'The database transaction log is full. Please contact the database administrator.';
        httpStatus = 500;
        break;

      case 18452: // Login failed. The login is from an untrusted domain ...
      case 18456: // Login failed for user '...'
        message = 'You do not have permission to perform this action.';
        httpStatus = 401;
        break;

      case 50000: // RAISERROR with a user-defined severity
        // Surface the server-authored message directly.
        message = errorMessage || 'Database raised an exception.';
        break;

      default:
        this.option?.dbErrorLogger?.error(
          `MSSQL error ${number} is not handled`,
        );
        // Fall through with a generic message — keep the surface response
        // sane while the unhandled code is logged for triage.
        message = 'An error occurred when querying mssql database.';
        httpStatus = 500;
        return;
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: String(number),
      httpStatus,
      ...(_extra && { details: _extra }),
    };
  }

  private extractDriverError(error: any): DBErrorExtractResult {
    let message: string;
    let httpStatus = 500;

    switch (error.code) {
      case 'ELOGIN':
        message =
          'Authentication failed. Please verify the database credentials.';
        httpStatus = 401;
        break;
      case 'ETIMEOUT':
        message = 'A timeout occurred while connecting to the database.';
        break;
      case 'ESOCKET':
        message = 'The connection to the database was lost.';
        break;
      case 'EREQUEST':
        // EREQUEST without an `error.number` is rare — usually means the
        // request was rejected before reaching the server (e.g. malformed
        // TDS, aborted connection mid-request).
        message = 'A database error occurred while processing the request.';
        break;
      case 'EABORT':
      case 'ECANCEL':
        message = 'The database operation was aborted.';
        break;
      case 'EINVALIDSTATE':
        message = 'The database connection is in an invalid state.';
        break;
      default:
        this.option?.dbErrorLogger?.error(
          `${error.code} is not handled on database mssql`,
        );
        return;
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
