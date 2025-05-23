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
  [NcErrorType.UNKNOWN_ERROR]: {
    message: 'Something went wrong',
    code: 500,
  },
  [NcErrorType.INTERNAL_SERVER_ERROR]: {
    message: (message: string) => message || `Internal server error`,
    code: 500,
  },
  [NcErrorType.DATABASE_ERROR]: {
    message: (message: string) =>
      message || `There was an error while running the query`,
    code: 500,
  },
  [NcErrorType.AUTHENTICATION_REQUIRED]: {
    message: (message: string) =>
      message
        ? `Authentication required - ${message}`
        : 'Authentication required to access this resource',
    code: 401,
  },
  [NcErrorType.FORBIDDEN]: {
    message: (message: string) =>
      message ? `Forbidden - ${message}` : 'Forbidden to access this resource',
    code: 403,
  },
  [NcErrorType.API_TOKEN_NOT_ALLOWED]: {
    message: 'This request is not allowed with API token',
    code: 401,
  },
  [NcErrorType.WORKSPACE_NOT_FOUND]: {
    message: (id: string) => `Workspace '${id}' not found`,
    code: 404,
  },
  [NcErrorType.BASE_NOT_FOUND]: {
    message: (id: string) => `Base '${id}' not found`,
    code: 404,
  },
  [NcErrorType.BASE_NOT_FOUNDV3]: {
    message: (id: string) => `Base '${id}' not found`,
    code: 422,
  },
  [NcErrorType.SOURCE_NOT_FOUND]: {
    message: (id: string) => `Source '${id}' not found`,
    code: 404,
  },
  [NcErrorType.INTEGRATION_NOT_FOUND]: {
    message: (id: string) => `Connection '${id}' not found`,
    code: 404,
  },
  [NcErrorType.INTEGRATION_LINKED_WITH_BASES]: {
    message: (bases) => `Connection linked with following bases '${bases}'`,
    code: 404,
  },
  [NcErrorType.TABLE_NOT_FOUND]: {
    message: (id: string) => `Table '${id}' not found`,
    code: 404,
  },
  [NcErrorType.TABLE_NOT_FOUNDV3]: {
    message: (id: string) => `Table '${id}' not found`,
    code: 422,
  },
  [NcErrorType.VIEW_NOT_FOUND]: {
    message: (id: string) => `View '${id}' not found`,
    code: 404,
  },
  [NcErrorType.VIEW_NOT_FOUNDV3]: {
    message: (id: string) => `View '${id}' not found`,
    code: 422,
  },
  [NcErrorType.FIELD_NOT_FOUND]: {
    message: (id: string) => `Field '${id}' not found`,
    code: 404,
  },
  [NcErrorType.FIELD_NOT_FOUNDV3]: {
    message: (id: string) => `Field '${id}' not found`,
    code: 422,
  },
  [NcErrorType.HOOK_NOT_FOUND]: {
    message: (id: string) => `Hook '${id}' not found`,
    code: 404,
  },
  [NcErrorType.RECORD_NOT_FOUND]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(', ')}' not found`;
    },
    code: 404,
  },
  [NcErrorType.GENERIC_NOT_FOUND]: {
    message: (resource: string, id: string) => `${resource} '${id}' not found`,
    code: 404,
  },
  [NcErrorType.REQUIRED_FIELD_MISSING]: {
    message: (field: string) => `Field '${field}' is required`,
    code: 422,
  },
  [NcErrorType.ERROR_DUPLICATE_RECORD]: {
    message: (...ids: string[]) => {
      const isMultiple = Array.isArray(ids) && ids.length > 1;
      return `Record${isMultiple ? 's' : ''} '${ids.join(
        ', '
      )}' already exists`;
    },
    code: 422,
  },
  [NcErrorType.USER_NOT_FOUND]: {
    message: (idOrEmail: string) => {
      const isEmail = idOrEmail.includes('@');
      return `User ${
        isEmail ? 'with email' : 'with id'
      } '${idOrEmail}' not found`;
    },
    code: 404,
  },
  [NcErrorType.INVALID_OFFSET_VALUE]: {
    message: (offset: string) =>
      ncIsNumber(Number(offset)) && Number(offset) > 0
        ? `Offset value '${offset}' is invalid`
        : `Offset must be a non-negative integer`,
    code: 422,
  },
  [NcErrorType.INVALID_PAGE_VALUE]: {
    message: (page: string) => `Page value '${page}' is invalid`,
    code: 422,
  },
  [NcErrorType.INVALID_PK_VALUE]: {
    message: (value: any, pkColumn: string) =>
      `Primary key value '${value}' is invalid for column '${pkColumn}'`,
    code: 422,
  },
  [NcErrorType.INVALID_LIMIT_VALUE]: {
    message: (limitMin: string, limitMax: string) =>
      `Limit value should be between ${limitMin} and ${limitMax}`,
    code: 422,
  },
  [NcErrorType.INVALID_FILTER]: {
    message: (filter: string) => `Filter '${filter}' is invalid`,
    code: 422,
  },
  [NcErrorType.INVALID_FILTERV3]: {
    message: (message: string) => `Invalid filter expression: ${message}`,
    code: 422,
  },
  [NcErrorType.INVALID_SHARED_VIEW_PASSWORD]: {
    message: 'Invalid shared view password',
    code: 403,
  },
  [NcErrorType.INVALID_ATTACHMENT_JSON]: {
    message: (payload: string) =>
      `Invalid JSON for attachment field: ${payload}`,
    code: 400,
  },
  [NcErrorType.NOT_IMPLEMENTED]: {
    message: (feature: string) => `${feature} is not implemented`,
    code: 501,
  },
  [NcErrorType.BAD_JSON]: {
    message: 'Invalid JSON in request body',
    code: 400,
  },
  [NcErrorType.COLUMN_ASSOCIATED_WITH_LINK]: {
    message: 'Column is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.TABLE_ASSOCIATED_WITH_LINK]: {
    message: 'Table is associated with a link, please remove the link first',
    code: 400,
  },
  [NcErrorType.FORMULA_ERROR]: {
    message: (message: string) => {
      // try to extract db error - Experimental
      if (message.includes(' - ')) {
        const [_, dbError] = message.split(' - ');
        return `Formula error: ${dbError}`;
      }
      return `Formula error: ${message}`;
    },
    code: 400,
  },
  [NcErrorType.FORMULA_CIRCULAR_REF_ERROR]: {
    message: 'Circular reference detected in formula',
    code: 400,
  },
  [NcErrorType.PERMISSION_DENIED]: {
    message: 'Permission denied',
    code: 403,
  },
  [NcErrorType.INVALID_ATTACHMENT_UPLOAD_SCOPE]: {
    message: 'Invalid attachment upload scope',
    code: 400,
  },
  [NcErrorType.REORDER_FAILED]: {
    message: 'Reorder failed',
    code: 400,
  },
  [NcErrorType.CANNOT_CALCULATE_INTERMEDIATE_ORDER]: {
    message: 'Cannot calculate intermediate order',
    code: 400,
  },
  [NcErrorType.PLAN_LIMIT_EXCEEDED]: {
    message: (message: string) => message || 'Plan limit exceeded',
    code: 403,
  },
  [NcErrorType.SSO_LOGIN_REQUIRED]: {
    message: (_workspaceId: string) => 'SSO login required for workspace',
    code: 403,
  },
  [NcErrorType.MAX_INSERT_LIMIT_EXCEEDED]: {
    message: (limit: string) => `Maximum ${limit} records during insert`,
    code: 422,
  },
  [NcErrorType.MAX_WORKSPACE_LIMIT_REACHED]: {
    message: () =>
      `The maximum workspace limit has been reached. Please contact your administrator to request access to a workspace.`,
    code: 403,
  },
  [NcErrorType.INVALID_VALUE_FOR_FIELD]: {
    message: (message: string) => message,
    code: 422,
  },
  [NcErrorType.BASE_USER_ERROR]: {
    message: (message: string) => message || 'Something went wrong',
    code: 422,
  },
};
