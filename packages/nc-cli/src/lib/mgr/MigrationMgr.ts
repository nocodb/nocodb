import { Migrator } from 'xc-migrator-ts';
const migrator = new Migrator();

class MigrationMgr {
  public static _getFolder(args) {
    args.folder = args.folder || process.cwd();
  }

  public static async init(args) {
    try {
      args.type = args.type || 'mysql';
      await migrator.init(args);
    } catch (e) {
      console.log('db.migrate.init : Error occured', e);
    }
  }

  public static async sync(args) {
    try {
      this._getFolder(args);
      await migrator.sync(args);
    } catch (e) {
      console.log('db.migrate.sync : Error occured', e);
    }
  }

  public static async create(args) {
    try {
      this._getFolder(args);
      await migrator.migrationsCreate({
        dbAlias: args.dbAlias || 'primary',
        folder: args.folder
      });
    } catch (e) {
      console.log('db.migrate.create : Error occured', e);
    }
  }

  public static async up(args) {
    try {
      this._getFolder(args);

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      const migratorInst = new Migrator();
      await migratorInst.migrationsUp({
        dbAlias: args.dbAlias || 'primary',
        env: args.env || 'dev',
        file: args.file || null,
        folder: args.folder,
        migrationSteps,
        onlyList: args.list,
        sqlContentMigrate: +args.sqlContentMigrate === 0 ? 0 : 1
      });
    } catch (e) {
      console.log('db.migrate.up : Error occured', e);
    }
  }

  public static async down(args) {
    try {
      this._getFolder(args);

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      await migrator.migrationsDown({
        dbAlias: args.dbAlias || 'primary',
        env: args.env || 'dev',
        file: args.file || null,
        folder: args.folder,
        migrationSteps,
        onlyList: args.list,
        sqlContentMigrate: +args.sqlContentMigrate === 0 ? 0 : 1
      });
    } catch (e) {
      console.log('db.migrate.down : Error occured', e);
    }
  }

  public static async list(args) {
    try {
      this._getFolder(args);

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      const data = await migrator.migrationsUp({
        dbAlias: args.dbAlias || 'primary',
        env: args.env || 'dev',
        file: args.file || null,
        folder: args.folder,
        migrationSteps,
        onlyList: true
      });

      console.log(data.data.object.list);
    } catch (e) {
      console.log('db.migrate.up : Error occured', e);
    }
  }

  public static async clean(args) {
    try {
      args.type = args.type || 'mysql';
      await migrator.clean(args);
    } catch (e) {
      console.log('db.migrate.clean : Error occured', e);
    }
  }
}

// expose class
export default MigrationMgr;
