import { NcApiVersion } from 'nocodb-sdk';
import { NcErrorV1 } from './NcErrorV1';
import { NcErrorV3 } from './ncErrorV3';
import type { ErrorObject } from 'ajv';
import type {
  BaseType,
  NcContext,
  NcErrorArgs,
  PlanLimitExceededDetailsType,
  SourceType,
  UITypes,
} from 'nocodb-sdk';
export { AjvError } from './NcErrorV1';

export class NcError {
  static _ = new NcErrorV1();
  static _V3 = new NcErrorV3();

  // return ncError based on api version
  static get(context?: NcContext) {
    if (context?.api_version === NcApiVersion.V3) {
      return NcError._V3;
    }
    return NcError._;
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

  static sourceNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.sourceNotFound(id, args);
  }

  static tableNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.tableNotFound(id, args);
  }

  static userNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.userNotFound(id, args);
  }

  static viewNotFound(id: string, args?: NcErrorArgs): never {
    return NcError._.viewNotFound(id, args);
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
