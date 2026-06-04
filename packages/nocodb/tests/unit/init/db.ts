import { DbConfig } from '~/interface/config';

const isSqlite = (context: any) => {
  return (
    (context.dbConfig as DbConfig).client === 'sqlite' ||
    (context.dbConfig as DbConfig).client === 'sqlite3'
  );
};

const isPg = (context: any) =>
  (context.dbConfig as DbConfig).client === 'pg';

const isMysql = (context: any) =>
  (context.dbConfig as DbConfig).client === 'mysql' ||
  (context.dbConfig as DbConfig).client === 'mysql2';

// ── DATA DB helpers ────────────────────────────────────────────────────────
// Inspect the user-data-DB client (the dialect actually executing the SQL
// emitted by BaseModel for user-created tables). Use these — not the meta
// helpers — to gate dialect-specific assertions on read/write/filter/sort/
// aggregation behavior. Falls back to `dbConfig.client` when
// `dataDbConfig` isn't set so existing tests aren't broken.

const dataClient = (context: any): string | undefined =>
  context?.dataDbConfig?.client ?? context?.dbConfig?.client;

const isSqliteData = (context: any) => {
  const c = dataClient(context);
  return c === 'sqlite' || c === 'sqlite3';
};

const isPgData = (context: any) => dataClient(context) === 'pg';

const isMysqlData = (context: any) => {
  const c = dataClient(context);
  return c === 'mysql' || c === 'mysql2';
};

const isMssqlData = (context: any) => dataClient(context) === 'mssql';

export {
  isSqlite,
  isMysql,
  isPg,
  isSqliteData,
  isPgData,
  isMysqlData,
  isMssqlData,
};
