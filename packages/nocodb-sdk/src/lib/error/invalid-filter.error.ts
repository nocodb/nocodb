import { ILexingError, IRecognitionException } from "chevrotain";
import { NcSDKError } from "../errorUtils";
export interface InvalidFilterErrorInfo {
  lexingError?: ILexingError[];
  parsingError?: IRecognitionException[],
  message?: string;
};
export class InvalidFilterError extends NcSDKError {
  constructor(public readonly info: InvalidFilterErrorInfo) {
    let message = info.message ?? 'INVALID_FILTER';
    if(info.lexingError) {
      const lexingErrorMessage = info.lexingError.map(k => k.message).join(', ');
      message = `${message} lexing_error: ${lexingErrorMessage}`;
    } else if(info.parsingError) {
      const parsingErrorMessage = info.parsingError.map(k => k.message);
      message = `${message} parsing_error: ${parsingErrorMessage}`;
    }
    super(message)
  }
}