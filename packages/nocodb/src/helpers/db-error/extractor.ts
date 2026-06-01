import { ClientType } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { PgDBErrorExtractor } from './pg.extractor';
import { SqliteDBErrorExtractor } from './sqlite.extractor';
import { MysqlDBErrorExtractor } from './mysql.extractor';
import { MssqlDBErrorExtractor } from './mssql.extractor';
import { DefaultDBErrorExtractor } from './default.extractor';
import type { DBErrorExtractResult, IClientDbErrorExtractor } from './utils';

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
  ]);
  defaultExtractor = new DefaultDBErrorExtractor({
    dbErrorLogger: this.logger,
  });

  private detectClientType(error: any): ClientType | null {
    if (error?.code) {
      const code = String(error.code);

      // MySQL: errors start with ER_
      if (code.startsWith('ER_')) return ClientType.MYSQL;

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
