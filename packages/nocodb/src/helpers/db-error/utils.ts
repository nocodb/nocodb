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
 * - Database timeouts (query timeout, connection pool exhaustion)
 * - Network issues (DNS failures, unreachable hosts)
 * - Temporary resource constraints (too many connections, locks)
 *
 * These errors should NOT mark formulas/queries as permanently invalid.
 */
export function isTransientError(error: any): boolean {
  // 1. Check for NcBaseErrorv2 with specific transient error types
  if (error instanceof NcBaseErrorv2) {
    const transientErrorTypes = [
      NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT,
      NcErrorType.ERR_DATABASE_OP_FAILED,
    ];
    if (transientErrorTypes.includes(error.error)) {
      return true;
    }
  }

  // 2. Check for common network-level connection error codes
  const connectionErrorCodes = [
    'ECONNREFUSED', // Connection refused
    'ETIMEDOUT', // Connection timeout
    'ENOTFOUND', // DNS lookup failed
    'ECONNRESET', // Connection reset by peer
    'EHOSTUNREACH', // Host unreachable
    'EAI_AGAIN', // DNS temporary failure
    'EPIPE', // Broken pipe
    'ENETUNREACH', // Network unreachable
    'ECONNABORTED', // Connection aborted
    'EHOSTDOWN', // Host is down
  ];

  if (error?.code && connectionErrorCodes.includes(error.code)) {
    return true;
  }

  // 3. Check for database-specific timeout/connection errors
  if (error?.code) {
    const code = String(error.code);

    // PostgreSQL errors
    if (code.startsWith('08')) return true; // Class 08: Connection Exception
    if (['57014', '57P01', '57P02', '57P03'].includes(code)) return true; // Query canceled, shutdown, idle timeout
    if (code === '53300') return true; // Too many connections

    // MySQL/MariaDB errors
    if (
      [
        'ER_LOCK_WAIT_TIMEOUT',
        'ER_CON_COUNT_ERROR',
        'ER_TOO_MANY_USER_CONNECTIONS',
        'ER_CONNECTION_COUNT_ERROR',
        'CR_CONNECTION_ERROR',
        'CR_CONN_HOST_ERROR',
      ].includes(code)
    ) {
      return true;
    }

    // SQLite errors
    if (['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(code)) return true;

    // File system errors (relevant for SQLite and file-based operations)
    if (['EACCES', 'EROFS', 'ENOSPC'].includes(code)) return true;
  }

  // 4. Check error message for specific connection-related patterns
  // Note: Using specific phrases to minimize false positives
  // Handle both error objects with .message property and plain strings
  const errorMessage = (
    typeof error === 'string' ? error : error?.message || ''
  ).toLowerCase();

  // Only check messages with reasonable length to avoid matching generic errors
  if (errorMessage.length > 20) {
    const specificPatterns = [
      'connection refused',
      'connection timeout',
      'connection timed out',
      'connection reset',
      'connection error',
      'connection failed',
      'network is unreachable',
      'no route to host',
      'too many connections',
      'database is locked',
      'cannot connect',
      'unable to connect',
      'lost connection',
      'connection was killed',
      'timeout acquiring a connection', // Knex connection pool timeout
    ];

    if (specificPatterns.some((pattern) => errorMessage.includes(pattern))) {
      return true;
    }
  }

  return false;
}
