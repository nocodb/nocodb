import type { TAliasToColumn } from './formulav2/formula-query-builder.types';
import type { XKnex } from '~/db/CustomKnex';
import type { Knex } from 'knex';
import type { Model } from '~/models';
import mysql from '~/db/functionMappings/mysql';
import pg from '~/db/functionMappings/pg';
import sqlite from '~/db/functionMappings/sqlite';
import databricks from '~/db/functionMappings/databricks';
import mssql from '~/db/functionMappings/mssql';
import oracle from '~/db/functionMappings/oracle';

export interface MapFnArgs {
  pt: any;
  aliasToCol: TAliasToColumn;
  knex: XKnex;
  fn: (...args: any) => Promise<{ builder: Knex.QueryBuilder | any }>;
  prevBinaryOp?: any;
  model: Model;
}

// Every function name the builder can legitimately emit into a parsed_tree.
// `formulaQueryBuilderv2` reuses a STORED tree without revalidating and later
// interpolates a call's name unbound into `knex.raw`, so a reused tree's callee
// names must be re-checked (GHSA-frqc). The saved tree is the builder's OUTPUT:
// this function rewrites names to their dialect target in place and that tree is
// persisted (MIN→least, LEN→length/char_length, CEILING→ceil, MAX→greatest…).
// The legit set is therefore each dialect map's keys (user names) AND its string
// values (rewrite targets) — computed here, where the maps already live, to keep
// the guard out of the formulav2 import cycle. Lazy so the maps finish loading
// first.
let allowedMappedFunctionNames: Set<string> | null = null;

export function getMappedFunctionNames(): Set<string> {
  if (allowedMappedFunctionNames) return allowedMappedFunctionNames;

  const set = new Set<string>();
  const maps: Record<string, unknown>[] = [
    mysql,
    pg,
    sqlite,
    databricks,
    mssql,
    oracle,
  ];
  for (const map of maps) {
    for (const [key, value] of Object.entries(map)) {
      set.add(key.toUpperCase());
      if (typeof value === 'string') set.add(value.toUpperCase());
    }
  }
  // Rewritten in place by a handler rather than a plain string alias: mysql's
  // SEARCH swaps its callee to LOCATE.
  set.add('LOCATE');

  allowedMappedFunctionNames = set;
  return set;
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
    case 'mssql':
      val = mssql[name] || name;
      break;
    case 'oracledb':
      val = oracle[name] || name;
      break;
  }

  if (typeof val === 'function') {
    return val(args);
  } else if (typeof val === 'string') {
    args.pt.callee.name = val;
  }
};

export default mapFunctionName;
