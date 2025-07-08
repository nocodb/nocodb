import { NcBaseErrorv2, NcErrorType } from 'nocodb-sdk';
import { NcErrorV1 } from './NcErrorV1';
import type { ErrorObject } from 'ajv';

export class AjvErrorV3 extends NcBaseErrorv2 {
  humanReadableError: boolean;
  constructor(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError?: boolean;
  }) {
    super(param.message, 400, NcErrorType.INVALID_REQUEST_BODY, {
      details: param.errors,
    });
    this.errors = param.errors;
    this.humanReadableError = param.humanReadableError || false;
  }

  errors: ErrorObject[];
}

export class NcErrorV3 extends NcErrorV1 {
  constructor() {
    super();
    this.errorCodex.setErrorCodexes({
      [NcErrorType.INVALID_FILTER]: {
        message: (message: string) => `Invalid filter expression: ${message}`,
        code: 422,
      },
      [NcErrorType.BASE_NOT_FOUND]: {
        message: (id: string) => `Base '${id}' not found`,
        code: 422,
      },
      [NcErrorType.TABLE_NOT_FOUND]: {
        message: (id: string) => `Table '${id}' not found`,
        code: 422,
      },
      [NcErrorType.VIEW_NOT_FOUND]: {
        message: (id: string) => `View '${id}' not found`,
        code: 422,
      },
      [NcErrorType.FIELD_NOT_FOUND]: {
        message: (id: string) => `Field '${id}' not found`,
        code: 422,
      },
    });
  }

  override ajvValidationError(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError: boolean;
  }): never {
    throw new AjvErrorV3(param);
  }
}
