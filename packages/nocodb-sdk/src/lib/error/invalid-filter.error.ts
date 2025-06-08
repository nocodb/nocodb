import { ILexingError, IRecognitionException } from 'chevrotain';
import { NcSDKErrorV2 } from '../errorUtils';
import { NcErrorType } from '../globals';
import {
  parseLexingError,
  parseParsingError,
} from '../parser/queryFilter/error-message-parser';
export interface InvalidFilterErrorInfo {
  lexingError?: ILexingError[];
  parsingError?: IRecognitionException[];
  message?: string;
}

export class InvalidFilterError extends NcSDKErrorV2 {
  constructor(info: InvalidFilterErrorInfo) {
    let message = info.message ?? 'Invalid filter';
    if (info.lexingError && info.lexingError.length > 0) {
      const lexingErrorMessage = info.lexingError
        .map((k) => parseLexingError(k))
        .join(', ');
      message = lexingErrorMessage;
    } else if (info.parsingError && info.parsingError.length > 0) {
      const parsingErrorMessage = info.parsingError
        .map((k) => parseParsingError(k))
        .join(', ');
      message = parsingErrorMessage;
    }
    super({
      message,
      error: NcErrorType.INVALID_FILTER,
      getStatus: () => 422,
    });
    this.innerInfo = info;
  }
  innerInfo: InvalidFilterErrorInfo;
}
