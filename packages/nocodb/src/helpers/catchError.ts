import { DBErrorExtractor } from './db-error/extractor';
import type { NcContext } from 'nocodb-sdk';
import type { ClientType } from 'nocodb-sdk';
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
