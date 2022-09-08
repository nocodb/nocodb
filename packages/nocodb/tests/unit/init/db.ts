import { DbConfig } from "../../../src/interface/config";


const isSqlite = (context) =>
  (context.dbConfig as DbConfig).client === 'sqlite';

const isMysql = (context) =>
  (context.dbConfig as DbConfig).client === 'mysql' ||
  (context.dbConfig as DbConfig).client === 'mysql2';

export { isSqlite, isMysql };
