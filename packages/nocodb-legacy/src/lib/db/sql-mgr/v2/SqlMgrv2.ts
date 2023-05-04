// import debug from 'debug';

// import {XKnex} from "../sql-data-mapper";
import NcConnectionMgrv2 from '../../../utils/common/NcConnectionMgrv2';
import SqlClientFactory from '../../sql-client/lib/SqlClientFactory';
import KnexMigratorv2 from '../../sql-migrator/lib/KnexMigratorv2';
import Debug from '../../util/Debug';
import type Base from '../../../models/Base';

const log = new Debug('SqlMgr');

export default class SqlMgrv2 {
  protected _migrator: KnexMigratorv2;
  // @ts-ignore
  private currentProjectFolder: any;

  /**
   * Creates an instance of SqlMgr.
   * @param {*} args
   * @param {String} args.toolDbPath - path to sqlite file that sql mgr will use
   * @memberof SqlMgr
   */
  constructor(args: { id: string }) {
    const func = 'constructor';
    log.api(`${func}:args:`, args);
    // this.metaDb = args.metaDb;
    this._migrator = new KnexMigratorv2(args);

    return this;
  }

  public async migrator(_base: Base) {
    return this._migrator;
  }
  public static async testConnection(args = {}) {
    const client = await SqlClientFactory.create(args);
    return client.testConnection();
  }

  /**
   *
   *
   * @param {*} args
   * @param {String} args.env
   * @param {dbAlias} args.dbAlias
   * @param {String} op - sqlClient function to call
   * @param {*} opArgs - sqlClient function arguments
   * @memberof SqlMgr
   */
  public async sqlOp(base: Base, op, opArgs) {
    const func = this.sqlOp.name;
    log.api(`${func}:args:`, base, op, opArgs);

    // create sql client for this operation
    const client = await this.getSqlClient(base);

    // do sql operation
    const data = await client[op](opArgs);

    return data;
  }

  /**
   *
   *
   * @param {*} base
   * @param {String} base.env
   * @param {dbAlias} base.dbAlias
   * @param {String} op - sqlClient function to call
   * @param {*} opArgs - sqlClient function arguments
   * @memberof SqlMgr
   */
  public async sqlOpPlus(base: Base, op, opArgs) {
    const func = this.sqlOpPlus.name;
    log.api(`${func}:args:`, base, op, opArgs);

    // create sql client for this operation
    const sqlClient = await this.getSqlClient(base); //await this.projectGetSqlClient(args);

    // do sql operation
    const sqlMigrationStatements = await sqlClient[op](opArgs);
    console.log(
      `Sql Migration Statement for '${op}'`,
      sqlMigrationStatements.data.object
    );

    /* // create sql migration files
    const sqlMigrationFiles = await this.sql-migrator(base).migrationsCreate(base);
    console.log(`Sql Migration Files for '${op}'`, sqlMigrationFiles);

    // write sql statements to migration files
    console.log(
      `Write sql migration files for '${op}' with`,
      sqlMigrationStatements
    );
    await this.sql-migrator(base).migrationsWrite({
      base,
      ...sqlMigrationStatements.data.object,
      folder: this.currentProjectFolder,
      up: sqlMigrationFiles.up,
      down: sqlMigrationFiles.down
    });

    // mark as migration done in nc_evolutions table
    console.log(
      `TODO: write sql migration files for '${op}' with`,
      sqlMigrationStatements
    );
    const migrationArgs = {
      base: base,
      sqlContentMigrate: 0,
      migrationSteps: 9999,
      folder: this.currentProjectFolder,
      sqlClient
    };
    await this.sql-migrator(base).migrationsUp(migrationArgs);
*/
    return sqlMigrationStatements;
  }

  protected async getSqlClient(base: Base) {
    return NcConnectionMgrv2.getSqlClient(base);
  }
}
