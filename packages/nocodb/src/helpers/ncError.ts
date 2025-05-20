import {
  NcBaseError,
  NcErrorBase,
  NcErrorGenerator,
  NcErrorType,
} from 'nocodb-sdk';
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

export class NcError {
  static _instance: NcError;
  static get _() {
    if (!this._instance) {
      this._instance = new NcError();
      NcErrorGenerator._.setErrorCodex(NcErrorType.INVALID_LIMIT_VALUE, {
        message: `Limit value should be between ${defaultLimitConfig.limitMin} and ${defaultLimitConfig.limitMax}`,
        code: 422,
      });
    }
    return this._instance;
  }

  static authenticationRequired(args?: NcErrorArgs): never {
    NcErrorBase._.authenticationRequired(args);
  }

  static apiTokenNotAllowed(args?: NcErrorArgs): never {
    NcErrorBase._.apiTokenNotAllowed(args);
  }

  static workspaceNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.workspaceNotFound(id, args);
  }

  static columnAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    NcErrorBase._.columnAssociatedWithLink(_id, args);
  }

  static tableAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    NcErrorBase._.tableAssociatedWithLink(_id, args);
  }

  static baseNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.baseNotFound(id, args);
  }
  static baseNotFoundV3(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.baseNotFoundV3(id, args);
  }

  static sourceNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.sourceNotFound(id, args);
  }

  static tableNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.tableNotFound(id, args);
  }

  static tableNotFoundV3(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.tableNotFoundV3(id, args);
  }

  static userNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.userNotFound(id, args);
  }

  static viewNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.viewNotFound(id, args);
  }

  static viewNotFoundV3(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.viewNotFoundV3(id, args);
  }

  static hookNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.hookNotFound(id, args);
  }

  static genericNotFound(
    resource: string,
    id: string,
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.genericNotFound(resource, id, args);
  }

  static requiredFieldMissing(field: string, args?: NcErrorArgs): never {
    NcErrorBase._.requiredFieldMissing(field, args);
  }

  static duplicateRecord(id: string | string[], args?: NcErrorArgs): never {
    NcErrorBase._.duplicateRecord(id, args);
  }

  static fieldNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.fieldNotFound(id, args);
  }

  static fieldNotFoundV3(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.fieldNotFoundV3(id, args);
  }

  static invalidOffsetValue(
    offset: string | number,
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.invalidOffsetValue(offset, args);
  }
  static invalidPageValue(page: string | number, args?: NcErrorArgs): never {
    NcErrorBase._.invalidPageValue(page, args);
  }

  static invalidPrimaryKey(
    value: any,
    pkColumn: string,
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.invalidPrimaryKey(value, pkColumn, args);
  }

  static invalidLimitValue(args?: NcErrorArgs): never {
    NcErrorBase._.invalidLimitValue(args);
  }

  static invalidFilter(filter: string, args?: NcErrorArgs): never {
    NcErrorBase._.invalidFilter(filter, args);
  }

  static invalidFilterV3(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.invalidFilterV3(message, args);
  }

  static invalidValueForField(
    payload: string | { value: string; column: string; type: UITypes },
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.invalidValueForField(payload, args);
  }

  static invalidSharedViewPassword(args?: NcErrorArgs): never {
    NcErrorBase._.invalidSharedViewPassword(args);
  }

  static invalidAttachmentJson(payload: string, args?: NcErrorArgs): never {
    NcErrorBase._.invalidAttachmentJson(payload, args);
  }

  static notImplemented(
    feature: string = 'Feature',
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.notImplemented(feature, args);
  }

  static internalServerError(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.internalServerError(message, args);
  }

  static formulaError(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.formulaError(message, args);
  }

  static formulaCircularRefError(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.formulaCircularRefError(message, args);
  }

  static unauthorized(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.unauthorized(message, args);
  }

  static forbidden(message: string, args?: NcErrorArgs): never {
    NcErrorBase._.forbidden(message, args);
  }

  static sourceDataReadOnly(name: string): never {
    NcError.forbidden(`Source '${name}' is read-only`);
  }

  static sourceMetaReadOnly(name: string): never {
    NcError.forbidden(`Source '${name}' schema is read-only`);
  }

  static integrationNotFound(id: string, args?: NcErrorArgs): never {
    NcErrorBase._.integrationNotFound(id, args);
  }

  static cannotCalculateIntermediateOrderError(): never {
    NcErrorBase._.cannotCalculateIntermediateOrderError();
  }

  static reorderFailed(): never {
    NcErrorBase._.reorderFailed();
  }

  static integrationLinkedWithMultiple(
    bases: BaseType[],
    sources: SourceType[],
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.integrationLinkedWithMultiple(bases, sources, args);
  }

  static invalidAttachmentUploadScope(args?: NcErrorArgs): never {
    NcErrorBase._.invalidAttachmentUploadScope(args);
  }

  static planLimitExceeded(
    message: string,
    details: Omit<PlanLimitExceededDetailsType, 'higherPlan'>,
    args?: NcErrorArgs,
  ): never {
    NcErrorBase._.planLimitExceeded(message, details, args);
  }

  static allowedOnlySSOAccess(ncWorkspaceId: string): never {
    NcErrorBase._.allowedOnlySSOAccess(ncWorkspaceId);
  }
  static maxInsertLimitExceeded(limit: number, args?: NcErrorArgs): never {
    NcErrorBase._.maxInsertLimitExceeded(limit, args);
  }
  static baseUserError(message: string, args?: NcErrorArgs) {
    NcErrorBase._.baseUserError(message, args);
  }

  static maxWorkspaceLimitReached(args?: NcErrorArgs): never {
    NcErrorBase._.maxWorkspaceLimitReached(args);
  }

  static notFound(message = 'Not found'): never {
    NcErrorBase._.notFound(message);
  }

  static badRequest(message): never {
    NcErrorBase._.badRequest(message);
  }

  static unprocessableEntity(message = 'Unprocessable entity'): never {
    NcErrorBase._.unprocessableEntity(message);
  }

  static optionsNotExists(props: {
    columnTitle: string;
    options: string[];
    validOptions: string[];
  }): never {
    NcErrorBase._.optionsNotExists(props);
  }

  static testConnectionError(
    message = 'Unprocessable entity',
    code?: string,
  ): never {
    NcErrorBase._.testConnectionError(message, code);
  }

  static notAllowed(message = 'Not allowed'): never {
    NcErrorBase._.notAllowed(message);
  }

  static emailDomainNotAllowed(domain: string): never {
    NcErrorBase._.emailDomainNotAllowed(domain);
  }

  static metaError(param: { message: string; sql: string }): never {
    NcErrorBase._.metaError(param);
  }

  static permissionDenied(
    permissionName: string,
    roles: Record<string, boolean>,
    extendedScopeRoles: any,
  ): never {
    throw NcErrorGenerator._.generateError(NcErrorType.PERMISSION_DENIED, {
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

  static recordNotFound(
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

    throw NcErrorGenerator._.generateError(NcErrorType.RECORD_NOT_FOUND, {
      params: formatedId,
      ...args,
    });
  }

  static ajvValidationError(param: {
    message: string;
    errors: ErrorObject[];
    humanReadableError: boolean;
  }): never {
    throw new AjvError(param);
  }
}
