import {
  NcBaseErrorv2,
  NcErrorType,
  NcSDKError,
  NcSDKErrorV2,
} from 'nocodb-sdk';
import {
  AjvError,
  BadRequest,
  ExternalError,
  ExternalTimeout,
  Forbidden,
  NcBaseError,
  NotFound,
  OptionsNotExistsError,
  Unauthorized,
  UniqueConstraintViolationError,
  UnprocessableEntity,
} from '~/helpers/catchError';
import { extractDBError } from '~/helpers/catchError';
import { ERROR_HINT_MAX_LENGTH } from '~/integrations/ai/chat/constants';

interface ErrorHint {
  retriable: boolean;
  llmHint: string;
}

const NC_ERROR_HINTS: Partial<Record<NcErrorType, ErrorHint>> = {
  [NcErrorType.ERR_TABLE_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The table name may be misspelled or does not exist. Call list_tables to get all available table names, then retry with the correct name. If no match exists, inform the user the table was not found.',
  },
  [NcErrorType.ERR_FIELD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The field name may be misspelled or does not exist in this table. Call describe_table to get the exact field names and types, then retry with the correct field name. Field names are case-sensitive.',
  },
  [NcErrorType.ERR_VIEW_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The view name may be misspelled or does not exist. Call list_views to get available views for this table, then retry with the correct name. If no match exists, inform the user.',
  },
  [NcErrorType.ERR_VIEW_COLUMN_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The field is not visible in this view. Call list_view_fields to see which fields are available in this specific view. The field may exist in the table but be hidden in this view.',
  },
  [NcErrorType.ERR_RECORD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The record ID does not exist. Call query_records with appropriate filters to find the correct record ID, then retry. The record may have been deleted or the ID may be from a different table.',
  },
  [NcErrorType.ERR_DASHBOARD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The dashboard name or ID is incorrect. Call list_dashboards to get available dashboards, then retry with the correct identifier.',
  },
  [NcErrorType.ERR_WIDGET_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The widget name or ID is incorrect. Call list_widgets to see available widgets in the dashboard, then retry with the correct identifier.',
  },
  [NcErrorType.ERR_GENERIC_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'The referenced resource does not exist. Double-check the name or ID for typos. Use the appropriate list tool to verify available resources before retrying.',
  },
  [NcErrorType.ERR_RELATION_FIELD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'No link/relation field found with that name. Call describe_table to see all fields and their types — look for Link or LinkToAnotherRecord fields specifically. The relation may use a different field name than expected.',
  },
  [NcErrorType.ERR_BASE_NOT_FOUND]: {
    retriable: false,
    llmHint:
      'The base could not be found. Do not retry — inform the user that the base could not be found.',
  },
  [NcErrorType.ERR_SOURCE_NOT_FOUND]: {
    retriable: false,
    llmHint:
      'The data source could not be found. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_INVALID_FILTER]: {
    retriable: true,
    llmHint:
      'The filter syntax is wrong. Correct format: (FieldTitle,operator,value). Common issues: wrong field name (call describe_table to verify), invalid operator for the field type, or missing parentheses. Rebuild the filter and retry.',
  },
  [NcErrorType.ERR_UNSUPPORTED_FILTER_OPERATION]: {
    retriable: true,
    llmHint:
      'This operator does not work with this field type. For example: "like" only works on text fields, "gt"/"lt" only on numeric/date fields. Call describe_table to check the field type, choose a compatible operator, and retry.',
  },
  [NcErrorType.ERR_REQUIRED_FIELD_MISSING]: {
    retriable: true,
    llmHint:
      'One or more required fields are missing from the request. Call describe_table to identify which fields have required/not-null constraints, include values for all required fields, and retry.',
  },
  [NcErrorType.ERR_INVALID_VALUE_FOR_FIELD]: {
    retriable: true,
    llmHint:
      'The value does not match the expected field type. Call describe_table to check the field type, then fix the value. Common issues: sending text to a number field, wrong date format, invalid select option, or wrong link record format.',
  },
  [NcErrorType.ERR_INVALID_REQUEST_BODY]: {
    retriable: true,
    llmHint:
      'The request body structure is malformed. Review the expected input format for this tool, fix the structure, and retry. Ensure all required properties are present and correctly typed.',
  },
  [NcErrorType.ERR_INVALID_PK_VALUE]: {
    retriable: true,
    llmHint:
      'The primary key value is invalid or in the wrong format. Call query_records to find records with valid primary key values, then retry with a correct ID.',
  },
  [NcErrorType.ERR_INVALID_JSON]: {
    retriable: true,
    llmHint:
      'The JSON input is malformed. Check for: unescaped quotes, trailing commas, missing brackets, or invalid escape sequences. Fix the JSON syntax and retry.',
  },
  [NcErrorType.ERR_DUPLICATE_IN_ALIAS]: {
    retriable: true,
    llmHint:
      'A table, column, or view with this exact name already exists. Choose a different, unique name and retry. You can call the appropriate list tool to see existing names.',
  },
  [NcErrorType.ERR_DUPLICATE_RECORD]: {
    retriable: false,
    llmHint:
      'A record with this data already exists. Do not retry — inform the user about the duplicate.',
  },
  [NcErrorType.FIELD_UNIQUE_CONSTRAINT_VIOLATION]: {
    retriable: false,
    llmHint:
      'This value already exists in a field that requires unique values. Do not retry with the same value — inform the user.',
  },
  [NcErrorType.ERR_COLUMN_ASSOCIATED_WITH_LINK]: {
    retriable: false,
    llmHint:
      'This field cannot be deleted because it is being used by other fields. Do not retry — inform the user that dependent fields must be removed first.',
  },
  [NcErrorType.ERR_TABLE_ASSOCIATED_WITH_LINK]: {
    retriable: false,
    llmHint:
      'This table cannot be deleted because other tables depend on it. Do not retry — inform the user that dependent references must be removed first.',
  },
  [NcErrorType.ERR_UNSUPPORTED_RELATION]: {
    retriable: false,
    llmHint:
      'This operation is not supported for this type of field. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_SYSTEM_FIELD_NON_MODIFIABLE]: {
    retriable: false,
    llmHint:
      'This field is managed automatically and cannot be modified. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_FORBIDDEN]: {
    retriable: false,
    llmHint:
      'The user does not have permission for this action. Do not retry — inform the user they need additional permissions.',
  },
  [NcErrorType.ERR_PERMISSION_DENIED]: {
    retriable: false,
    llmHint:
      'The user does not have permission for this action. Do not retry — inform the user they need additional permissions.',
  },
  [NcErrorType.ERR_INSUFFICIENT_PRIVILEGE]: {
    retriable: false,
    llmHint:
      'The user does not have sufficient permissions. Do not retry — inform the user they need additional permissions.',
  },
  [NcErrorType.ERR_AUTHENTICATION_REQUIRED]: {
    retriable: false,
    llmHint:
      'Authentication is required. Do not retry — inform the user they need to sign in.',
  },
  [NcErrorType.ERR_DATABASE_OP_FAILED]: {
    retriable: false,
    llmHint:
      'The operation could not be completed. Do not retry — inform the user that the operation failed.',
  },
  [NcErrorType.ERR_TABLE_OP_FAILED]: {
    retriable: false,
    llmHint:
      'The table operation could not be completed. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_COLUMN_OP_FAILED]: {
    retriable: false,
    llmHint:
      'The field operation could not be completed. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_BASE_OP_FAILED]: {
    retriable: false,
    llmHint:
      'The operation could not be completed. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_IN_EXTERNAL_DATA_SOURCE]: {
    retriable: false,
    llmHint:
      'An error occurred with the connected data source. Do not retry — inform the user.',
  },
  [NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT]: {
    retriable: true,
    llmHint:
      'The external data source took too long to respond. This is usually transient. Wait a moment and retry the same operation once. If it fails again, inform the user the external source is slow or unavailable.',
  },
  [NcErrorType.ERR_INTERNAL_SERVER]: {
    retriable: false,
    llmHint:
      'Something went wrong. Do not retry — inform the user that something went wrong and suggest trying again later.',
  },
  [NcErrorType.ERR_FORMULA]: {
    retriable: true,
    llmHint:
      'The formula expression has a syntax error. Check for: misspelled function names, wrong argument count, unmatched parentheses, or incorrect field references. Fix the formula and retry.',
  },
  [NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA]: {
    retriable: false,
    llmHint:
      'The formula has a circular reference. Do not retry — inform the user the formula needs to be restructured to avoid the circular dependency.',
  },
  [NcErrorType.ERR_FEATURE_NOT_SUPPORTED]: {
    retriable: false,
    llmHint:
      'This feature is not available on the current plan. Do not retry — inform the user that upgrading their plan is required to use this feature.',
  },
  [NcErrorType.ERR_PLAN_LIMIT_EXCEEDED]: {
    retriable: false,
    llmHint:
      'A usage limit for the current plan has been reached (e.g., max records, max tables, max API calls). Do not retry — inform the user they have hit a plan limit and may need to upgrade.',
  },
  [NcErrorType.ERR_SYNC_TABLE_OPERATION_PROHIBITED]: {
    retriable: false,
    llmHint:
      'This table is synced from an external source and its data is read-only. Inserts, updates, and deletes are not allowed. Do not retry — inform the user that modifications must be made in the original external source.',
  },
};

export function buildToolErrorHint(toolName: string, e: unknown): string {
  if (e instanceof NcBaseErrorv2) {
    const hint = NC_ERROR_HINTS[e.error];
    const msg = truncateMessage(e.message);

    if (hint) {
      const note = hint.retriable
        ? ` (Retriable: ${hint.llmHint})`
        : ` (${hint.llmHint})`;
      return `Tool "${toolName}" failed: ${msg}${note}`;
    }

    return `Tool "${toolName}" failed [${e.error}]: ${msg}`;
  }

  if (e instanceof NcSDKErrorV2) {
    return `Tool "${toolName}" failed: ${truncateMessage(e.message)}`;
  }

  if (e instanceof AjvError) {
    return `Tool "${toolName}" failed: Validation error — ${truncateMessage(
      e.message,
    )}. (Retriable: Check that all required properties are present and values match the expected types.)`;
  }

  if (e instanceof OptionsNotExistsError) {
    return `Tool "${toolName}" failed: Invalid option(s) "${e.options.join(
      ', ',
    )}" for column "${
      e.columnTitle
    }". (Retriable: Call describe_table to see the valid options for this select/multi-select field, then retry with a valid option.)`;
  }

  if (e instanceof UniqueConstraintViolationError) {
    return `Tool "${toolName}" failed: The value for field "${e.fieldName}" must be unique — "${e.value}" already exists.`;
  }

  if (e instanceof Forbidden || e instanceof Unauthorized) {
    return `Tool "${toolName}" failed: Permission denied. Do not retry — the user needs additional permissions.`;
  }

  if (e instanceof NotFound) {
    return `Tool "${toolName}" failed: Not found — ${truncateMessage(
      (e as Error).message,
    )}. (Retriable: Verify the resource name or ID. Use the appropriate list tool to find valid identifiers.)`;
  }

  if (e instanceof BadRequest) {
    return `Tool "${toolName}" failed: Bad request — ${truncateMessage(
      (e as Error).message,
    )}. (Retriable: Review the input parameters, fix the issue described above, and retry.)`;
  }

  if (e instanceof UnprocessableEntity || e instanceof NcSDKError) {
    return `Tool "${toolName}" failed: ${truncateMessage(
      (e as Error).message,
    )}. Review the input and correct the issue before retrying.`;
  }

  if (e instanceof ExternalTimeout) {
    return `Tool "${toolName}" failed: External data source timed out. (Retriable: The external source is slow — wait briefly and retry once. If it fails again, inform the user.)`;
  }

  if (e instanceof ExternalError) {
    return `Tool "${toolName}" failed: An error occurred with the connected data source. Do not retry — inform the user.`;
  }

  if (e instanceof NcBaseError) {
    return `Tool "${toolName}" failed: ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof Error) {
    const dbError = extractDBError(e);
    if (dbError) {
      return `Tool "${toolName}" failed: The operation could not be completed. Do not retry with the same parameters.`;
    }
  }

  const msg = e instanceof Error ? e.message : String(e);
  return `Tool "${toolName}" failed: ${truncateMessage(msg)}`;
}

function truncateMessage(msg: string): string {
  return msg.length > ERROR_HINT_MAX_LENGTH
    ? msg.slice(0, ERROR_HINT_MAX_LENGTH) + '…'
    : msg;
}
