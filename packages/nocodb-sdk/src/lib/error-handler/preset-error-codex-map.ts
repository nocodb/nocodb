import { NcErrorType } from '~/lib/globals';
import { ncIsNumber } from '~/lib/is';

export const presetErrorCodexMap: Partial<
  Record<
    NcErrorType,
    {
      message: string | ((...params: string[]) => string);
      code: number;
      error_code?: NcErrorType;
    }
  >
> = {
  [NcErrorType.ERR_UNKNOWN]: {
    message: 'Something went wrong',
    code: 500,
  },
  [NcErrorType.ERR_INTERNAL_SERVER]: {
    message: (message: string) => message || `Internal server error`,
    code: 500,
  },
  [NcErrorType.ERR_DATABASE_OP_FAILED]: {
    message: (message: string) =>
      message || `There was an error while running the query`,
    code: 500,
  },
  [NcErrorType.ERR_AUTHENTICATION_REQUIRED]: {
    message: (message: string) =>
      message
        ? `Authentication required - ${message}`
        : 'Authentication required to access this resource',
    code: 401,
  },
  [NcErrorType.ERR_FORBIDDEN]: {
    message: (message: string) =>
      message ? `Forbidden - ${message}` : 'Forbidden to access this resource',
    code: 403,
  },
  [NcErrorType.ERR_API_TOKEN_NOT_ALLOWED]: {
    message: 'This request is not allowed with API token',
    code: 401,
  },
  [NcErrorType.ERR_WORKSPACE_NOT_FOUND]: {
    message: (id: string) => `Workspace '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_BASE_NOT_FOUND]: {
    message: (id: string) => `Base '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_VIEW_COLUMN_NOT_FOUND]: {
    message: (id: string) => `View column '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_SOURCE_NOT_FOUND]: {
    message: (id: string) => `Source '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_INTEGRATION_NOT_FOUND]: {
    message: (id: string) => `Connection '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_INTEGRATION_LINKED_WITH_BASES]: {
    message: (bases) => `Connection linked with following bases '${bases}'`,
    code: 404,
  },
  [NcErrorType.ERR_TABLE_NOT_FOUND]: {
    message: (id: string) => `Table '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_VIEW_NOT_FOUND]: {
    message: (id: string) => `View '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_FIELD_NOT_FOUND]: {
    message: (id: string) => `Field ${id} not found`,
    code: 404,
  },
  [NcErrorType.ERR_HOOK_NOT_FOUND]: {
    message: (id: string) => `Hook '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_RECORD_NOT_FOUND]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(', ')}' not found`;
    },
    code: 404,
  },
  [NcErrorType.ERR_GENERIC_NOT_FOUND]: {
    message: (resource: string, id: string) => `${resource} '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_WIDGET_NOT_FOUND]: {
    message: (id: string) => `Widget '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_DASHBOARD_NOT_FOUND]: {
    message: (id: string) => `Dashboard '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_WORKFLOW_NOT_FOUND]: {
    message: (id: string) => `Workflow '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_SCRIPT_NOT_FOUND]: {
    message: (id: string) => `Script '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_REQUIRED_FIELD_MISSING]: {
    message: (field: string) => `Field '${field}' is required`,
    code: 422,
  },
  [NcErrorType.ERR_DUPLICATE_RECORD]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(
        ', '
      )}' already exists`;
    },
    code: 422,
  },
  [NcErrorType.ERR_USER_NOT_FOUND]: {
    message: (idOrEmail: string) => {
      const isEmail = idOrEmail.includes('@');
      return `User ${
        isEmail ? 'with email' : 'with id'
      } '${idOrEmail}' not found`;
    },
    code: 404,
  },
  [NcErrorType.ERR_TEAM_NOT_FOUND]: {
    message: (id: string) => `Team '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_INVALID_OFFSET_VALUE]: {
    message: (offset: string) =>
      ncIsNumber(Number(offset)) && Number(offset) > 0
        ? `Offset value '${offset}' is invalid`
        : `Offset must be a non-negative integer`,
    code: 422,
  },
  [NcErrorType.ERR_INVALID_PAGE_VALUE]: {
    message: (page: string) => `Page value '${page}' is invalid`,
    code: 422,
  },
  [NcErrorType.ERR_INVALID_PK_VALUE]: {
    message: (value: any, pkColumn: string) =>
      `Primary key value '${value}' is invalid for column '${pkColumn}'`,
    code: 422,
  },
  [NcErrorType.ERR_INVALID_LIMIT_VALUE]: {
    message: (limitMin: string, limitMax: string) =>
      `Limit value should be between ${limitMin} and ${limitMax}`,
    code: 422,
  },
  [NcErrorType.ERR_INVALID_FILTER]: {
    message: (filter: string) => `Filter '${filter}' is invalid`,
    code: 422,
  },
  [NcErrorType.ERR_UNSUPPORTED_FILTER_OPERATION]: {
    message: (operation: string) => `Operation '${operation}' is not supported`,
    code: 400,
  },
  [NcErrorType.ERR_INVALID_SHARED_VIEW_PASSWORD]: {
    message: 'Invalid shared view password',
    code: 403,
  },
  [NcErrorType.ERR_SHARED_DASHBOARD_PASSWORD_INVALID]: {
    message: 'Invalid shared dashboard password',
    code: 403,
  },
  [NcErrorType.ERR_INVALID_ATTACHMENT_JSON]: {
    message: (payload: string) =>
      `Invalid JSON for attachment field: ${payload}`,
    code: 400,
  },
  [NcErrorType.ERR_NOT_IMPLEMENTED]: {
    message: (feature: string) => `${feature} is not implemented`,
    code: 501,
  },
  [NcErrorType.ERR_INVALID_JSON]: {
    message: 'Invalid JSON in request body',
    code: 400,
  },
  [NcErrorType.ERR_COLUMN_ASSOCIATED_WITH_LINK]: {
    message: 'Column is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.ERR_TABLE_ASSOCIATED_WITH_LINK]: {
    message: 'Table is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.ERR_FORMULA]: {
    message: (message: string) => {
      return message;
    },
    code: 400,
  },
  [NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA]: {
    message: (message: string) => {
      return message;
    },
    code: 400,
  },
  [NcErrorType.ERR_PERMISSION_DENIED]: {
    message: 'Permission denied',
    code: 403,
  },
  [NcErrorType.ERR_INVALID_ATTACHMENT_UPLOAD_SCOPE]: {
    message: 'Invalid attachment upload scope',
    code: 400,
  },
  [NcErrorType.ERR_REORDER_FAILED]: {
    message: 'Reorder failed',
    code: 400,
  },
  [NcErrorType.ERR_CANNOT_CALCULATE_INTERMEDIATE_ORDER]: {
    message: 'Cannot calculate intermediate order',
    code: 400,
  },
  [NcErrorType.ERR_PLAN_LIMIT_EXCEEDED]: {
    message: (message: string) => message || 'Plan limit exceeded',
    code: 403,
  },
  [NcErrorType.ERR_SSO_LOGIN_REQUIRED]: {
    message: (_workspaceId: string) => 'SSO login required for workspace',
    code: 403,
  },
  [NcErrorType.ERR_SSO_GENERATED_TOKEN_REQUIRED]: {
    message: (_workspaceId: string) =>
      'This workspace requires SSO-authenticated tokens. Please generate a new token after signing in with SSO',
    code: 403,
  },
  [NcErrorType.ERR_MAX_INSERT_LIMIT_EXCEEDED]: {
    message: (limit: string) => `Maximum ${limit} records during insert`,
    code: 422,
  },
  [NcErrorType.ERR_MAX_WORKSPACE_LIMIT_REACHED]: {
    message: () =>
      `The maximum workspace limit has been reached. Please contact your administrator to request access to a workspace.`,
    code: 403,
  },
  [NcErrorType.ERR_INVALID_VALUE_FOR_FIELD]: {
    message: (message: string) => message,
    code: 422,
  },
  [NcErrorType.ERR_INVALID_REQUEST_BODY]: {
    message: (message: string) => message,
    code: 400,
  },
  [NcErrorType.ERR_BASE_COLLABORATION]: {
    message: (message: string) => message || 'Something went wrong',
    code: 422,
  },
  [NcErrorType.ERR_ORG_USER]: {
    message: (message: string) => message || 'Something went wrong',
    code: 422,
  },
  [NcErrorType.ERR_TABLE_OP_FAILED]: {
    message: (message: string) => message || 'Something went wrong',
    code: 422,
  },
  [NcErrorType.ERR_COLUMN_OP_FAILED]: {
    message: (message: string) => message || 'Something went wrong',
    code: 422,
  },
  [NcErrorType.ERR_SYNC_TABLE_OPERATION_PROHIBITED]: {
    message: (message: string) =>
      message ||
      `Prohibited data insert / update / delete operation on synced table`,
    code: 422,
  },
  [NcErrorType.ERR_FEATURE_NOT_SUPPORTED]: {
    message: (message: string) =>
      message || `Upgrade to a higher plan to use this feature.`,
    code: 403,
  },
  [NcErrorType.ERR_DUPLICATE_IN_ALIAS]: {
    message: (message: string) => message,
    code: 422,
  },
  [NcErrorType.ERR_OUT_OF_SYNC]: {
    message: (message: string) =>
      message || `Please refresh the page and try again.`,
    code: 409,
  },
  [NcErrorType.ERR_FILTER_VERIFICATION_FAILED]: {
    message: (message: string) => `Filter verification failed: ${message}`,
    code: 422,
  },
  [NcErrorType.ERR_WEBHOOK_ERROR]: {
    message: (message: string) => message,
    code: 400,
  },
  [NcErrorType.ERR_DATA_SOURCES_NOT_FOUND]: {
    message: (message: string) => message,
    code: 400,
  },
  [NcErrorType.ERR_TEST_PLUGIN_FAILED]: {
    message: (message: string) => message,
    code: 400,
  },
  [NcErrorType.ERR_UNSUPPORTED_RELATION]: {
    message: (message: string) => message,
    code: 400,
  },
  [NcErrorType.ERR_IN_EXTERNAL_DATA_SOURCE]: {
    message: (message: string) =>
      message ||
      'Error running query on external source. Confirm if source is accessible.',
    code: 400,
  },
  [NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT]: {
    message: (message: string) =>
      message ||
      'External source taking long to respond. Reconsider sorts/filters for this view and confirm if source is accessible.',
    code: 504,
  },
  [NcErrorType.ERR_RELATION_FIELD_NOT_FOUND]: {
    message: (id: string) => `Relation Field '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_EXTENSION_NOT_FOUND]: {
    message: (id: string) => `Extension '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_STORAGE_FILE_CREATE]: {
    message: (details: string) => `Failed to create file: ${details}`,
    code: 500,
  },
  [NcErrorType.ERR_STORAGE_FILE_READ]: {
    message: (details: string) => `Failed to read file: ${details}`,
    code: 500,
  },
  [NcErrorType.ERR_STORAGE_FILE_DELETE]: {
    message: (details: string) => `Failed to delete file: ${details}`,
    code: 500,
  },
  [NcErrorType.ERR_STORAGE_FILE_STREAM]: {
    message: (details: string) => `Failed to stream file: ${details}`,
    code: 500,
  },
  [NcErrorType.ERR_SUBSCRIPTION_ALREADY_EXISTS]: {
    message: (id: string) => `Subscription already exists for ${id}`,
    code: 409,
  },
  [NcErrorType.ERR_SUBSCRIPTION_NOT_FOUND]: {
    message: (id: string) => `Subscription not found for ${id}`,
    code: 404,
  },
  [NcErrorType.ERR_PLAN_NOT_AVAILABLE]: {
    message: () => 'This plan is not available',
    code: 400,
  },
  [NcErrorType.ERR_SEAT_COUNT_MISMATCH]: {
    message: (msg: string) => msg,
    code: 400,
  },
  [NcErrorType.ERR_INVALID_PAYMENT_PAYLOAD]: {
    message: (msg: string) => msg,
    code: 400,
  },
  [NcErrorType.ERR_STRIPE_CUSTOMER_NOT_FOUND]: {
    message: (id: string) => `Stripe customer '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_STRIPE_SUBSCRIPTION_NOT_FOUND]: {
    message: (id: string) => `Stripe subscription '${id}' not found`,
    code: 404,
  },
  [NcErrorType.ERR_SUBSCRIPTION_OWNERSHIP_MISMATCH]: {
    message: (msg: string) => msg,
    code: 403,
  },
  [NcErrorType.ERR_INTERNAL_CUSTOMER_NOT_SUPPORTED]: {
    message: (msg: string) => msg,
    code: 501,
  },
  [NcErrorType.ERR_SUBSCRIPTION_CREATE_FAILED]: {
    message: (msg: string) => msg,
    code: 500,
  },
  [NcErrorType.ERR_STRIPE_WEBHOOK_VERIFICATION_FAILED]: {
    message: (msg: string) => msg,
    code: 400,
  },
  [NcErrorType.ERR_PLAN_ALREADY_EXISTS]: {
    message: (id: string) => `Plan already exists with id ${id}`,
    code: 409,
  },
};
