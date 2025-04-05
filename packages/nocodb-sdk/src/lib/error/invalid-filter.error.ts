import { ILexingError, IRecognitionException } from 'chevrotain';
import { NcSDKErrorV2 } from '../errorUtils';
import { NcErrorType } from '../globals';
export interface InvalidFilterErrorInfo {
  lexingError?: ILexingError[];
  parsingError?: IRecognitionException[];
  message?: string;
}
export class InvalidFilterError extends NcSDKErrorV2 {
  constructor(info: InvalidFilterErrorInfo) {
    let message = info.message ?? 'INVALID_FILTER';
    if (info.lexingError && info.lexingError.length > 0) {
      const lexingErrorMessage = info.lexingError
        .map((k) => k.message)
        .join(', ');
      message = `${message} lexing_error: ${lexingErrorMessage}`;
    } else if (info.parsingError && info.parsingError.length > 0) {
      const parsingErrorMessage = info.parsingError
        .map((k) => k.message)
        .join(', ');
      message = `${message} parsing_error: ${parsingErrorMessage}`;
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
