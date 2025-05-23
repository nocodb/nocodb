import { NcBaseErrorv2, NcErrorArgs } from '~/lib/error/nc-base.error';
import { NcErrorType } from '~/lib/globals';
import { presetErrorCodexMap } from '~/lib/error-handler/preset-error-codex-map';

export class NcErrorCodexManager {
  constructor() {
    this.setErrorCodexes(presetErrorCodexMap);
  }

  errorCodexMap: Partial<
    Record<
      NcErrorType,
      {
        message: string | ((...params: string[]) => string);
        code: number;
        error_code?: NcErrorType;
      }
    >
  > = {};

  setErrorCodex(
    errorType: NcErrorType,
    handler: {
      message: string | ((...params: string[]) => string);
      code: number;
      error_code?: NcErrorType;
    }
  ) {
    this.errorCodexMap[errorType] = handler;
  }

  setErrorCodexes(
    handlers: Partial<
      Record<
        NcErrorType,
        {
          message: string | ((...params: string[]) => string);
          code: number;
          error_code?: NcErrorType;
        }
      >
    >
  ) {
    this.errorCodexMap = { ...this.errorCodexMap, ...handlers };
  }

  generateError(error: NcErrorType, args?: NcErrorArgs) {
    const errorHelper = this.errorCodexMap[error];
    const { params, customMessage, details } = args || {};

    if (!errorHelper) {
      return {
        message: 'An error occurred',
        code: 500,
        details: details,
      };
    }

    let message: string;
    const messageHelper = customMessage || errorHelper.message;

    if (typeof messageHelper === 'function') {
      message = messageHelper(...(Array.isArray(params) ? params : [params]));
    } else {
      message = messageHelper;
    }

    return new NcBaseErrorv2(message, errorHelper.code, error);
  }
}
