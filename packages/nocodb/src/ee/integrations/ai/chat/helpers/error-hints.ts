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
      'Check table name spelling. Use list_tables to see available tables.',
  },
  [NcErrorType.ERR_FIELD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'Check field name spelling. Use describe_table to see available fields.',
  },
  [NcErrorType.ERR_VIEW_NOT_FOUND]: {
    retriable: true,
    llmHint: 'Check view name. Use list_views to see available views.',
  },
  [NcErrorType.ERR_VIEW_COLUMN_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'View column not found. Use list_view_fields to see available fields.',
  },
  [NcErrorType.ERR_RECORD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'Record ID may be wrong. Use query_records to find the correct ID.',
  },
  [NcErrorType.ERR_DASHBOARD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'Check dashboard name. Use list_dashboards to see available dashboards.',
  },
  [NcErrorType.ERR_WIDGET_NOT_FOUND]: {
    retriable: true,
    llmHint: 'Check widget name. Use list_widgets to see available widgets.',
  },
  [NcErrorType.ERR_GENERIC_NOT_FOUND]: {
    retriable: true,
    llmHint: 'Resource not found. Verify the name or ID.',
  },
  [NcErrorType.ERR_RELATION_FIELD_NOT_FOUND]: {
    retriable: true,
    llmHint:
      'Relation field not found. Use describe_table to check link fields.',
  },
  [NcErrorType.ERR_BASE_NOT_FOUND]: {
    retriable: false,
    llmHint: 'Base not found. The current base context may be invalid.',
  },
  [NcErrorType.ERR_SOURCE_NOT_FOUND]: {
    retriable: false,
    llmHint: 'Data source not found.',
  },
  [NcErrorType.ERR_INVALID_FILTER]: {
    retriable: true,
    llmHint:
      'Check filter syntax: (FieldTitle,operator,value). Verify field name and operator.',
  },
  [NcErrorType.ERR_UNSUPPORTED_FILTER_OPERATION]: {
    retriable: true,
    llmHint:
      'This filter operator is not supported for this field type. Try a different operator.',
  },
  [NcErrorType.ERR_REQUIRED_FIELD_MISSING]: {
    retriable: true,
    llmHint:
      'A required field is missing. Use describe_table to check required fields.',
  },
  [NcErrorType.ERR_INVALID_VALUE_FOR_FIELD]: {
    retriable: true,
    llmHint:
      'Value type mismatch. Check field type with describe_table and adjust the value.',
  },
  [NcErrorType.ERR_INVALID_REQUEST_BODY]: {
    retriable: true,
    llmHint: 'Invalid request body. Check the input format.',
  },
  [NcErrorType.ERR_INVALID_PK_VALUE]: {
    retriable: true,
    llmHint: 'Invalid primary key value. Use query_records to find valid IDs.',
  },
  [NcErrorType.ERR_INVALID_JSON]: {
    retriable: true,
    llmHint: 'Malformed JSON in input. Fix the JSON syntax.',
  },
  [NcErrorType.ERR_DUPLICATE_IN_ALIAS]: {
    retriable: true,
    llmHint:
      'A table/column/view with this name already exists. Use a different name.',
  },
  [NcErrorType.ERR_DUPLICATE_RECORD]: {
    retriable: false,
    llmHint: 'A record with this data already exists.',
  },
  [NcErrorType.FIELD_UNIQUE_CONSTRAINT_VIOLATION]: {
    retriable: false,
    llmHint:
      'Unique constraint violation — a record with this value already exists.',
  },
  [NcErrorType.ERR_COLUMN_ASSOCIATED_WITH_LINK]: {
    retriable: false,
    llmHint: 'Cannot delete — column is part of a table relationship.',
  },
  [NcErrorType.ERR_TABLE_ASSOCIATED_WITH_LINK]: {
    retriable: false,
    llmHint:
      'Cannot delete — table has active relationships. Remove links first.',
  },
  [NcErrorType.ERR_UNSUPPORTED_RELATION]: {
    retriable: false,
    llmHint: 'This relation type is not supported for this operation.',
  },
  [NcErrorType.ERR_SYSTEM_FIELD_NON_MODIFIABLE]: {
    retriable: false,
    llmHint: 'System fields cannot be modified.',
  },
  [NcErrorType.ERR_FORBIDDEN]: {
    retriable: false,
    llmHint: 'User lacks permission for this operation.',
  },
  [NcErrorType.ERR_PERMISSION_DENIED]: {
    retriable: false,
    llmHint: 'User lacks permission for this operation.',
  },
  [NcErrorType.ERR_INSUFFICIENT_PRIVILEGE]: {
    retriable: false,
    llmHint: 'User lacks sufficient privileges for this operation.',
  },
  [NcErrorType.ERR_AUTHENTICATION_REQUIRED]: {
    retriable: false,
    llmHint: 'Authentication required.',
  },
  [NcErrorType.ERR_DATABASE_OP_FAILED]: {
    retriable: false,
    llmHint: 'Database operation failed. The data may not be compatible.',
  },
  [NcErrorType.ERR_TABLE_OP_FAILED]: {
    retriable: false,
    llmHint: 'Table operation failed.',
  },
  [NcErrorType.ERR_COLUMN_OP_FAILED]: {
    retriable: false,
    llmHint: 'Column operation failed.',
  },
  [NcErrorType.ERR_BASE_OP_FAILED]: {
    retriable: false,
    llmHint: 'Base operation failed.',
  },
  [NcErrorType.ERR_IN_EXTERNAL_DATA_SOURCE]: {
    retriable: false,
    llmHint: 'External data source error.',
  },
  [NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT]: {
    retriable: true,
    llmHint: 'External data source timed out. Try again.',
  },
  [NcErrorType.ERR_INTERNAL_SERVER]: {
    retriable: false,
    llmHint: 'Internal server error.',
  },
  [NcErrorType.ERR_FORMULA]: {
    retriable: true,
    llmHint: 'Formula syntax error. Check the formula expression.',
  },
  [NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA]: {
    retriable: false,
    llmHint: 'Circular reference in formula. Restructure the formula.',
  },
  [NcErrorType.ERR_FEATURE_NOT_SUPPORTED]: {
    retriable: false,
    llmHint: 'This feature requires a higher plan.',
  },
  [NcErrorType.ERR_PLAN_LIMIT_EXCEEDED]: {
    retriable: false,
    llmHint: 'Plan limit exceeded.',
  },
  [NcErrorType.ERR_SYNC_TABLE_OPERATION_PROHIBITED]: {
    retriable: false,
    llmHint:
      'This table is synced from an external source — data modifications are not allowed.',
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
    )}`;
  }

  if (e instanceof OptionsNotExistsError) {
    return `Tool "${toolName}" failed: Invalid option(s) "${e.options.join(
      ', ',
    )}" for column "${
      e.columnTitle
    }". (Retriable: Use describe_table to see valid options.)`;
  }

  if (e instanceof UniqueConstraintViolationError) {
    return `Tool "${toolName}" failed: Unique constraint violation on field "${e.fieldName}" with value "${e.value}".`;
  }

  if (e instanceof Forbidden || e instanceof Unauthorized) {
    return `Tool "${toolName}" failed: Permission denied — ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof NotFound) {
    return `Tool "${toolName}" failed: Not found — ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof BadRequest) {
    return `Tool "${toolName}" failed: Bad request — ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof UnprocessableEntity || e instanceof NcSDKError) {
    return `Tool "${toolName}" failed: ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof ExternalTimeout) {
    return `Tool "${toolName}" failed: External data source timed out. (Retriable: Try again.)`;
  }

  if (e instanceof ExternalError) {
    return `Tool "${toolName}" failed: External data source error.`;
  }

  if (e instanceof NcBaseError) {
    return `Tool "${toolName}" failed: ${truncateMessage(
      (e as Error).message,
    )}`;
  }

  if (e instanceof Error) {
    const dbError = extractDBError(e);
    if (dbError) {
      return `Tool "${toolName}" failed: Database error — ${truncateMessage(
        dbError.message,
      )}`;
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
