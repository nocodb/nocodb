import { NcErrorType } from 'nocodb-sdk';
import type { ErrorObject } from 'ajv';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

export enum DBError {
  TABLE_EXIST = 'TABLE_EXIST',
  TABLE_NOT_EXIST = 'TABLE_NOT_EXIST',
  COLUMN_EXIST = 'COLUMN_EXIST',
  COLUMN_NOT_EXIST = 'COLUMN_NOT_EXIST',
  CONSTRAINT_EXIST = 'CONSTRAINT_EXIST',
  CONSTRAINT_NOT_EXIST = 'CONSTRAINT_NOT_EXIST',
  COLUMN_NOT_NULL = 'COLUMN_NOT_NULL',
}

// extract db errors using database error code
export function extractDBError(error): {
  type: DBError;
  message: string;
  info: any;
  extra?: Record<string, any>;
} | void {
  if (!error.code) return;

  let message: string;
  let extra: Record<string, any>;
  let type: DBError;

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
        extra = {
          constraint,
        };
      }
      break;
    case 'SQLITE_CORRUPT':
      message = 'The database file is corrupt.';
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
          type = DBError.TABLE_NOT_EXIST;
          extra = {
            table: noSuchTableMatch[1],
          };
        } else if (tableAlreadyExistsMatch && tableAlreadyExistsMatch[1]) {
          message = `The table '${tableAlreadyExistsMatch[1]}' already exists.`;
          type = DBError.TABLE_EXIST;
          extra = {
            table: tableAlreadyExistsMatch[1],
          };
        } else if (unrecognizedTokenMatch && unrecognizedTokenMatch[1]) {
          message = `Unrecognized token: ${unrecognizedTokenMatch[1]}`;
          extra = {
            token: unrecognizedTokenMatch[1],
          };
        } else if (columnDoesNotExistMatch && columnDoesNotExistMatch[1]) {
          message = `The column ${columnDoesNotExistMatch[1]} does not exist.`;
          type = DBError.COLUMN_NOT_EXIST;
          extra = {
            column: columnDoesNotExistMatch[1],
          };
        } else if (constraintFailedMatch && constraintFailedMatch[1]) {
          message = `A constraint failed: ${constraintFailedMatch[1]}`;
        } else if (
          duplicateColumnExistsMatch &&
          duplicateColumnExistsMatch[1]
        ) {
          message = `The column '${duplicateColumnExistsMatch[1]}' already exists.`;
          type = DBError.COLUMN_EXIST;
          extra = {
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
    case 'ER_TABLE_EXISTS_ERROR':
      message = 'The table already exists.';

      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / Table '?(\w+)'? already exists/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' already exists.`;
          type = DBError.TABLE_EXIST;
          extra = {
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
          type = DBError.COLUMN_EXIST;
          extra = {
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
          type = DBError.TABLE_NOT_EXIST;
          extra = {
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
          type = DBError.COLUMN_NOT_NULL;
          extra = {
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
          type = DBError.COLUMN_NOT_EXIST;
          extra = {
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
    case '42P07':
      message = 'The table already exists.';
      if (error.message) {
        const extractTableNameMatch = error.message.match(
          / relation "?(\w+)"? already exists/i,
        );
        if (extractTableNameMatch && extractTableNameMatch[1]) {
          message = `The table '${extractTableNameMatch[1]}' already exists.`;
          type = DBError.TABLE_EXIST;
          extra = {
            table: extractTableNameMatch[1],
          };
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
          type = DBError.COLUMN_EXIST;
          extra = {
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
          type = DBError.TABLE_NOT_EXIST;
          extra = {
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
          type = DBError.COLUMN_NOT_EXIST;
          extra = {
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
          type = DBError.TABLE_EXIST;
          extra = {
            table: extractTableNameMatch[1],
          };
        } else if (extractDupColMatch && extractDupColMatch[1]) {
          message = `The column '${extractDupColMatch[1]}' already exists.`;
          type = DBError.COLUMN_EXIST;
          extra = {
            column: extractDupColMatch[1],
          };
        } else if (extractMissingTableMatch && extractMissingTableMatch[1]) {
          message = `The table '${extractMissingTableMatch[1]}' does not exist`;
          type = DBError.TABLE_NOT_EXIST;
          extra = {
            table: extractMissingTableMatch[1],
          };
        } else if (extractMissingColMatch && extractMissingColMatch[1]) {
          message = `The column '${extractMissingColMatch[1]}' does not exist`;
          type = DBError.COLUMN_NOT_EXIST;
          extra = {
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
      // if error message contains -- then extract message after --
      if (error.message && error.message.includes('--')) {
        message = error.message.split('--')[1];
      }
      break;
  }

  if (message) {
    return {
      message,
      type,
      extra,
      info: { message: error.message, code: error.code },
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

export class UnprocessableEntity extends NcBaseError {}

export class AjvError extends NcBaseError {
  constructor(param: { message: string; errors: ErrorObject[] }) {
    super(param.message);
    this.errors = param.errors;
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
  [NcErrorType.RECORD_NOT_FOUND]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(', ')}' not found`;
    },
    code: 404,
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
  [NcErrorType.NOT_IMPLEMENTED]: {
    message: (feature: string) => `${feature} is not implemented`,
    code: 501,
  },
  [NcErrorType.BAD_JSON]: {
    message: 'Invalid JSON in request body',
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

  static recordNotFound(id: string | string[], args?: NcErrorArgs) {
    throw new NcBaseErrorv2(NcErrorType.RECORD_NOT_FOUND, {
      params: id,
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

  static ajvValidationError(param: { message: string; errors: ErrorObject[] }) {
    throw new AjvError(param);
  }

  static unprocessableEntity(message = 'Unprocessable entity') {
    throw new UnprocessableEntity(message);
  }

  static notAllowed(message = 'Not allowed') {
    throw new NotAllowed(message);
  }
}
