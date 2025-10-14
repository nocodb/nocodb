import { ClientType } from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import { PgDBErrorExtractor } from './pg.extractor';
import { SqliteDBErrorExtractor } from './sqlite.extractor';
import { MysqlDBErrorExtractor } from './mysql.extractor';
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
  ]);
  defaultExtractor = new DefaultDBErrorExtractor({
    dbErrorLogger: this.logger,
  });

  extractDbError(
    error: any,
    option?: { clientType?: ClientType; ignoreDefault?: boolean },
  ) {
    const clientType = option?.clientType;
    let extractResult: DBErrorExtractResult;
    if (clientType) {
      extractResult = this.extractors.get(clientType)?.extract(error);
    } else {
      [ClientType.PG, ClientType.MYSQL, ClientType.SQLITE].forEach(
        (clientType) => {
          if (!extractResult) {
            extractResult = this.extractors.get(clientType)?.extract(error);
          }
        },
      );
    }
    if (!extractResult && !option?.ignoreDefault) {
      extractResult = this.defaultExtractor.extract(error);
    }
    return extractResult;
  }
}
