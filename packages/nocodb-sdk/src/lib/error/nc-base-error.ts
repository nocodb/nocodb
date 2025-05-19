import { NcErrorType } from '~/lib/globals';

export class NcBaseError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export type NcErrorArgs = {
  params?: string | string[];
  customMessage?: string | ((...args: string[]) => string);
  details?: any;
};

export class NcBaseErrorv2 extends NcBaseError {
  error: NcErrorType;
  code: number;
  details?: any;

  constructor(
    message: string,
    code: number,
    error: NcErrorType,
    args?: NcErrorArgs
  ) {
    super(message);
    this.error = error;
    this.code = code;
    this.details = args?.details;
  }
}
