import KnexMigrator from './KnexMigrator';

export default class SqlMigratorFactory {
  static create(args) {
    switch (args.client) {
      case 'mysql':
      case 'mysql2':
      case 'pg':
      case 'oracledb':
      case 'mssql':
      case 'sqlite3':
        return new KnexMigrator();
        break;
      default:
        throw new Error('Database not supported');
        break;
    }
  }
}
