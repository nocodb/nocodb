import {
  NcBaseError,
  NcBaseErrorv2,
  NcErrorBase,
  NcErrorType,
} from 'nocodb-sdk';
import type { ZodError } from 'zod';
import type { ErrorObject } from 'ajv';
import type { NcErrorArgs } from 'nocodb-sdk';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';
import { generateReadablePermissionErr } from '~/utils/acl';

export class AjvError extends NcBaseError {
  humanReadableError: boolean;
  constructor(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError?: boolean;
  }) {
    super(param.message);
    this.errors = param.errors;
    this.humanReadableError = param.humanReadableError || false;
  }

  errors: ErrorObject[];
}

export class NcZodError extends NcBaseErrorv2 {
  constructor(param: { message: string; errors: ZodError | ZodError[] }) {
    super(param.message, 400, NcErrorType.INVALID_REQUEST_BODY, {
      details: param.errors,
    });
    this.errors = Array.isArray(param.errors) ? param.errors : [param.errors];
  }

  errors: ZodError[];
}
export class NcErrorV1 extends NcErrorBase {
  constructor() {
    super();
    this.errorCodex.setErrorCodex(NcErrorType.INVALID_LIMIT_VALUE, {
      message: `Limit value should be between ${defaultLimitConfig.limitMin} and ${defaultLimitConfig.limitMax}`,
      code: 422,
    });
  }

  permissionDenied(
    permissionName: string,
    roles: Record<string, boolean>,
    extendedScopeRoles: any,
  ): never {
    throw this.errorCodex.generateError(NcErrorType.PERMISSION_DENIED, {
      customMessage: generateReadablePermissionErr(
        permissionName,
        roles,
        extendedScopeRoles,
      ),
      details: {
        permissionName,
        roles,
        extendedScopeRoles,
      },
    });
  }

  recordNotFound(
    id: string | string[] | Record<string, string> | Record<string, string>[],
    args?: NcErrorArgs,
  ): never {
    let formatedId: string | string[] = '';
    if (!id) {
      formatedId = 'unknown';
    } else if (typeof id === 'string') {
      formatedId = [id];
    } else if (typeof id === 'number') {
      formatedId = [(id as number).toString()];
    } else if (Array.isArray(id)) {
      if (id.every((i) => typeof i === 'string')) {
        formatedId = id as string[];
      } else {
        formatedId = id.map((val) => {
          const idsArr = Object.values(val);
          if (idsArr.length > 1) {
            return idsArr
              .map((idVal) => idVal?.toString?.().replaceAll('_', '\\_'))
              .join('___');
          } else if (idsArr.length) {
            return idsArr[0] as any;
          } else {
            return 'unknown';
          }
        });
      }
    } else {
      const idsArr = Object.values(id);
      if (idsArr.length > 1) {
        formatedId = idsArr
          .map((idVal) => idVal?.toString?.().replaceAll('_', '\\_'))
          .join('___');
      } else if (idsArr.length) {
        formatedId = idsArr[0] as any;
      } else {
        formatedId = 'unknown';
      }
    }

    throw this.errorCodex.generateError(NcErrorType.RECORD_NOT_FOUND, {
      params: formatedId,
      ...args,
    });
  }

  ajvValidationError(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError: boolean;
  }): never {
    throw new AjvError(param);
  }

  zodError(param: { message: string; errors: ZodError | ZodError[] }): never {
    throw new NcZodError(param);
  }

  override invalidRequestBody(message: string): never {
    // backward compatibility for v1 and v2 apis
    return this.badRequest(message);
  }
}
