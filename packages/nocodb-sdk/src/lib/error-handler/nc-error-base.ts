import { BaseType, SourceType } from '../Api';
import {
  BadRequestV2,
  MetaError,
  NcErrorArgs,
  NotAllowed,
  NotFound,
  OptionsNotExistsError,
  SsoError,
  TestConnectionError,
  UnprocessableEntity,
} from '../error/nc-base.error';
import { NcErrorType, PlanLimitExceededDetailsType } from '../globals';
import { HigherPlan } from '../payment';
import UITypes from '../UITypes';
import { NcErrorCodexManager } from './nc-error-codex-manager';

export class NcErrorBase {
  constructor() {
    this._errorCodex = new NcErrorCodexManager();
  }
  protected _errorCodex: NcErrorCodexManager;
  get errorCodex() {
    return this._errorCodex;
  }

  authenticationRequired(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.AUTHENTICATION_REQUIRED,
      args
    );
  }

  apiTokenNotAllowed(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.API_TOKEN_NOT_ALLOWED,
      args
    );
  }

  workspaceNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.WORKSPACE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  columnAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.COLUMN_ASSOCIATED_WITH_LINK,
      args
    );
  }

  tableAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.TABLE_ASSOCIATED_WITH_LINK,
      args
    );
  }

  baseNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.BASE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }
  baseNotFoundV3(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.BASE_NOT_FOUNDV3, {
      params: id,
      ...args,
    });
  }

  sourceNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.SOURCE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  tableNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.TABLE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  tableNotFoundV3(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.TABLE_NOT_FOUNDV3, {
      params: id,
      ...args,
    });
  }

  userNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.USER_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  viewNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.VIEW_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  viewNotFoundV3(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.VIEW_NOT_FOUNDV3, {
      params: id,
      ...args,
    });
  }

  hookNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.HOOK_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  genericNotFound(resource: string, id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.GENERIC_NOT_FOUND, {
      params: [resource, id],
      ...args,
    });
  }

  requiredFieldMissing(field: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.REQUIRED_FIELD_MISSING, {
      params: field,
      ...args,
    });
  }

  duplicateRecord(id: string | string[], args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERROR_DUPLICATE_RECORD, {
      params: id,
      ...args,
    });
  }

  fieldNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.FIELD_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  fieldNotFoundV3(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.FIELD_NOT_FOUNDV3, {
      params: id,
      ...args,
    });
  }

  invalidOffsetValue(offset: string | number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_OFFSET_VALUE, {
      params: `${offset}`,
      ...args,
    });
  }
  invalidPageValue(page: string | number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_PAGE_VALUE, {
      params: `${page}`,
      ...args,
    });
  }

  invalidPrimaryKey(value: any, pkColumn: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_PK_VALUE, {
      params: [value, pkColumn],
      ...args,
    });
  }

  invalidLimitValue(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_LIMIT_VALUE, {
      ...args,
    });
  }

  invalidFilter(filter: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_FILTER, {
      params: filter,
      ...args,
    });
  }

  invalidFilterV3(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_FILTERV3, {
      params: message,
      ...args,
    });
  }

  invalidValueForField(
    payload:
      | string
      | { value: string; column: string; type: UITypes; reason?: string },
    args?: NcErrorArgs
  ): never {
    const withReason =
      typeof payload === 'object' && payload.reason
        ? `, reason: ${payload.reason}`
        : ``;
    throw this.errorCodex.generateError(NcErrorType.INVALID_VALUE_FOR_FIELD, {
      params:
        typeof payload === 'string'
          ? payload
          : `Invalid value '${payload.value}' for type '${payload.type}' on column '${payload.column}'${withReason}`,
      ...args,
    });
  }

  valueLengthExceedLimit(
    payload: {
      column: string;
      type: UITypes;
      length: number;
      maxLength: number;
    },
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_VALUE_FOR_FIELD, {
      params: `Value length '${payload.length}' is exceeding allowed limit '${payload.maxLength}' for type '${payload.type}' on column '${payload.column}'`,
      ...args,
    });
  }

  invalidSharedViewPassword(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.INVALID_SHARED_VIEW_PASSWORD,
      {
        ...args,
      }
    );
  }

  invalidAttachmentJson(payload: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INVALID_ATTACHMENT_JSON, {
      params: payload,
      ...args,
    });
  }

  notImplemented(feature: string = 'Feature', args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.NOT_IMPLEMENTED, {
      params: feature,
      ...args,
    });
  }

  internalServerError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INTERNAL_SERVER_ERROR, {
      params: message,
      ...args,
    });
  }

  formulaError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.FORMULA_ERROR, {
      params: message,
      ...args,
    });
  }

  formulaCircularRefError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.FORMULA_CIRCULAR_REF_ERROR,
      {
        params: message,
        ...args,
      }
    );
  }

  unauthorized(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.AUTHENTICATION_REQUIRED, {
      params: message,
      ...args,
    });
  }

  forbidden(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.FORBIDDEN, {
      params: message,
      ...args,
    });
  }

  sourceDataReadOnly(name: string) {
    this.forbidden(`Source '${name}' is read-only`);
  }

  sourceMetaReadOnly(name: string) {
    this.forbidden(`Source '${name}' schema is read-only`);
  }

  integrationNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.INTEGRATION_NOT_FOUND, {
      params: id,
      ...(args || {}),
    });
  }

  cannotCalculateIntermediateOrderError(): never {
    throw this.errorCodex.generateError(
      NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER,
      {}
    );
  }

  reorderFailed(): never {
    throw this.errorCodex.generateError(NcErrorType.REORDER_FAILED, {});
  }

  integrationLinkedWithMultiple(
    bases: BaseType[],
    sources: SourceType[],
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(
      NcErrorType.INTEGRATION_LINKED_WITH_BASES,
      {
        params: bases.map((s) => s.title).join(', '),
        details: {
          bases: bases.map((b) => {
            return {
              id: b.id,
              title: b.title,
            };
          }),
          sources: sources.map((s) => {
            return {
              id: s.id,
              base_id: s.base_id,
              title: s.alias,
            };
          }),
        },
        ...(args || {}),
      }
    );
  }

  invalidAttachmentUploadScope(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.INVALID_ATTACHMENT_UPLOAD_SCOPE,
      args
    );
  }

  planLimitExceeded(
    message: string,
    details: Omit<PlanLimitExceededDetailsType, 'higherPlan'>,
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(NcErrorType.PLAN_LIMIT_EXCEEDED, {
      params: message,
      ...args,
      details: {
        ...details,
        ...(details?.plan ? { higherPlan: HigherPlan[details.plan] } : {}),
      },
    });
  }

  allowedOnlySSOAccess(ncWorkspaceId: string): never {
    throw this.errorCodex.generateError(NcErrorType.SSO_LOGIN_REQUIRED, {
      params: ncWorkspaceId,
    });
  }
  maxInsertLimitExceeded(limit: number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.MAX_INSERT_LIMIT_EXCEEDED, {
      params: limit.toString(),
      ...args,
    });
  }
  baseUserError(message: string, args?: NcErrorArgs) {
    throw this.errorCodex.generateError(NcErrorType.BASE_USER_ERROR, {
      params: message,
      ...args,
    });
  }

  maxWorkspaceLimitReached(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.MAX_WORKSPACE_LIMIT_REACHED,
      {
        ...args,
      }
    );
  }

  prohibitedSyncTableOperation(
    param: {
      modelName: string;
      operation: 'insert' | 'update' | 'delete' | 'create_form_view';
    },
    args?: NcErrorArgs
  ): never {
    let message = '';
    switch (param.operation) {
      case 'insert':
      case 'update':
      case 'delete':
        message = `Prohibited data insert / update / delete operation on synced table ${param.modelName}`;
        break;
      case 'create_form_view':
        message = `Form view creation is not supported for synced table ${param.modelName}`;
        break;
    }
    throw this.errorCodex.generateError(
      NcErrorType.PROHIBITED_SYNC_TABLE_OPERATION,
      {
        params: message,
        ...args,
      }
    );
  }

  unprocessableEntity(message = 'Unprocessable entity'): never {
    throw new UnprocessableEntity(message);
  }

  testConnectionError(message = 'Unprocessable entity', code?: string): never {
    throw new TestConnectionError(message, code);
  }

  notAllowed(message = 'Not allowed'): never {
    throw new NotAllowed(message);
  }

  emailDomainNotAllowed(domain: string): never {
    throw new SsoError(
      `Email domain ${domain} is not allowed for this organization`
    );
  }

  metaError(param: { message: string; sql: string }): never {
    throw new MetaError(param);
  }

  notFound(message = 'Not found'): never {
    throw new NotFound(message);
  }

  badRequest(message): never {
    throw new BadRequestV2(message);
  }

  optionsNotExists(props: {
    columnTitle: string;
    options: string[];
    validOptions: string[];
  }): never {
    throw new OptionsNotExistsError(props);
  }
}
