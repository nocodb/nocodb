import { DBErrorExtractor } from './db-error/extractor';
import type { NcContext } from 'nocodb-sdk';
import type { ClientType, NcErrorType } from 'nocodb-sdk';
import { NcError } from '~/helpers/ncError';
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

// extract db errors using database error code
export function extractDBError(
  error,
  context?: NcContext & {
    clientType?: ClientType;
  },
): {
  message: string;
  error: string;
  details?: any;
  code?: string;
  httpStatus: number;
} | void {
  return DBErrorExtractor.get().extractDbError(error, context);
}

/**
 * Handle database errors in catch blocks
 * Extracts DB error if possible, otherwise throws internal server error
 */
export function handleDatabaseError(
  error: any,
  context?: NcContext & {
    clientType?: ClientType;
  },
): never {
  // Try to extract DB error with client type hint
  const dbError = extractDBError(error, context);

  if (dbError) {
    // Use api_version aware NcError
    const ncError = context?.api_version
      ? NcError.get({ api_version: context.api_version })
      : NcError._;

    throw ncError.errorCodex.generateError(dbError.error as NcErrorType, {
      params: dbError.message,
      details: {
        code: dbError.code,
        ...(dbError.details || {}),
      },
    });
  }

  // Use api_version aware NcError for internal server error too
  const ncError = context?.api_version
    ? NcError.get({ api_version: context.api_version })
    : NcError._;

  throw ncError.internalServerError(
    process.env.NODE_ENV === 'production'
      ? 'Database operation failed'
      : error?.message || 'Database operation failed',
  );
}
