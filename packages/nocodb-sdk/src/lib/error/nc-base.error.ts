import { NcErrorType } from '~/lib/globals';

export class NcBaseError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class BadRequestV2 extends NcBaseError {}

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

export class OptionsNotExistsError extends BadRequestV2 {
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
        ', '
      )}" provided for column "${columnTitle}". Valid options are "${validOptions.join(
        ', '
      )}"`
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
