import { expect } from 'chai';
import 'mocha';
import { NcBaseErrorv2, NcErrorType } from 'nocodb-sdk';
import { isTransientError } from '~/helpers/db-error/utils';

function isTransientErrorTests() {
  describe('NcBaseErrorv2 application errors', () => {
    it('should identify ERR_EXTERNAL_DATA_SOURCE_TIMEOUT as transient', () => {
      const error = new NcBaseErrorv2(
        'External data source timeout',
        500,
        NcErrorType.ERR_EXTERNAL_DATA_SOURCE_TIMEOUT,
      );
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify ERR_DATABASE_OP_FAILED as transient', () => {
      const error = new NcBaseErrorv2(
        'Database operation failed',
        500,
        NcErrorType.ERR_DATABASE_OP_FAILED,
      );
      expect(isTransientError(error)).to.be.true;
    });

    it('should not identify ERR_FORMULA as transient', () => {
      const error = new NcBaseErrorv2(
        'Formula error',
        400,
        NcErrorType.ERR_FORMULA,
      );
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify ERR_CIRCULAR_REF_IN_FORMULA as transient', () => {
      const error = new NcBaseErrorv2(
        'Circular reference detected',
        400,
        NcErrorType.ERR_CIRCULAR_REF_IN_FORMULA,
      );
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('Network-level connection errors', () => {
    const networkErrors = [
      { code: 'ECONNREFUSED', description: 'Connection refused' },
      { code: 'ETIMEDOUT', description: 'Connection timeout' },
      { code: 'ENOTFOUND', description: 'DNS lookup failed' },
      { code: 'ECONNRESET', description: 'Connection reset by peer' },
      { code: 'EHOSTUNREACH', description: 'Host unreachable' },
      { code: 'EAI_AGAIN', description: 'DNS temporary failure' },
      { code: 'EPIPE', description: 'Broken pipe' },
      { code: 'ENETUNREACH', description: 'Network unreachable' },
      { code: 'ECONNABORTED', description: 'Connection aborted' },
      { code: 'EHOSTDOWN', description: 'Host is down' },
    ];

    networkErrors.forEach(({ code, description }) => {
      it(`should identify ${code} (${description}) as transient`, () => {
        const error = { code, message: description };
        expect(isTransientError(error)).to.be.true;
      });
    });

    it('should not identify ENOENT (file not found) as transient', () => {
      const error = { code: 'ENOENT', message: 'File not found' };
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('PostgreSQL errors', () => {
    it('should identify Class 08 connection errors as transient', () => {
      const connectionCodes = [
        '08000', // connection_exception
        '08001', // sqlclient_unable_to_establish_sqlconnection
        '08003', // connection_does_not_exist
        '08004', // sqlserver_rejected_establishment_of_sqlconnection
        '08006', // connection_failure
        '08007', // transaction_resolution_unknown
        '08P01', // protocol_violation
      ];

      connectionCodes.forEach((code) => {
        const error = { code, message: 'PostgreSQL connection error' };
        expect(isTransientError(error)).to.be.true;
      });
    });

    it('should identify query canceled (57014) as transient', () => {
      const error = { code: '57014', message: 'Query canceled' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify admin shutdown (57P01) as transient', () => {
      const error = { code: '57P01', message: 'Admin shutdown' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify idle session timeout (57P02) as transient', () => {
      const error = { code: '57P02', message: 'Idle session timeout' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify cannot connect now (57P03) as transient', () => {
      const error = { code: '57P03', message: 'Cannot connect now' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify too many connections (53300) as transient', () => {
      const error = { code: '53300', message: 'Too many connections' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should not identify syntax error (42601) as transient', () => {
      const error = { code: '42601', message: 'Syntax error' };
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify unique violation (23505) as transient', () => {
      const error = {
        code: '23505',
        message: 'Unique constraint violation',
      };
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('MySQL/MariaDB errors', () => {
    const mysqlErrors = [
      { code: 'ER_LOCK_WAIT_TIMEOUT', description: 'Lock wait timeout' },
      { code: 'ER_CON_COUNT_ERROR', description: 'Too many connections' },
      {
        code: 'ER_TOO_MANY_USER_CONNECTIONS',
        description: 'Too many user connections',
      },
      {
        code: 'ER_CONNECTION_COUNT_ERROR',
        description: 'Connection count error',
      },
      { code: 'CR_CONNECTION_ERROR', description: "Can't connect to server" },
      { code: 'CR_CONN_HOST_ERROR', description: "Can't connect to host" },
    ];

    mysqlErrors.forEach(({ code, description }) => {
      it(`should identify ${code} (${description}) as transient`, () => {
        const error = { code, message: description };
        expect(isTransientError(error)).to.be.true;
      });
    });

    it('should not identify ER_DUP_ENTRY as transient', () => {
      const error = { code: 'ER_DUP_ENTRY', message: 'Duplicate entry' };
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify ER_BAD_FIELD_ERROR as transient', () => {
      const error = {
        code: 'ER_BAD_FIELD_ERROR',
        message: 'Unknown column',
      };
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('SQLite errors', () => {
    it('should identify SQLITE_BUSY as transient', () => {
      const error = { code: 'SQLITE_BUSY', message: 'Database is locked' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify SQLITE_LOCKED as transient', () => {
      const error = { code: 'SQLITE_LOCKED', message: 'Table is locked' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should not identify SQLITE_CONSTRAINT as transient', () => {
      const error = {
        code: 'SQLITE_CONSTRAINT',
        message: 'Constraint violation',
      };
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('File system errors', () => {
    it('should identify EACCES (permission denied) as transient', () => {
      const error = { code: 'EACCES', message: 'Permission denied' };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify EROFS (read-only file system) as transient', () => {
      const error = {
        code: 'EROFS',
        message: 'Read-only file system',
      };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify ENOSPC (no space left) as transient', () => {
      const error = { code: 'ENOSPC', message: 'No space left on device' };
      expect(isTransientError(error)).to.be.true;
    });
  });

  describe('Message-based pattern matching', () => {
    const transientPatterns = [
      'connection refused by server',
      'connection timeout occurred',
      'connection timed out after 30s',
      'connection reset by peer',
      'connection error: unable to reach host',
      'connection failed to establish',
      'network is unreachable at this time',
      'no route to host available',
      'too many connections to database',
      'database is locked by another process',
      'cannot connect to database server',
      'unable to connect to the server',
      'lost connection to mysql server',
      'connection was killed by administrator',
    ];

    transientPatterns.forEach((message) => {
      it(`should identify message "${message}" as transient`, () => {
        const error = { message };
        expect(isTransientError(error)).to.be.true;
      });
    });

    it('should not identify short messages (< 20 chars) even with keywords', () => {
      const error = { message: 'connection error' }; // 16 chars
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify validation errors as transient', () => {
      const error = {
        message: 'Validation failed: email must be a valid email address',
      };
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify formula errors as transient', () => {
      const error = {
        message: 'Formula error: invalid function INVALID_FUNC()',
      };
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify syntax errors as transient', () => {
      const error = {
        message: 'Syntax error: unexpected token at line 5',
      };
      expect(isTransientError(error)).to.be.false;
    });
  });

  describe('Edge cases', () => {
    it('should return false for null error', () => {
      expect(isTransientError(null)).to.be.false;
    });

    it('should return false for undefined error', () => {
      expect(isTransientError(undefined)).to.be.false;
    });

    it('should return false for empty object', () => {
      expect(isTransientError({})).to.be.false;
    });

    it('should return false for error with only message (no code)', () => {
      const error = { message: 'Some generic error' };
      expect(isTransientError(error)).to.be.false;
    });

    it('should handle error objects without message property', () => {
      const error = { code: 'UNKNOWN_CODE' };
      expect(isTransientError(error)).to.be.false;
    });

    it('should handle string errors', () => {
      expect(isTransientError('connection timeout error occurred here')).to.be
        .true;
    });

    it('should handle Error instances', () => {
      const error = new Error('connection timeout occurred');
      expect(isTransientError(error)).to.be.true;
    });
  });

  describe('Real-world error scenarios', () => {
    it('should identify AWS RDS connection timeout', () => {
      const error = {
        code: 'ETIMEDOUT',
        message: 'connect ETIMEDOUT 10.0.1.123:5432',
      };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify connection pool exhausted', () => {
      const error = {
        code: '53300',
        message:
          'FATAL: remaining connection slots are reserved for non-replication superuser connections',
      };
      expect(isTransientError(error)).to.be.true;
    });

    it('should identify network partition', () => {
      const error = {
        code: 'EHOSTUNREACH',
        message: 'connect EHOSTUNREACH 192.168.1.100:3306',
      };
      expect(isTransientError(error)).to.be.true;
    });

    it('should not identify foreign key constraint violation', () => {
      const error = {
        code: '23503',
        message:
          'insert or update on table "orders" violates foreign key constraint',
      };
      expect(isTransientError(error)).to.be.false;
    });

    it('should not identify division by zero error', () => {
      const error = {
        code: '22012',
        message: 'division by zero in formula calculation',
      };
      expect(isTransientError(error)).to.be.false;
    });

    it('should identify Docker container restart connection loss', () => {
      const error = {
        code: 'ECONNRESET',
        message: 'read ECONNRESET - connection lost during query execution',
      };
      expect(isTransientError(error)).to.be.true;
    });
  });
}

export function isTransientErrorTest() {
  describe('IsTransientErrorTest', isTransientErrorTests);
}
