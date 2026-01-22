import { NcBaseErrorv2, NcErrorType } from 'nocodb-sdk';

export type DBErrorExtractResult =
  | {
      message: string;
      error: string;
      details?: any;
      code?: string;
      httpStatus: number;
    }
  | undefined;
export interface IClientDbErrorExtractor {
  extract(error: any): DBErrorExtractResult;
}

export enum DBError {
  TABLE_EXIST = 'TABLE_EXIST',
  TABLE_NOT_EXIST = 'TABLE_NOT_EXIST',
  COLUMN_EXIST = 'COLUMN_EXIST',
  COLUMN_NOT_EXIST = 'COLUMN_NOT_EXIST',
  CONSTRAINT_EXIST = 'CONSTRAINT_EXIST',
  CONSTRAINT_NOT_EXIST = 'CONSTRAINT_NOT_EXIST',
  COLUMN_NOT_NULL = 'COLUMN_NOT_NULL',
  DATA_TYPE_MISMATCH = 'DATA_TYPE_MISMATCH',
  UNIQUE_CONSTRAINT_VIOLATION = 'UNIQUE_CONSTRAINT_VIOLATION',
}

/**
 * Determines if an error is transient (connection/infrastructure issue)
 * rather than a permanent validation/logic error.
 *
 * Transient errors include:
 * - Connection failures (ECONNREFUSED, ETIMEDOUT, etc.)
 * - Database timeouts
 * - Network issues
 * - Temporary DNS failures
 *
 * These errors should NOT mark formulas/queries as permanently invalid.
 */
export function isTransientError(error: any): boolean {
  // Check for NcBaseErrorv2 with specific transient error types
  if (error instanceof NcBaseErrorv2) {
    const transientErrorTypes = [
      NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT,
      NcErrorType.ERR_DATABASE_OP_FAILED,
    ];
    if (transientErrorTypes.includes(error.error)) {
      return true;
    }
  }

  // Check for common connection error codes
  const connectionErrorCodes = [
    'ECONNREFUSED', // Connection refused
    'ETIMEDOUT', // Connection timeout
    'ENOTFOUND', // DNS lookup failed
    'ECONNRESET', // Connection reset
    'EHOSTUNREACH', // Host unreachable
    'EAI_AGAIN', // DNS temporary failure
    'EPIPE', // Broken pipe
    'ENETUNREACH', // Network unreachable
  ];

  if (error?.code && connectionErrorCodes.includes(error.code)) {
    return true;
  }

  // Check for database-specific timeout/connection errors
  if (error?.code) {
    const code = String(error.code);
    // PostgreSQL connection errors (Class 08 - Connection Exception)
    if (code.startsWith('08')) return true;
    // PostgreSQL timeout errors
    if (['40P01', '57014', '57P01'].includes(code)) return true;
    // PostgreSQL too many connections
    if (code === '53300') return true;
    // MySQL connection/timeout errors
    if (
      [
        'ER_LOCK_WAIT_TIMEOUT',
        'ER_CON_COUNT_ERROR',
        'ER_TOO_MANY_USER_CONNECTIONS',
      ].includes(code)
    ) {
      return true;
    }
  }

  // Check error message for connection-related keywords
  const errorMessage = error?.message?.toLowerCase() || '';
  const connectionKeywords = [
    'connection',
    'timeout',
    'timed out',
    'unreachable',
    'network',
    'econnrefused',
    'etimedout',
  ];

  if (connectionKeywords.some((keyword) => errorMessage.includes(keyword))) {
    return true;
  }

  return false;
}
