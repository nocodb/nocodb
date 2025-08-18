import { NcErrorType } from 'nocodb-sdk';
import { DBError } from './utils';
import type { Logger } from '@nestjs/common';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';

export class PgDBErrorExtractor implements IClientDbErrorExtractor {
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
        message = 'The date / time value is invalid.';
        break;
      case '22011':
        message = 'Negative substring length not allowed.';
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

          const extractColumnNameMatch = error.message.match(
            / column "(\w+)" does not exist/i,
          );

          if (extractColumnNameMatch && extractColumnNameMatch[1]) {
            message = `The column '${extractColumnNameMatch[1]}' does not exist.`;
            _type = DBError.COLUMN_NOT_EXIST;
            _extra = {
              table: extractColumnNameMatch[1],
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
