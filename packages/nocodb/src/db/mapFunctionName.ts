import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import mssql from '~/db/functionMappings/mssql';
import mysql from '~/db/functionMappings/mysql';
import pg from '~/db/functionMappings/pg';
import sqlite from '~/db/functionMappings/sqlite';

export interface MapFnArgs {
  pt: any;
  aliasToCol: Record<
    string,
    (() => Promise<{ builder: any }>) | string | undefined
  >;
  knex: XKnex;
  alias: string;
  a?: string;
  fn: (...args: any) => Promise<{ builder: Knex.QueryBuilder | any }>;
  colAlias: string;
  prevBinaryOp?: any;
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
    case 'mssql':
      val = mssql[name] || name;
      break;
    case 'sqlite':
    case 'sqlite3':
      val = sqlite[name] || name;
      break;
  }

  if (typeof val === 'function') {
    return val(args);
  } else if (typeof val === 'string') {
    args.pt.callee.name = val;
  }
};

export default mapFunctionName;
