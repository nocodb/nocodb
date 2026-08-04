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

    // MSSQL / tedious driver-level transport errors. `EREQUEST` is
    // omitted intentionally — it wraps server errors that include
    // permanent ones (e.g. constraint violations) where retry is wrong.
    if (
      ['ETIMEOUT', 'ESOCKET', 'EABORT', 'ECANCEL', 'EINVALIDSTATE'].includes(
        code,
      )
    ) {
      return true;
    }

    // File system errors (relevant for SQLite and file-based operations)
    if (['EACCES', 'EROFS', 'ENOSPC'].includes(code)) return true;

    // Oracle — node-oracledb driver-level connection failures (NJS-xxx,
    // raised before any SQL runs). NJS-518 (service not registered) is
    // included: it fires while the DB/PDB is starting up or restarting.
    if (
      [
        'NJS-500', // connection pool closed
        'NJS-501', // connection to host terminated
        'NJS-503', // connection could not be established (ECONNREFUSED)
        'NJS-510', // connection establishment timed out
        'NJS-511', // connection to listener refused
        'NJS-518', // service is not registered with the listener
        'NJS-521', // connection closed by host
      ].includes(code)
    ) {
      return true;
    }

    // Oracle server-side transient errors — connection/instance
    // availability, session limits, and lock/deadlock contention.
    const oraNum = code.match(/^ORA-(\d+)$/)
      ? Number(code.slice(4))
      : undefined;
    if (oraNum !== undefined) {
      const oracleTransientNums = new Set([
        18, // maximum number of sessions exceeded
        28, // your session has been killed
        54, // resource busy and acquire with NOWAIT specified
        60, // deadlock detected while waiting for resource
        1033, // ORACLE initialization or shutdown in progress
        1034, // ORACLE not available
        2049, // distributed lock timeout
        3113, // end-of-file on communication channel
        3114, // not connected to ORACLE
        4021, // timeout occurred while waiting to lock object
        30006, // resource busy; acquire with WAIT timeout expired
        12170, // TNS: connect timeout occurred
        12514, // listener does not currently know of service
        12537, // TNS: connection closed
        12541, // TNS: no listener
      ]);
      if (oracleTransientNums.has(oraNum)) return true;
    }
  }

  // node-oracledb marks errors where a retry on a fresh connection may
  // succeed (instance failover, killed session) with `isRecoverable`.
  if (error?.isRecoverable === true) return true;

  // MSSQL server-side transient error numbers — deadlock / lock timeout,
  // snapshot-isolation conflicts, DB-in-transition, and the Azure SQL
  // "service busy / session killed" family.
  if (typeof error?.number === 'number') {
    const mssqlTransientNumbers = new Set([
      952, // Database is in transition
      1205, // Transaction was deadlocked
      1222, // Lock request time-out exceeded
      3960, // Snapshot isolation transaction aborted (serialization conflict)
      40197, // Service has encountered an error processing your request
      40501, // Service is currently busy
      40613, // Database is unavailable (Azure SQL)
      49918, // Cannot process request — too many operations in progress
      49919, // Cannot process create or update request
      49920, // Cannot process request — too many operations
    ]);
    if (mssqlTransientNumbers.has(error.number)) return true;
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
