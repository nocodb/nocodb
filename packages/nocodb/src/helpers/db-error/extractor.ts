import { ClientType } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type {
  DBErrorExtractResult,
  IClientDbErrorExtractor,
} from '~/helpers/db-error/utils';
import { PgDBErrorExtractor } from '~/helpers/db-error/pg.extractor';
import { SqliteDBErrorExtractor } from '~/helpers/db-error/sqlite.extractor';
import { MysqlDBErrorExtractor } from '~/helpers/db-error/mysql.extractor';
import { MssqlDBErrorExtractor } from '~/helpers/db-error/mssql.extractor';
import { OracleDBErrorExtractor } from '~/helpers/db-error/oracle.extractor';
import { DefaultDBErrorExtractor } from '~/helpers/db-error/default.extractor';

export class DBErrorExtractor {
  constructor() {}
  static _: DBErrorExtractor = new DBErrorExtractor();
  static get() {
    return DBErrorExtractor._;
  }
  logger = new Logger('MissingDBError');
  extractors = new Map<ClientType, IClientDbErrorExtractor>([
    [
      ClientType.PG,
      new PgDBErrorExtractor({
        dbErrorLogger: this.logger,
      }),
    ],
    [
      ClientType.SQLITE,
      new SqliteDBErrorExtractor({
        dbErrorLogger: this.logger,
      }),
    ],
    [
      ClientType.MYSQL,
      new MysqlDBErrorExtractor({
        dbErrorLogger: this.logger,
      }),
    ],
    [
      ClientType.MSSQL,
      new MssqlDBErrorExtractor({
        dbErrorLogger: this.logger,
      }),
    ],
    [
      ClientType.ORACLE,
      new OracleDBErrorExtractor({
        dbErrorLogger: this.logger,
      }),
    ],
  ]);
  defaultExtractor = new DefaultDBErrorExtractor({
    dbErrorLogger: this.logger,
  });

  private detectClientType(error: any): ClientType | null {
    if (error?.code) {
      const code = String(error.code);

      // MySQL: errors start with ER_
      if (code.startsWith('ER_')) return ClientType.MYSQL;

      // Oracle: server errors are ORA-xxxxx, node-oracledb driver errors
      // are NJS-xxx (connection failures — raised before any SQL runs)
      if (code.startsWith('ORA-') || code.startsWith('NJS-'))
        return ClientType.ORACLE;

      // PostgreSQL: 5-character SQLSTATE codes
      if (/^[0-9A-Z]{5}$/.test(code)) return ClientType.PG;

      // SQLite: errors start with SQLITE_
      if (code.startsWith('SQLITE_')) return ClientType.SQLITE;

      // MSSQL: tedious driver-level codes. tedious sets one of these on EVERY
      // error — including the wrapper around a server-side error — so this
      // also catches MSSQL server errors (which additionally carry `number`).
      if (
        [
          'ELOGIN',
          'ETIMEOUT',
          'ESOCKET',
          'EREQUEST',
          'EABORT',
          'ECANCEL',
          'EINVALIDSTATE',
        ].includes(code)
      ) {
        return ClientType.MSSQL;
      }
    }

    if (typeof error?.number === 'number') return ClientType.MSSQL;

    // node-oracledb sets `errorNum` on every server-side error
    if (typeof error?.errorNum === 'number') return ClientType.ORACLE;

    return null;
  }

  extractDbError(
    error: any,
    option?: { clientType?: ClientType; ignoreDefault?: boolean },
  ) {
    const clientType = option?.clientType ?? this.detectClientType(error);

    let extractResult: DBErrorExtractResult;

    if (clientType) {
      extractResult = this.extractors.get(clientType)?.extract(error);
    } else {
      [
        ClientType.PG,
        ClientType.MYSQL,
        ClientType.SQLITE,
        ClientType.MSSQL,
        ClientType.ORACLE,
      ].forEach((ct) => {
        if (!extractResult) {
          extractResult = this.extractors.get(ct)?.extract(error);
        }
      });
    }

    if (!extractResult && !option?.ignoreDefault) {
      extractResult = this.defaultExtractor.extract(error);
    }

    return extractResult;
  }
}
