import UITypes from "../UITypes";

import { MssqlUi } from './MssqlUi';
import { MysqlUi } from './MysqlUi';
import { OracleUi } from './OracleUi';
import { PgUi } from './PgUi';
import { SqliteUi } from './SqliteUi';

// import {YugabyteUi} from "./YugabyteUi";
// import {TidbUi} from "./TidbUi";
// import {VitessUi} from "./VitessUi";

export class SqlUiFactory {
  static create(connectionConfig) {
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

      console.log('- - - -In Mysql UI');

      return MysqlUi;
    }

    if (connectionConfig.client === 'sqlite3') {
      return SqliteUi;
    }
    if (connectionConfig.client === 'mssql') {
      return MssqlUi;
    }
    if (connectionConfig.client === 'oracledb') {
      return OracleUi;
    }

    if (connectionConfig.client === 'pg') {
      // if (connectionConfig.meta.dbtype === "yugabyte")
      //   return Yugabyte;
      return PgUi;
    }

    throw new Error('Database not supported');
  }
}

export type SqlUIColumn = {
  cn?: string;
  dt?: string;
  dtx?: string;
  ct?: string;
  nrqd?: boolean;
  rqd?: boolean;
  ck?: string;
  pk?: boolean;
  un?: boolean;
  ai?: boolean;
  cdf?: string | any;
  clen?: number | any;
  np?: string;
  ns?: string;
  dtxp?: string;
  dtxs?: string;
  uidt?: UITypes;
  uip?: string;
  uicn?: string;
  altered?:number;
};
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
