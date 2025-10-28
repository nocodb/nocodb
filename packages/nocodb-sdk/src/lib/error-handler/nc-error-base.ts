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
import {
  HigherPlan,
  PlanFeatureTypes,
  PlanFeatureUpgradeMessages,
} from '../payment';
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
      NcErrorType.ERR_AUTHENTICATION_REQUIRED,
      args
    );
  }

  apiTokenNotAllowed(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_API_TOKEN_NOT_ALLOWED,
      args
    );
  }

  workspaceNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_WORKSPACE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  columnAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_COLUMN_ASSOCIATED_WITH_LINK,
      args
    );
  }

  tableAssociatedWithLink(_id: string, args: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_TABLE_ASSOCIATED_WITH_LINK,
      args
    );
  }

  viewColumnNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_VIEW_COLUMN_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  baseNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_BASE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  dashboardNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_DASHBOARD_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  widgetNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_WIDGET_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  apiClientNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_API_CLIENT_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  sourceNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_SOURCE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }
  noSourcesFound(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_DATA_SOURCES_NOT_FOUND,
      args
    );
  }

  tableNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_TABLE_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  userNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_USER_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  teamNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_TEAM_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  viewNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_VIEW_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  hookNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_HOOK_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  genericNotFound(resource: string, id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_GENERIC_NOT_FOUND, {
      params: [resource, id],
      ...args,
    });
  }

  requiredFieldMissing(field: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_REQUIRED_FIELD_MISSING,
      {
        params: field,
        ...args,
      }
    );
  }

  duplicateRecord(id: string | string[], args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_DUPLICATE_RECORD, {
      params: id,
      ...args,
    });
  }

  fieldNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_FIELD_NOT_FOUND, {
      params: id,
      ...args,
    });
  }

  invalidOffsetValue(offset: string | number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_OFFSET_VALUE, {
      params: `${offset}`,
      ...args,
    });
  }
  invalidPageValue(page: string | number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_PAGE_VALUE, {
      params: `${page}`,
      ...args,
    });
  }

  invalidPrimaryKey(value: any, pkColumn: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_PK_VALUE, {
      params: [value, pkColumn],
      ...args,
    });
  }

  invalidLimitValue(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_LIMIT_VALUE, {
      ...args,
    });
  }

  invalidFilter(filter: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_FILTER, {
      params: filter,
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
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INVALID_VALUE_FOR_FIELD,
      {
        params:
          typeof payload === 'string'
            ? payload
            : `Invalid value '${payload.value}' for type '${payload.type}' on column '${payload.column}'${withReason}`,
        ...args,
      }
    );
  }

  unsupportedFilterOperation(operation: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_UNSUPPORTED_FILTER_OPERATION,
      {
        params: operation,
        ...args,
      }
    );
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
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INVALID_VALUE_FOR_FIELD,
      {
        params: `Value length '${payload.length}' is exceeding allowed limit '${payload.maxLength}' for type '${payload.type}' on column '${payload.column}'`,
        ...args,
      }
    );
  }

  invalidSharedViewPassword(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INVALID_SHARED_VIEW_PASSWORD,
      {
        ...args,
      }
    );
  }

  invalidSharedDashboardPassword(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SHARED_DASHBOARD_PASSWORD_INVALID,
      {
        ...args,
      }
    );
  }

  invalidAttachmentJson(payload: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INVALID_ATTACHMENT_JSON,
      {
        params: payload,
        ...args,
      }
    );
  }

  notImplemented(feature: string = 'Feature', args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_NOT_IMPLEMENTED, {
      params: feature,
      ...args,
    });
  }

  internalServerError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INTERNAL_SERVER, {
      params: message,
      ...args,
    });
  }

  formulaError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_FORMULA, {
      params: message,
      ...args,
    });
  }

  formulaCircularRefError(message?: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA,
      {
        params: message ?? 'Circular reference detected in formula',
        ...args,
      }
    );
  }

  unauthorized(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_AUTHENTICATION_REQUIRED,
      {
        params: message,
        ...args,
      }
    );
  }

  forbidden(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_FORBIDDEN, {
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
    throw this.errorCodex.generateError(NcErrorType.ERR_INTEGRATION_NOT_FOUND, {
      params: id,
      ...(args || {}),
    });
  }

  cannotCalculateIntermediateOrderError(): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER,
      {}
    );
  }

  reorderFailed(): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_REORDER_FAILED, {});
  }

  integrationLinkedWithMultiple(
    bases: BaseType[],
    sources: SourceType[],
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INTEGRATION_LINKED_WITH_BASES,
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
      NcErrorType.ERR_INVALID_ATTACHMENT_UPLOAD_SCOPE,
      args
    );
  }

  webhookError(message?: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_WEBHOOK_ERROR, {
      params: message,
      ...args,
    });
  }

  invalidWebhookUrl(url: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_WEBHOOK_URL_INVALID, {
      ...args,
      params: `Invalid URl ${url || ''}`,
    });
  }

  planLimitExceeded(
    message: string,
    details: Omit<PlanLimitExceededDetailsType, 'higherPlan'>,
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_PLAN_LIMIT_EXCEEDED, {
      params: message,
      ...args,
      details: {
        ...details,
        ...(details?.plan ? { higherPlan: HigherPlan[details.plan] } : {}),
      },
    });
  }

  duplicateAlias(
    param: {
      type: 'table' | 'column' | 'view';
      alias: string;
      base: string;
      label?: string;
      additionalTrace?: Record<string, string>;
    },
    args?: NcErrorArgs
  ): never {
    const stackTrace = [
      ...Object.keys(param.additionalTrace ?? {}).map(
        (key) => `${key} '${param.additionalTrace[key]}'`
      ),
      `base '${param.base}'`,
    ].join(', ');
    throw this.errorCodex.generateError(NcErrorType.ERR_DUPLICATE_IN_ALIAS, {
      params: `Duplicate ${param.type} ${param.label ?? 'alias'} '${
        param.alias
      }' at ${stackTrace}`,
      ...args,
    });
  }

  allowedOnlySSOAccess(ncWorkspaceId: string): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_SSO_LOGIN_REQUIRED, {
      params: ncWorkspaceId,
    });
  }
  allowedOnlySSOGeneratedToken(ncWorkspaceId: string): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SSO_GENERATED_TOKEN_REQUIRED,
      {
        params: ncWorkspaceId,
      }
    );
  }
  maxInsertLimitExceeded(limit: number, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_MAX_INSERT_LIMIT_EXCEEDED,
      {
        params: limit.toString(),
        ...args,
      }
    );
  }
  baseUserError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_BASE_COLLABORATION, {
      params: message,
      ...args,
    });
  }

  orgUserError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_ORG_USER, {
      params: message,
      ...args,
    });
  }

  tableError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_TABLE_OP_FAILED, {
      params: message,
      ...args,
    });
  }

  columnError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_COLUMN_OP_FAILED, {
      params: message,
      ...args,
    });
  }

  baseError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_BASE_OP_FAILED, {
      params: message,
      ...args,
    });
  }

  maxWorkspaceLimitReached(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_MAX_WORKSPACE_LIMIT_REACHED,
      {
        ...args,
      }
    );
  }

  pluginTestError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_TEST_PLUGIN_FAILED, {
      params: message,
      ...args,
    });
  }

  relationFieldNotFound(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_RELATION_FIELD_NOT_FOUND,
      {
        params: id,
        ...args,
      }
    );
  }

  unSupportedRelation(relation: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_UNSUPPORTED_RELATION, {
      params: `Relation ${relation} is not supported`,
      ...args,
    });
  }

  // for nc-sql-executor, the error returned is possible to be an Error object
  // thus `error.message` is needed to access it
  externalError(error: string | Error, args?: NcErrorArgs): never {
    let message: string = '';
    if (['string'].includes(typeof error)) {
      message = `${error}`;
    } else if (typeof error === 'object') {
      if (error.message) {
        message = error.message;
      } else {
        // we log the error if we don't know the schema yet
        console.log(
          `Unknown error schema from nc-sql-executor: ${JSON.stringify(error)}`
        );
      }
    }
    if (!message || message === '') {
      // generic error message to prevent programmatic error to propagate to UI
      message =
        'Error when executing query in external data source, please contact administration to solve this issue';
    }
    throw this.errorCodex.generateError(
      NcErrorType.ERR_IN_EXTERNAL_DATA_SOURCE,
      {
        params: message,
        ...args,
      }
    );
  }

  externalTimeOut(message?: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT,
      {
        params: message,
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
      NcErrorType.ERR_SYNC_TABLE_OPERATION_PROHIBITED,
      {
        params: message,
        ...args,
      }
    );
  }
  featureNotSupported(
    props: {
      feature: PlanFeatureTypes;
      isOnPrem?: boolean;
    },
    args?: NcErrorArgs
  ) {
    if (props.isOnPrem) {
      throw this.errorCodex.generateError(
        NcErrorType.ERR_FEATURE_NOT_SUPPORTED,
        {
          params: `Please upgrade your license ${
            PlanFeatureUpgradeMessages[props.feature] ?? 'to use this feature.'
          }`,
          ...args,
        }
      );
    }

    throw this.errorCodex.generateError(NcErrorType.ERR_FEATURE_NOT_SUPPORTED, {
      params: `Upgrade to a higher plan ${
        PlanFeatureUpgradeMessages[props.feature] ?? 'to use this feature.'
      }`,
      ...args,
    });
  }

  invalidRequestBody(message: string): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_INVALID_REQUEST_BODY, {
      params: message,
    });
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

  outOfSync(message: string): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_OUT_OF_SYNC, {
      params: message,
    });
  }

  filterVerificationFailed(errors: string[]): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_FILTER_VERIFICATION_FAILED,
      {
        params: errors.join(', '),
      }
    );
  }
  storageFileCreateError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_STORAGE_FILE_CREATE, {
      params: message,
      ...args,
    });
  }

  storageFileReadError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_STORAGE_FILE_READ, {
      params: message,
      ...args,
    });
  }

  storageFileDeleteError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_STORAGE_FILE_DELETE, {
      params: message,
      ...args,
    });
  }

  storageFileStreamError(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_STORAGE_FILE_STREAM, {
      params: message,
      ...args,
    });
  }
  subscriptionAlreadyExists(
    workspaceOrOrgId: string,
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SUBSCRIPTION_ALREADY_EXISTS,
      {
        params: workspaceOrOrgId,
        ...args,
      }
    );
  }

  subscriptionNotFound(workspaceOrOrgId: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SUBSCRIPTION_NOT_FOUND,
      {
        params: workspaceOrOrgId,
        ...args,
      }
    );
  }

  planNotAvailable(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_PLAN_NOT_AVAILABLE,
      args
    );
  }

  seatCountMismatch(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_SEAT_COUNT_MISMATCH, {
      params: 'There was a mismatch in the seat count, please try again',
      ...args,
    });
  }

  invalidPaymentPayload(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INVALID_PAYMENT_PAYLOAD,
      {
        params: 'Invalid payment payload',
        ...args,
      }
    );
  }

  stripeCustomerNotFound(customerId: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_STRIPE_CUSTOMER_NOT_FOUND,
      {
        params: customerId,
        ...args,
      }
    );
  }

  stripeSubscriptionNotFound(
    subscriptionId: string,
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_STRIPE_SUBSCRIPTION_NOT_FOUND,
      {
        params: subscriptionId,
        ...args,
      }
    );
  }

  subscriptionOwnershipMismatch(
    entity: 'workspace' | 'org',
    args?: NcErrorArgs
  ): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SUBSCRIPTION_OWNERSHIP_MISMATCH,
      {
        params: `Subscription does not belong to the ${entity}`,
        ...args,
      }
    );
  }

  internalCustomerNotSupported(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_INTERNAL_CUSTOMER_NOT_SUPPORTED,
      {
        params: 'Internal customer not supported',
        ...args,
      }
    );
  }

  subscriptionCreateFailed(message: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_SUBSCRIPTION_CREATE_FAILED,
      {
        params: message,
        ...args,
      }
    );
  }

  stripeWebhookVerificationFailed(args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(
      NcErrorType.ERR_STRIPE_WEBHOOK_VERIFICATION_FAILED,
      {
        params: 'Webhook signature verification failed',
        ...args,
      }
    );
  }
  planAlreadyExists(id: string, args?: NcErrorArgs): never {
    throw this.errorCodex.generateError(NcErrorType.ERR_PLAN_ALREADY_EXISTS, {
      params: id,
      ...args,
    });
  }
}
