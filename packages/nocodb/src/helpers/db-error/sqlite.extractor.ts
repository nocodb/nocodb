import { NcErrorType } from 'nocodb-sdk';
import { DBError } from './utils';
import {
  constraintViolationMessage,
  driverMessage,
  parseConstraintViolation,
} from './constraint';
import type { Logger } from '@nestjs/common';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';
import { internalDbHostBlockedMessage } from '~/utils/ssrf';

export class SqliteDBErrorExtractor implements IClientDbErrorExtractor {
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
      // sqlite errors
      case 'SQLITE_BUSY':
        message = 'The database is locked by another process or transaction.';
        httpStatus = 500;
        break;
      case 'SQLITE_CONSTRAINT': {
        // never echo error.message: knex prefixes it with the SQL
        const reason = driverMessage(error);
        // a composite key lists several columns: name none
        const column = reason.match(
          /^(?:UNIQUE|NOT NULL) constraint failed: (?:[^\s.]+\.)?([^\s,]+)\s*$/,
        )?.[1];
        const violation = parseConstraintViolation(error);
        if (violation) {
          message = constraintViolationMessage(violation);
          if (violation.constraint)
            _extra = { constraint: violation.constraint };
        } else if (/^UNIQUE constraint failed/.test(reason)) {
          _type = DBError.UNIQUE_CONSTRAINT_VIOLATION;
          message = column
            ? `${column} field unique constraint violation.`
            : 'This record already exists.';
          if (column) _extra = { column };
        } else if (/^NOT NULL constraint failed/.test(reason)) {
          _type = DBError.COLUMN_NOT_NULL;
          message = 'A value is required for this field.';
          if (column) _extra = { column };
        } else {
          message = 'A database constraint was violated.';
        }
        break;
      }
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

      case 'EACCES':
        message = internalDbHostBlockedMessage();
        httpStatus = 403;
        break;

      default:
        this.option.dbErrorLogger.error(
          `${error.code} is not handled on database sqlite`,
        );
        message = `An error occurred when querying sqlite database.`;
        httpStatus = 500;
        return;
    }

    return {
      error: NcErrorType.ERR_DATABASE_OP_FAILED,
      message,
      code: error.code,
      httpStatus,
      ...(_extra && { details: _extra }),
    };
  }
}
