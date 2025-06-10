import type { TAliasToColumn } from './formulav2/formula-query-builder.types';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import type { Model } from '~/models';
import mysql from '~/db/functionMappings/mysql';
import pg from '~/db/functionMappings/pg';
import sqlite from '~/db/functionMappings/sqlite';
import databricks from '~/db/functionMappings/databricks';

export interface MapFnArgs {
  pt: any;
  aliasToCol: TAliasToColumn;
  knex: XKnex;
  fn: (...args: any) => Promise<{ builder: Knex.QueryBuilder | any }>;
  prevBinaryOp?: any;
  model: Model;
}

const mapFunctionName = async (args: MapFnArgs): Promise<any> => {
  const name = args.pt.callee.name.toUpperCase();
  let val;

  switch (args.knex.clientType()) {
    case 'mysql':
    case 'mysql2':
    case 'maridb':
      val = mysql[name] || name;
      break;
    case 'pg':
    case 'postgre':
      val = pg[name] || name;
      break;
    case 'sqlite':
    case 'sqlite3':
      val = sqlite[name] || name;
      break;
    case 'databricks':
      val = databricks[name] || name;
      break;
  }

  if (typeof val === 'function') {
    return val(args);
  } else if (typeof val === 'string') {
    args.pt.callee.name = val;
  }
};

export default mapFunctionName;
