import { DBErrorExtractor } from './db-error/extractor';
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
export function extractDBError(error): {
  message: string;
  error: string;
  details?: any;
  code?: string;
  httpStatus: number;
} | void {
  return DBErrorExtractor.get().extractDbError(error);
}
