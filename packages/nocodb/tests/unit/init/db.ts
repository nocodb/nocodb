import { DbConfig } from '../../../src/interface/config';

const isSqlite = (context) => {
  return (
    (context.dbConfig as DbConfig).client === 'sqlite' ||
    (context.dbConfig as DbConfig).client === 'sqlite3'
  );
};

const isPg = (context) => {
  return (context.dbConfig as DbConfig).client === 'pg';
};

const isMysql = (context) =>
  (context.dbConfig as DbConfig).client === 'mysql' ||
  (context.dbConfig as DbConfig).client === 'mysql2';

export { isSqlite, isMysql, isPg };
