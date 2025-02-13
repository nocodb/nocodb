import { NcErrorType } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { generateReadablePermissionErr } from 'src/utils/acl';
import type { BaseType, SourceType } from 'nocodb-sdk';
import type { ErrorObject } from 'ajv';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

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
} | void {
  if (!error.code) return;

  let message: string;
  let _extra: Record<string, any>;
  let _type: DBError;

  // todo: handle not null constraint error for all databases
  switch (error.code) {
    // sqlite errors
    case 'SQLITE_BUSY':
      message = 'The database is locked by another process or transaction.';
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
      break;
    case 'ER_LOCK_WAIT_TIMEOUT':
      message = 'A timeout occurred while waiting for a table lock.';
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
      message = 'The referenced record does not exist.';
      break;
    case '23514':
      message = 'A null value is not allowed for this field.';
      break;
    case '22001':
      message = 'The data entered is too long for this field.';
      break;
    case '28000':
      message = 'You do not have permission to perform this action.';
      break;
    case '40P01':
      message = 'A timeout occurred while waiting for a table lock.';
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
        const pgTypeMismatchMatch = error.message.match(
          /invalid input syntax for (\w+): "(.+)"(?: in column "(\w+)")?/i,
        );
        if (pgTypeMismatchMatch) {
          const dataType = pgTypeMismatchMatch[1];
          const invalidValue = pgTypeMismatchMatch[2];
          const columnName = pgTypeMismatchMatch[3] || 'unknown';

          message = `Invalid ${dataType} value '${invalidValue}' for column '${columnName}'`;
          _type = DBError.DATA_TYPE_MISMATCH;
          _extra = { dataType, column: columnName, value: invalidValue };
        } else {
          const detailMatch = error.detail
            ? error.detail.match(/Column (\w+)/)
            : null;
          const columnName = detailMatch ? detailMatch[1] : 'unknown';
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
      break;
    case 'ETIMEOUT':
      message = 'A timeout occurred while waiting for a table lock.';
      break;
    case 'ECONNRESET':
      message = 'The connection was reset.';
      break;
    case 'ECONNREFUSED':
      message = 'The connection was refused.';
      break;
    case 'EHOSTUNREACH':
      message = 'The host is unreachable.';
      break;
    case 'EHOSTDOWN':
      message = 'The host is down.';
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
    };
  }
}

export class NcBaseError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class BadRequest extends NcBaseError {}

export class NotAllowed extends NcBaseError {}

export class Unauthorized extends NcBaseError {}

export class Forbidden extends NcBaseError {}

export class NotFound extends NcBaseError {}

export class SsoError extends NcBaseError {}

export class MetaError extends NcBaseError {
  constructor(param: { message: string; sql: string }) {
    super(param.message);
    Object.assign(this, param);
  }
}

export class ExternalError extends NcBaseError {
  constructor(error: Error) {
    super(error.message);
    Object.assign(this, error);
  }
}

export class ExternalTimeout extends ExternalError {}

export class UnprocessableEntity extends NcBaseError {}

export class OptionsNotExistsError extends BadRequest {
  constructor({
    columnTitle,
    options,
    validOptions,
  }: {
    columnTitle: string;
    options: string[];
    validOptions: string[];
  }) {
    super(
      `Invalid option(s) "${options.join(
        ', ',
      )}" provided for column "${columnTitle}". Valid options are "${validOptions.join(
        ', ',
      )}"`,
    );
    this.columnTitle = columnTitle;
    this.options = options;
    this.validOptions = validOptions;
  }
  columnTitle: string;
  options: string[];
  validOptions: string[];
}

export class TestConnectionError extends NcBaseError {
  public sql_code?: string;

  constructor(message: string, sql_code?: string) {
    super(message);
    this.sql_code = sql_code;
  }
}

export class AjvError extends NcBaseError {
  humanReadableError: boolean;
  constructor(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError?: boolean;
  }) {
    super(param.message);
    this.errors = param.errors;
    this.humanReadableError = param.humanReadableError || false;
  }

  errors: ErrorObject[];
}

const errorHelpers: {
  [key in NcErrorType]: {
    message: string | ((...params: string[]) => string);
    code: number;
  };
} = {
  [NcErrorType.UNKNOWN_ERROR]: {
    message: 'Something went wrong',
    code: 500,
  },
  [NcErrorType.INTERNAL_SERVER_ERROR]: {
    message: (message: string) => message || `Internal server error`,
    code: 500,
  },
  [NcErrorType.DATABASE_ERROR]: {
    message: (message: string) =>
      message || `There was an error while running the query`,
    code: 500,
  },
  [NcErrorType.AUTHENTICATION_REQUIRED]: {
    message: 'Authentication required to access this resource',
    code: 401,
  },
  [NcErrorType.API_TOKEN_NOT_ALLOWED]: {
    message: 'This request is not allowed with API token',
    code: 401,
  },
  [NcErrorType.WORKSPACE_NOT_FOUND]: {
    message: (id: string) => `Workspace '${id}' not found`,
    code: 404,
  },
  [NcErrorType.BASE_NOT_FOUND]: {
    message: (id: string) => `Base '${id}' not found`,
    code: 404,
  },
  [NcErrorType.SOURCE_NOT_FOUND]: {
    message: (id: string) => `Source '${id}' not found`,
    code: 404,
  },
  [NcErrorType.INTEGRATION_NOT_FOUND]: {
    message: (id: string) => `Connection '${id}' not found`,
    code: 404,
  },
  [NcErrorType.INTEGRATION_LINKED_WITH_BASES]: {
    message: (bases) => `Connection linked with following bases '${bases}'`,
    code: 404,
  },
  [NcErrorType.TABLE_NOT_FOUND]: {
    message: (id: string) => `Table '${id}' not found`,
    code: 404,
  },
  [NcErrorType.VIEW_NOT_FOUND]: {
    message: (id: string) => `View '${id}' not found`,
    code: 404,
  },
  [NcErrorType.FIELD_NOT_FOUND]: {
    message: (id: string) => `Field '${id}' not found`,
    code: 404,
  },
  [NcErrorType.HOOK_NOT_FOUND]: {
    message: (id: string) => `Hook '${id}' not found`,
    code: 404,
  },
  [NcErrorType.RECORD_NOT_FOUND]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(', ')}' not found`;
    },
    code: 404,
  },
  [NcErrorType.GENERIC_NOT_FOUND]: {
    message: (resource: string, id: string) => `${resource} '${id}' not found`,
    code: 404,
  },
  [NcErrorType.REQUIRED_FIELD_MISSING]: {
    message: (field: string) => `Field '${field}' is required`,
    code: 422,
  },
  [NcErrorType.ERROR_DUPLICATE_RECORD]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(
        ', ',
      )}' already exists`;
    },
    code: 422,
  },
  [NcErrorType.USER_NOT_FOUND]: {
    message: (idOrEmail: string) => {
      const isEmail = idOrEmail.includes('@');
      return `User ${
        isEmail ? 'with email' : 'with id'
      } '${idOrEmail}' not found`;
    },
    code: 404,
  },
  [NcErrorType.INVALID_OFFSET_VALUE]: {
    message: (offset: string) => `Offset value '${offset}' is invalid`,
    code: 422,
  },
  [NcErrorType.INVALID_PAGE_VALUE]: {
    message: (page: string) => `Page value '${page}' is invalid`,
    code: 422,
  },
  [NcErrorType.INVALID_PK_VALUE]: {
    message: (value: any, pkColumn: string) =>
      `Primary key value '${value}' is invalid for column '${pkColumn}'`,
    code: 422,
  },
  [NcErrorType.INVALID_LIMIT_VALUE]: {
    message: `Limit value should be between ${defaultLimitConfig.limitMin} and ${defaultLimitConfig.limitMax}`,
    code: 422,
  },
  [NcErrorType.INVALID_FILTER]: {
    message: (filter: string) => `Filter '${filter}' is invalid`,
    code: 422,
  },
  [NcErrorType.INVALID_SHARED_VIEW_PASSWORD]: {
    message: 'Invalid shared view password',
    code: 403,
  },
  [NcErrorType.INVALID_ATTACHMENT_JSON]: {
    message: (payload: string) =>
      `Invalid JSON for attachment field: ${payload}`,
    code: 400,
  },
  [NcErrorType.NOT_IMPLEMENTED]: {
    message: (feature: string) => `${feature} is not implemented`,
    code: 501,
  },
  [NcErrorType.BAD_JSON]: {
    message: 'Invalid JSON in request body',
    code: 400,
  },
  [NcErrorType.COLUMN_ASSOCIATED_WITH_LINK]: {
    message: 'Column is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.TABLE_ASSOCIATED_WITH_LINK]: {
    message: 'Table is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.FORMULA_ERROR]: {
    message: (message: string) => {
      // try to extract db error - Experimental
      if (message.includes(' - ')) {
        const [_, dbError] = message.split(' - ');
        return `Formula error: ${dbError}`;
      }
      return `Formula error: ${message}`;
    },
    code: 400,
  },
  [NcErrorType.PERMISSION_DENIED]: {
    message: 'Permission denied',
    code: 403,
  },
  [NcErrorType.INVALID_ATTACHMENT_UPLOAD_SCOPE]: {
    message: 'Invalid attachment upload scope',
    code: 400,
  },
  [NcErrorType.REORDER_FAILED]: {
    message: 'Reorder failed',
    code: 400,
  },
  [NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER]: {
    message: 'Cannot calculate intermediate order',
    code: 400,
  },
};

function generateError(
  type: NcErrorType,
  args?: NcErrorArgs,
): {
  message: string;
  code: number;
  details?: any;
} {
  const errorHelper = errorHelpers[type];
  const { params, customMessage, details } = args || {};

  if (!errorHelper) {
    return {
      message: 'An error occurred',
      code: 500,
      details: details,
    };
  }

  let message: string;
  const messageHelper = customMessage || errorHelper.message;

  if (typeof messageHelper === 'function') {
    message = messageHelper(...(Array.isArray(params) ? params : [params]));
  } else {
    message = messageHelper;
  }

  return {
    message,
    code: errorHelper.code,
    details: details,
  };
}

type NcErrorArgs = {
  params?: string | string[];
  customMessage?: string | ((...args: string[]) => string);
  details?: any;
};

export class NcBaseErrorv2 extends NcBaseError {
  error: NcErrorType;
  code: number;
  details?: any;

  constructor(error: NcErrorType, args?: NcErrorArgs) {
    const errorHelper = generateError(error, args);
    super(errorHelper.message);
    this.error = error;
    this.code = errorHelper.code;
    this.details = args?.details;
  }
}

export class NcError {
  static permissionDenied(
    permissionName: string,
    roles: Record<string, boolean>,
    extendedScopeRoles: any,
  ) {
    throw new NcBaseErrorv2(NcErrorType.PERMISSION_DENIED, {
      customMessage: generateReadablePermissionErr(
        permissionName,
        roles,
        extendedScopeRoles,
      ),
      details: {
        permissionName,
        roles,
        extendedScopeRoles,
      },
    });
  }

  static authenticationRequired(args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.AUTHENTICATION_REQUIRED, args);
  }

  static apiTokenNotAllowed(args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.API_TOKEN_NOT_ALLOWED, args);
  }

  static workspaceNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.WORKSPACE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static columnAssociatedWithLink(_id: string, args: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.COLUMN_ASSOCIATED_WITH_LINK, args);
  }

  static tableAssociatedWithLink(_id: string, args: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.TABLE_ASSOCIATED_WITH_LINK, args);
  }

  static baseNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.BASE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static sourceNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.SOURCE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static tableNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.TABLE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static userNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.USER_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static viewNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.VIEW_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static hookNotFound(id: string, args?: NcErrorArgs): never {
    throw new NcBaseErrorv2(NcErrorType.HOOK_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static recordNotFound(
    id: string | string[] | Record<string, string> | Record<string, string>[],
    args?: NcErrorArgs,
  ) {
    let formatedId: string | string[] = '';
    if (!id) {
      formatedId = 'unknown';
    } else if (typeof id === 'string') {
      formatedId = [id];
    } else if (Array.isArray(id)) {
      if (id.every((i) => typeof i === 'string')) {
        formatedId = id as string[];
      } else {
        formatedId = id.map((val) => {
          const idsArr = Object.values(val);
          if (idsArr.length > 1) {
            return idsArr
              .map((idVal) => idVal?.toString?.().replaceAll('_', '\\_'))
              .join('___');
          } else if (idsArr.length) {
            return idsArr[0] as any;
          } else {
            return 'unknown';
          }
        });
      }
    } else {
      const idsArr = Object.values(id);
      if (idsArr.length > 1) {
        formatedId = idsArr
          .map((idVal) => idVal?.toString?.().replaceAll('_', '\\_'))
          .join('___');
      } else if (idsArr.length) {
        formatedId = idsArr[0] as any;
      } else {
        formatedId = 'unknown';
      }
    }

    throw new NcBaseErrorv2(NcErrorType.RECORD_NOT_FOUND, {
      params: formatedId,
      ...args,
    });
  }

  static genericNotFound(resource: string, id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.GENERIC_NOT_FOUND, {
      params: [resource, id],
      ...args,
    });
  }

  static requiredFieldMissing(field: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.REQUIRED_FIELD_MISSING, {
      params: field,
      ...args,
    });
  }

  static duplicateRecord(id: string | string[], args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.ERROR_DUPLICATE_RECORD, {
      params: id,
      ...args,
    });
  }

  static fieldNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.FIELD_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  static invalidOffsetValue(offset: string | number, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_OFFSET_VALUE, {
      params: `${offset}`,
      ...args,
    });
  }
  static invalidPageValue(page: string | number, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_PAGE_VALUE, {
      params: `${page}`,
      ...args,
    });
  }

  static invalidPrimaryKey(value: any, pkColumn: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_PK_VALUE, {
      params: [value, pkColumn],
      ...args,
    });
  }

  static invalidLimitValue(args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_LIMIT_VALUE, {
      ...args,
    });
  }

  static invalidFilter(filter: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_FILTER, {
      params: filter,
      ...args,
    });
  }

  static invalidSharedViewPassword(args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_SHARED_VIEW_PASSWORD, {
      ...args,
    });
  }

  static invalidAttachmentJson(payload: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_ATTACHMENT_JSON, {
      params: payload,
      ...args,
    });
  }

  static notImplemented(feature: string = 'Feature', args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.NOT_IMPLEMENTED, {
      params: feature,
      ...args,
    });
  }

  static internalServerError(message: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INTERNAL_SERVER_ERROR, {
      params: message,
      ...args,
    });
  }

  static formulaError(message: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.FORMULA_ERROR, {
      params: message,
      ...args,
    });
  }

  static notFound(message = 'Not found') {
    throw new NotFound(message);
  }

  static badRequest(message) {
    throw new BadRequest(message);
  }

  static unauthorized(message) {
    throw new Unauthorized(message);
  }

  static forbidden(message) {
    throw new Forbidden(message);
  }

  static ajvValidationError(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError: boolean;
  }) {
    throw new AjvError(param);
  }

  static unprocessableEntity(message = 'Unprocessable entity') {
    throw new UnprocessableEntity(message);
  }

  static testConnectionError(message = 'Unprocessable entity', code?: string) {
    throw new TestConnectionError(message, code);
  }

  static notAllowed(message = 'Not allowed') {
    throw new NotAllowed(message);
  }

  static emailDomainNotAllowed(domain: string) {
    throw new SsoError(
      `Email domain ${domain} is not allowed for this organization`,
    );
  }

  static metaError(param: { message: string; sql: string }) {
    throw new MetaError(param);
  }

  static sourceDataReadOnly(name: string) {
    NcError.forbidden(`Source '${name}' is read-only`);
  }

  static sourceMetaReadOnly(name: string) {
    NcError.forbidden(`Source '${name}' schema is read-only`);
  }

  static integrationNotFound(id: string, args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INTEGRATION_NOT_FOUND, {
      params: id,
      ...(args || {}),
    });
  }

  static cannotCalculateIntermediateOrderError() {
    throw new NcBaseErrorv2(
      NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER,
      {},
    );
  }

  static reorderFailed() {
    throw new NcBaseErrorv2(NcErrorType.REORDER_FAILED, {});
  }

  static integrationLinkedWithMultiple(
    bases: BaseType[],
    sources: SourceType[],
    args?: NcErrorArgs,
  ) {
    throw new NcBaseErrorv2(NcErrorType.INTEGRATION_LINKED_WITH_BASES, {
      params: bases.map((s) => s.title).join(', '),
      details: {
        bases: bases.map((b) => {
          return {
            id: b.id,
            title: b.title,
          };
        }),
        sources: sources.map((s) => {
          return {
            id: s.id,
            base_id: s.base_id,
            title: s.alias,
          };
        }),
      },
      ...(args || {}),
    });
  }

  static invalidAttachmentUploadScope(args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.INVALID_ATTACHMENT_UPLOAD_SCOPE, args);
  }

  static optionsNotExists(props: {
    columnTitle: string;
    options: string[];
    validOptions: string[];
  }) {
    throw new OptionsNotExistsError(props);
  }
}
