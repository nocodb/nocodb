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
    super(param.message, 400, NcErrorType.ERR_INVALID_REQUEST_BODY, {
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
      [NcErrorType.ERR_INVALID_FILTER]: {
        message: (message: string) => `Invalid filter expression: ${message}`,
        code: 422,
      },
      [NcErrorType.ERR_BASE_NOT_FOUND]: {
        message: (id: string) => `Base '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_TABLE_NOT_FOUND]: {
        message: (id: string) => `Table '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_VIEW_NOT_FOUND]: {
        message: (id: string) => `View '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_FIELD_NOT_FOUND]: {
        message: (id: string) => `Field '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_TEAM_NOT_FOUND]: {
        message: (id: string) => `Team '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_USER_NOT_FOUND]: {
        message: (id: string) => `User '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_EXTENSION_NOT_FOUND]: {
        message: (id: string) => `Extension '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_DASHBOARD_NOT_FOUND]: {
        message: (id: string) => `Dashboard '${id}' not found`,
        code: 422,
      },
      [NcErrorType.ERR_WORKFLOW_NOT_FOUND]: {
        message: (id: string) => `Workflow '${id}' not found`,
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

  override invalidRequestBody(message: string): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_REQUEST_BODY, {
      params: message,
    });
  }

  override teamNotFound(id: string, args?: any): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_TEAM_NOT_FOUND, {
      params: id,
      ...args,
    });
  }
}
