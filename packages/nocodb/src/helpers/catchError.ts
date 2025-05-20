import { Logger } from '@nestjs/common';
import { NcErrorType } from 'nocodb-sdk';
export {
  NcBaseError,
  NcBaseErrorv2,
  NcErrorArgs,
  OptionsNotExistsError,
  BadRequestV2 as BadRequest,
  MetaError,
  SsoError,
  NotFound,
  UnprocessableEntity,
  Unauthorized,
  TestConnectionError,
  Forbidden,
  ExternalError,
  ExternalTimeout,
} from 'nocodb-sdk';
export { AjvError, NcError } from '~/helpers/ncError';

const dbErrorLogger = new Logger('MissingDBError');

export enum DBError {
  TABLE_EXIST = 'TABLE_EXIST',
  TABLE_NOT_EXIST = 'TABLE_NOT_EXIST',
  COLUMN_EXIST = 'COLUMN_EXIST',
  COLUMN_NOT_EXIST = 'COLUMN_NOT_EXIST',
  CONSTRAINT_EXIST = 'CONSTRAINT_EXIST',
  CONSTRAINT_NOT_EXIST = 'CONSTRAINT_NOT_EXIST',
  COLUMN_NOT_NULL = 'COLUMN_NOT_NULL',
  DATA_TYPE_MISMATCH = 'DATA_TYPE_MISMATCH',
}

// extract db errors using database error code
export function extractDBError(error): {
  message: string;
  error: string;
  details?: any;
  code?: string;
  httpStatus: number;
} | void {
  if (!error.code) return;

  let message: string;
  let _extra: Record<string, any>;
  let _type: DBError;
  let httpStatus = 422;

  // todo: handle not null constraint error for all databases
  switch (error.code) {
    // sqlite errors
    case 'SQLITE_BUSY':
      message = 'The database is locked by another process or transaction.';
      httpStatus = 500;
      break;
    case 'SQLITE_CONSTRAINT':
      {
        const constraint = /FOREIGN KEY|UNIQUE/.test(error.message)
          ? error.message.match(/FOREIGN KEY|UNIQUE/gi)?.join(' ')
          : 'constraint';
        message = `A ${constraint} constraint was violated: ${error.message}`;
        _extra = {
          constraint,
        };
      }
      break;
    case 'SQLITE_CORRUPT':
      message = 'The database file is corrupt.';
      httpStatus = 500;
      break;

    case 'SQLITE_MISMATCH':
      if (error.message) {
        message = 'Data type mismatch in SQLite operation.';
        _type = DBError.DATA_TYPE_MISMATCH;
      }
      break;
    case 'SQLITE_ERROR':
      message = 'A SQL error occurred.';

      if (error.message) {
        const noSuchTableMatch = error.message.match(/no such table: (\w+)/);
        const tableAlreadyExistsMatch = error.message.match(
          /SQLITE_ERROR: table `?(\w+)`? already exists/,
        );

        const duplicateColumnExistsMatch = error.message.match(
          /SQLITE_ERROR: duplicate column name: (\w+)/,
        );
        const unrecognizedTokenMatch = error.message.match(
          /SQLITE_ERROR: unrecognized token: "(\w+)"/,
        );
        const columnDoesNotExistMatch = error.message.match(
          /SQLITE_ERROR: no such column: (\w+)/,
        );
        const constraintFailedMatch = error.message.match(
          /SQLITE_ERROR: constraint failed: (\w+)/,
        );

        if (noSuchTableMatch && noSuchTableMatch[1]) {
          message = `The table '${noSuchTableMatch[1]}' does not exist.`;
          _type = DBError.TABLE_NOT_EXIST;
          _extra = {
            table: noSuchTableMatch[1],
          };
        } else if (tableAlreadyExistsMatch && tableAlreadyExistsMatch[1]) {
          message = `The table '${tableAlreadyExistsMatch[1]}' already exists.`;
          _type = DBError.TABLE_EXIST;
          _extra = {
            table: tableAlreadyExistsMatch[1],
          };
        } else if (unrecognizedTokenMatch && unrecognizedTokenMatch[1]) {
          message = `Unrecognized token: ${unrecognizedTokenMatch[1]}`;
          _extra = {
            token: unrecognizedTokenMatch[1],
          };
        } else if (columnDoesNotExistMatch && columnDoesNotExistMatch[1]) {
          message = `The column ${columnDoesNotExistMatch[1]} does not exist.`;
          _type = DBError.COLUMN_NOT_EXIST;
          _extra = {
            column: columnDoesNotExistMatch[1],
          };
        } else if (constraintFailedMatch && constraintFailedMatch[1]) {
          message = `A constraint failed: ${constraintFailedMatch[1]}`;
        } else if (
          duplicateColumnExistsMatch &&
          duplicateColumnExistsMatch[1]
        ) {
          message = `The column '${duplicateColumnExistsMatch[1]}' already exists.`;
          _type = DBError.COLUMN_EXIST;
          _extra = {
            column: duplicateColumnExistsMatch[1],
          };
        } else {
          const match = error.message.match(/SQLITE_ERROR:\s*(\w+)/);
          if (match && match[1]) {
            message = match[1];
          }
        }
      }
      break;
    case 'SQLITE_RANGE':
      message = 'A column index is out of range.';
      break;
    case 'SQLITE_SCHEMA':
      message = 'The database schema has changed.';
      break;

    // mysql errors
    case 'ER_TRUNCATED_WRONG_VALUE':
    case 'ER_WRONG_VALUE':
      if (error.message) {
        const typeMismatchMatch = error.message.match(
          /Incorrect (\w+) value: (.+) for column '(\w+)'/i,
        );
        if (typeMismatchMatch) {
          const dataType = typeMismatchMatch[1];
          const invalidValue = typeMismatchMatch[2];
          const columnName = typeMismatchMatch[3];

          message = `Invalid ${dataType} value '${invalidValue}' for column '${columnName}'`;
          _type = DBError.DATA_TYPE_MISMATCH;
          _extra = { dataType, column: columnName, value: invalidValue };
        } else {
          message = 'Invalid data format for a column.';
          _type = DBError.DATA_TYPE_MISMATCH;
        }
      }
      break;
    case 'ER_TABLE_EXISTS_ERROR':
      message = 'The table already exists.';

      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / Table '?(\w+)'? already exists/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' already exists.`;
          _type = DBError.TABLE_EXIST;
          _extra = {
            table: extractTableNameMatch[1],
          };
        }
      }
      break;
    case 'ER_DUP_FIELDNAME':
      message = 'The column already exists.';

      if (error.message) {
        const extractColumnNameMatch = error.message.match(
          / Duplicate column name '(\w+)'/i,
        );
        if (extractColumnNameMatch && extractColumnNameMatch[1]) {
          message = `The column '${extractColumnNameMatch[1]}' already exists.`;
          _type = DBError.COLUMN_EXIST;
          _extra = {
            column: extractColumnNameMatch[1],
          };
        }
      }

      break;
    case 'ER_NO_SUCH_TABLE':
      message = 'The table does not exist.';

      if (error.message) {
        const missingTableMatch = error.message.match(
          / Table '(?:\w+\.)?(\w+)' doesn't exist/i,
        );
        if (missingTableMatch && missingTableMatch[1]) {
          message = `The table '${missingTableMatch[1]}' does not exist`;
          _type = DBError.TABLE_NOT_EXIST;
          _extra = {
            table: missingTableMatch[1],
          };
        }
      }

      break;
    case 'ER_DUP_ENTRY':
      message = 'This record already exists.';
      break;
    case 'ER_PARSE_ERROR':
      message = 'There was a syntax error in your SQL query.';
      break;
    case 'ER_NO_DEFAULT_FOR_FIELD':
      message = 'A value is required for this field.';
      break;
    case 'ER_BAD_NULL_ERROR':
      message = 'A null value is not allowed for this field.';
      {
        const extractColNameMatch = error.message.match(
          /Column '(\w+)' cannot be null/i,
        );
        if (extractColNameMatch && extractColNameMatch[1]) {
          message = `The column '${extractColNameMatch[1]}' cannot be null.`;
          _type = DBError.COLUMN_NOT_NULL;
          _extra = {
            column: extractColNameMatch[1],
          };
        }
      }

      break;
    case 'ER_DATA_TOO_LONG':
      message = 'The data entered is too long for this field.';
      break;
    case 'ER_BAD_FIELD_ERROR':
      {
        message = 'The field you are trying to access does not exist.';
        const extractColNameMatch = error.message.match(
          / Unknown column '(\w+)' in 'field list'/i,
        );
        if (extractColNameMatch && extractColNameMatch[1]) {
          message = `The column '${extractColNameMatch[1]}' does not exist.`;
          _type = DBError.COLUMN_NOT_EXIST;
          _extra = {
            column: extractColNameMatch[1],
          };
        }
      }
      break;
    case 'ER_ACCESS_DENIED_ERROR':
      message = 'You do not have permission to perform this action.';
      httpStatus = 403;
      break;
    case 'ER_LOCK_WAIT_TIMEOUT':
      message = 'A timeout occurred while waiting for a table lock.';
      httpStatus = 500;
      break;
    case 'ER_NO_REFERENCED_ROW':
      message = 'The referenced record does not exist.';
      break;
    case 'ER_ROW_IS_REFERENCED':
      message = 'This record is being referenced by other records.';
      break;

    // postgres errors
    case '23505':
      message = 'This record already exists.';
      break;
    case '42601':
      message = 'There was a syntax error in your SQL query.';
      break;
    case '23502':
      message = 'A value is required for this field.';
      break;
    case '23503':
      message =
        'Cannot delete this record because other records depend on it. Please remove the dependent records first.';
      break;
    case '23514':
      message = 'A null value is not allowed for this field.';
      break;
    case '22001':
      message = 'The data entered is too long for this field.';
      break;
    case '22007':
      message = 'The date / time value is invalid';
      break;
    case '28000':
      message = 'You do not have permission to perform this action.';
      httpStatus = 401;
      break;
    case '40P01':
      message = 'A timeout occurred while waiting for a table lock.';
      httpStatus = 500;
      break;
    case '23506':
      message = 'This record is being referenced by other records.';
      break;
    case '3D000':
      message = 'The database does not exist.';
      break;
    case '42P07':
      message = 'The table already exists.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / relation "?(\w+)"? already exists/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' already exists.`;
          _type = DBError.TABLE_EXIST;
          _extra = {
            table: extractTableNameMatch[1],
          };
        }
      }
      break;
    case '22P02': // PostgreSQL invalid_text_representation
    case '22003': // PostgreSQL numeric_value_out_of_range
      if (error.message) {
        const regexCandidates = [
          /invalid input syntax for (\w+): "(.+)"(?: in column "(\w+)")?/i,
          /invalid input syntax for type (\w+): "([^"]+)"?/i,
        ];

        let matched = false;
        for (const regExp of regexCandidates) {
          const pgTypeMismatchMatch = error.message.match(regExp);
          if (pgTypeMismatchMatch) {
            const dataType = pgTypeMismatchMatch[1];
            const invalidValue = pgTypeMismatchMatch[2];
            const columnName = pgTypeMismatchMatch[3];

            if (columnName) {
              message = `Invalid ${dataType} value '${invalidValue}' for column '${columnName}'`;
            } else {
              message = `Invalid value '${invalidValue}' for type '${dataType}'`;
            }
            _type = DBError.DATA_TYPE_MISMATCH;
            _extra = { dataType, column: columnName, value: invalidValue };
            matched = true;
            break;
          }
        }
        if (!matched) {
          const detailMatch = error.detail
            ? error.detail.match(/Column (\w+)/)
            : null;

          const columnName =
            detailMatch?.[1] ??
            error.message.match(/ set\s+"([^"]+)"/)?.[1] ??
            'unknown';
          message = `Invalid data type or value for column '${columnName}'.`;
          _type = DBError.DATA_TYPE_MISMATCH;
          _extra = { column: columnName };
        }
      }
      break;
    case '42701':
      message = 'The column already exists.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / column "(\w+)" of relation "(\w+)" already exists/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The column '${extractTableNameMatch[1]}' already exists.`;
          _type = DBError.COLUMN_EXIST;
          _extra = {
            column: extractTableNameMatch[1],
          };
        }
      }
      break;
    case '42P01':
      message = 'The table does not exist.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / relation "(\w+)" does not exist/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' does not exist.`;
          _type = DBError.TABLE_NOT_EXIST;
          _extra = {
            table: extractTableNameMatch[1],
          };
        }
      }
      break;
    case '42703':
      message = 'The column does not exist.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / column "(\w+)" does not exist/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The column '${extractTableNameMatch[1]}' does not exist.`;
          _type = DBError.COLUMN_NOT_EXIST;
          _extra = {
            column: extractTableNameMatch[1],
          };
        }
      }
      break;
    // mssql errors
    case 'EREQUEST':
      message = 'There was a syntax error in your SQL query.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / There is already an object named '(\w+)' in the database/i,
        );
        const extractDupColMatch = error.message.match(
          / Column name '(\w+)' in table '(\w+)' is specified more than once/i,
        );
        const extractMissingTableMatch = error.message.match(
          / Invalid object name '(\w+)'./i,
        );
        const extractMissingColMatch = error.message.match(
          / Invalid field: (\w+)./i,
        );

        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' already exists.`;
          _type = DBError.TABLE_EXIST;
          _extra = {
            table: extractTableNameMatch[1],
          };
        } else if (extractDupColMatch && extractDupColMatch[1]) {
          message = `The column '${extractDupColMatch[1]}' already exists.`;
          _type = DBError.COLUMN_EXIST;
          _extra = {
            column: extractDupColMatch[1],
          };
        } else if (extractMissingTableMatch && extractMissingTableMatch[1]) {
          message = `The table '${extractMissingTableMatch[1]}' does not exist`;
          _type = DBError.TABLE_NOT_EXIST;
          _extra = {
            table: extractMissingTableMatch[1],
          };
        } else if (extractMissingColMatch && extractMissingColMatch[1]) {
          message = `The column '${extractMissingColMatch[1]}' does not exist`;
          _type = DBError.COLUMN_NOT_EXIST;
          _extra = {
            column: extractMissingColMatch[1],
          };
        }
      }
      break;
    case 'ELOGIN':
      message = 'You do not have permission to perform this action.';
      httpStatus = 403;
      break;
    case 'ETIMEOUT':
      message = 'A timeout occurred while waiting for a table lock.';
      httpStatus = 500;
      break;
    case 'ECONNRESET':
      message = 'The connection was reset.';
      httpStatus = 500;
      break;
    case 'ECONNREFUSED':
      message = 'The connection was refused.';
      httpStatus = 500;
      break;
    case 'EHOSTUNREACH':
      message = 'The host is unreachable.';
      httpStatus = 500;
      break;
    case 'EHOSTDOWN':
      message = 'The host is down.';
      httpStatus = 500;
      break;
    default:
      // log error for unknown error code
      dbErrorLogger.error(error);

      // if error message contains -- then extract message after --
      if (error.message && error.message.includes('--')) {
        message = error.message.split('--')[1];
      }
      break;
  }

  if (message) {
    return {
      error: NcErrorType.DATABASE_ERROR,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
