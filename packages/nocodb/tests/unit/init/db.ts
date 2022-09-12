import { DbConfig } from "../../../src/interface/config";


const isSqlite = (context) =>{
  console.log(context.dbConfig, (context.dbConfig as DbConfig).client === 'sqlite' || (context.dbConfig as DbConfig).client === 'sqlite3');
  return (context.dbConfig as DbConfig).client === 'sqlite' || (context.dbConfig as DbConfig).client === 'sqlite3';
}

const isMysql = (context) =>
  (context.dbConfig as DbConfig).client === 'mysql' ||
  (context.dbConfig as DbConfig).client === 'mysql2';

export { isSqlite, isMysql };
