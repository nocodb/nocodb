import { NcErrorType } from 'nocodb-sdk';
import { DBError } from './utils';
import type { Logger } from '@nestjs/common';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';

export class MysqlDBErrorExtractor implements IClientDbErrorExtractor {
  constructor(
    private readonly option?: {
      dbErrorLogger?: Logger;
    },
  ) {}

  extract(error: any): DBErrorExtractResult {
    if (!error.code) return;

    let message: string;
    let _extra: Record<string, any>;
    let _type: DBError;
    let httpStatus = 422;

    // todo: handle not null constraint error for all databases
    switch (error.code) {
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

      default:
        return;
    }

    return {
      error: NcErrorType.DATABASE_ERROR,
      message,
      code: error.code,
      httpStatus,
    };
  }
}
