import { BoolType } from '../Api';
import UITypes from '../UITypes';

import { MysqlUi } from './MysqlUi';
import { OracleUi } from './OracleUi';
import { PgUi } from './PgUi';
import { SqliteUi } from './SqliteUi';
import { SnowflakeUi } from './SnowflakeUi';
import { DatabricksUi } from './DatabricksUi';
import { SqlUi } from './SqlUI.types';

// import {YugabyteUi} from "./YugabyteUi";
// import {TidbUi} from "./TidbUi";
// import {VitessUi} from "./VitessUi";

export class SqlUiFactory {
  static create(connectionConfig): SqlUi {
    // connectionConfig.meta = connectionConfig.meta || {};
    // connectionConfig.meta.dbtype = connectionConfig.meta.dbtype || "";
    if (
      connectionConfig.client === 'mysql' ||
      connectionConfig.client === 'mysql2'
    ) {
      // if (connectionConfig.meta.dbtype === "tidb")
      //   return Tidb;
      // if (connectionConfig.meta.dbtype === "vitess")
      //   return Vitess;

      return new MysqlUi();
    }

    if (connectionConfig.client === 'sqlite3') {
      return new SqliteUi();
    }
    if (connectionConfig.client === 'oracledb') {
      return new OracleUi();
    }

    if (connectionConfig.client === 'pg') {
      // if (connectionConfig.meta.dbtype === "yugabyte")
      //   return Yugabyte;
      return new PgUi();
    }

    if (connectionConfig.client === 'snowflake') {
      return new SnowflakeUi();
    }

    if (connectionConfig.client === 'databricks') {
      return new DatabricksUi();
    }

    throw new Error('Database not supported');
  }
}

export type SqlUIColumn = {
  cn?: string;
  dt?: string;
  dtx?: string;
  ct?: string;
  nrqd?: BoolType;
  rqd?: BoolType;
  ck?: string;
  pk?: BoolType;
  un?: BoolType;
  ai?: BoolType;
  cdf?: string | any;
  clen?: number | any;
  np?: string;
  ns?: string;
  dtxp?: string;
  dtxs?: string;
  uidt?: UITypes;
  uip?: string;
  uicn?: string;
  altered?: number;
};
