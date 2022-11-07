import { XKnex } from '../../index';
import mssql from './functionMappings/mssql';
import mysql from './functionMappings/mysql';
import pg from './functionMappings/pg';
import sqlite from './functionMappings/sqlite';
import { Knex } from 'knex';

export interface MapFnArgs {
  pt: any;
  aliasToCol: { [alias: string]: string };
  knex: XKnex;
  alias: string;
  a?: string;
  fn: (...args: any) => Knex.QueryBuilder | any;
  colAlias: string;
  prevBinaryOp?: any;
}

const mapFunctionName = (args: MapFnArgs): any => {
  const name = args.pt.callee.name;
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
