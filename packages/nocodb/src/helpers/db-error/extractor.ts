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
    // MSSQL — tedious sets `error.number` (numeric SQL Server error number)
    // on every server-side error. This is unique to MSSQL among the
    // dialects we support, so it's the strongest signal.
    if (typeof error?.number === 'number') return ClientType.MSSQL;

    if (!error?.code) return null;

    const code = String(error.code);

    // MySQL: errors start with ER_
    if (code.startsWith('ER_')) return ClientType.MYSQL;

    // PostgreSQL: 5-character SQLSTATE codes
    if (/^[0-9A-Z]{5}$/.test(code)) return ClientType.PG;

    // SQLite: errors start with SQLITE_
    if (code.startsWith('SQLITE_')) return ClientType.SQLITE;

    // MSSQL: tedious driver-level codes (when there's no `error.number`,
    // i.e. transport-layer errors like login / timeout / socket).
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
