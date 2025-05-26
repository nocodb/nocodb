import { NcBaseError, NcErrorBase, NcErrorType } from 'nocodb-sdk';
import type { ErrorObject } from 'ajv';
import type {
  BaseType,
  NcErrorArgs,
  PlanLimitExceededDetailsType,
  SourceType,
  UITypes,
} from 'nocodb-sdk';
import { generateReadablePermissionErr } from '~/utils/acl';
import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

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

export class NcError extends NcErrorBase {
  static _instance: NcError;
  static get _() {
    if (!this._instance) {
      this._instance = new NcError();
    }
    return this._instance;
  }
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

  // backward compatibility
  /* region statics */
  static authenticationRequired(args?: NcErrorArgs): never {
    return NcError._.authenticationRequired(args);
  }

  static apiTokenNotAllowed(args?: NcErrorArgs): never {
    return NcError._.apiTokenNotAllowed(args);
  }

  static workspaceNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.workspaceNotFound(id, args);
  }

  static columnAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    return NcError._.columnAssociatedWithLink(_id, args);
  }

  static tableAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    return NcError._.tableAssociatedWithLink(_id, args);
  }

  static baseNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.baseNotFound(id, args);
  }
  static baseNotFoundV3(id: string, args?: NcErrorArgs): never {
    return NcError._.baseNotFoundV3(id, args);
  }

  static sourceNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.sourceNotFound(id, args);
  }

  static tableNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.tableNotFound(id, args);
  }

  static tableNotFoundV3(id: string, args?: NcErrorArgs): never {
    return NcError._.tableNotFoundV3(id, args);
  }

  static userNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.userNotFound(id, args);
  }

  static viewNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.viewNotFound(id, args);
  }

  static viewNotFoundV3(id: string, args?: NcErrorArgs): never {
    return NcError._.viewNotFoundV3(id, args);
  }

  static hookNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.hookNotFound(id, args);
  }

  static genericNotFound(
    resource: string,
    id: string,
    args?: NcErrorArgs,
  ): never {
    return NcError._.genericNotFound(resource, id, args);
  }

  static requiredFieldMissing(field: string, args?: NcErrorArgs): never {
    return NcError._.requiredFieldMissing(field, args);
  }

  static duplicateRecord(id: string | string[], args?: NcErrorArgs): never {
    return NcError._.duplicateRecord(id, args);
  }

  static fieldNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.fieldNotFound(id, args);
  }

  static fieldNotFoundV3(id: string, args?: NcErrorArgs): never {
    return NcError._.fieldNotFoundV3(id, args);
  }

  static invalidOffsetValue(
    offset: string | number,
    args?: NcErrorArgs,
  ): never {
    return NcError._.invalidOffsetValue(offset, args);
  }
  static invalidPageValue(page: string | number, args?: NcErrorArgs): never {
    return NcError._.invalidPageValue(page, args);
  }

  static invalidPrimaryKey(
    value: any,
    pkColumn: string,
    args?: NcErrorArgs,
  ): never {
    return NcError._.invalidPrimaryKey(value, pkColumn, args);
  }

  static invalidLimitValue(args?: NcErrorArgs): never {
    return NcError._.invalidLimitValue(args);
  }

  static invalidFilter(filter: string, args?: NcErrorArgs): never {
    return NcError._.invalidFilter(filter, args);
  }

  static invalidFilterV3(message: string, args?: NcErrorArgs): never {
    return NcError._.invalidFilterV3(message, args);
  }

  static invalidValueForField(
    payload:
      | string
      | { value: string; column: string; type: UITypes; reason?: string },
    args?: NcErrorArgs,
  ): never {
    return NcError._.invalidValueForField(payload, args);
  }

  static invalidSharedViewPassword(args?: NcErrorArgs): never {
    return NcError._.invalidSharedViewPassword(args);
  }

  static invalidAttachmentJson(payload: string, args?: NcErrorArgs): never {
    return NcError._.invalidAttachmentJson(payload, args);
  }

  static notImplemented(
    feature: string = 'Feature',
    args?: NcErrorArgs,
  ): never {
    return NcError._.notImplemented(feature, args);
  }

  static internalServerError(message: string, args?: NcErrorArgs): never {
    return NcError._.internalServerError(message, args);
  }

  static formulaError(message: string, args?: NcErrorArgs): never {
    return NcError._.formulaError(message, args);
  }

  static formulaCircularRefError(message: string, args?: NcErrorArgs): never {
    return NcError._.formulaCircularRefError(message, args);
  }

  static unauthorized(message: string, args?: NcErrorArgs): never {
    return NcError._.unauthorized(message, args);
  }

  static forbidden(message: string, args?: NcErrorArgs): never {
    return NcError._.forbidden(message, args);
  }

  static sourceDataReadOnly(name: string): never {
    return NcError.forbidden(`Source '${name}' is read-only`);
  }

  static sourceMetaReadOnly(name: string): never {
    return NcError.forbidden(`Source '${name}' schema is read-only`);
  }

  static integrationNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.integrationNotFound(id, args);
  }

  static cannotCalculateIntermediateOrderError(): never {
    return NcError._.cannotCalculateIntermediateOrderError();
  }

  static reorderFailed(): never {
    return NcError._.reorderFailed();
  }

  static integrationLinkedWithMultiple(
    bases: BaseType[],
    sources: SourceType[],
    args?: NcErrorArgs,
  ): never {
    return NcError._.integrationLinkedWithMultiple(bases, sources, args);
  }

  static invalidAttachmentUploadScope(args?: NcErrorArgs): never {
    return NcError._.invalidAttachmentUploadScope(args);
  }

  static planLimitExceeded(
    message: string,
    details: Omit<PlanLimitExceededDetailsType, 'higherPlan'>,
    args?: NcErrorArgs,
  ): never {
    return NcError._.planLimitExceeded(message, details, args);
  }

  static allowedOnlySSOAccess(ncWorkspaceId: string): never {
    return NcError._.allowedOnlySSOAccess(ncWorkspaceId);
  }
  static maxInsertLimitExceeded(limit: number, args?: NcErrorArgs): never {
    return NcError._.maxInsertLimitExceeded(limit, args);
  }
  static baseUserError(message: string, args?: NcErrorArgs) {
    return NcError._.baseUserError(message, args);
  }

  static maxWorkspaceLimitReached(args?: NcErrorArgs): never {
    return NcError._.maxWorkspaceLimitReached(args);
  }

  static notFound(message = 'Not found'): never {
    return NcError._.notFound(message);
  }

  static badRequest(message): never {
    return NcError._.badRequest(message);
  }

  static unprocessableEntity(message = 'Unprocessable entity'): never {
    return NcError._.unprocessableEntity(message);
  }

  static optionsNotExists(props: {
    columnTitle: string;
    options: string[];
    validOptions: string[];
  }): never {
    return NcError._.optionsNotExists(props);
  }

  static testConnectionError(
    message = 'Unprocessable entity',
    code?: string,
  ): never {
    return NcError._.testConnectionError(message, code);
  }

  static notAllowed(message = 'Not allowed'): never {
    return NcError._.notAllowed(message);
  }

  static emailDomainNotAllowed(domain: string): never {
    return NcError._.emailDomainNotAllowed(domain);
  }

  static metaError(param: { message: string; sql: string }): never {
    return NcError._.metaError(param);
  }

  static permissionDenied(
    permissionName: string,
    roles: Record<string, boolean>,
    extendedScopeRoles: any,
  ): never {
    return NcError._.permissionDenied(
      permissionName,
      roles,
      extendedScopeRoles,
    );
  }

  static recordNotFound(
    id: string | string[] | Record<string, string> | Record<string, string>[],
    args?: NcErrorArgs,
  ): never {
    return NcError._.recordNotFound(id, args);
  }

  static ajvValidationError(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError: boolean;
  }): never {
    return NcError._.ajvValidationError(param);
  }
  /* endregion statics */
}
