import {Migrator} from 'xc-migrator-ts';
const migrator = new Migrator()

class MigrationMgr {

  public static _getFolder(args) {
    args.folder = args.folder || process.cwd();
  }

  public static async init(args) {
    try {
      args.type = args.type || "mysql";
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
      this._getFolder(args)
      await migrator.migrationsCreate({
        dbAlias: args.dbAlias || "primary",
        folder: args.folder
      });
    } catch (e) {
      console.log('db.migrate.create : Error occured', e);
    }
  }

  public static async up(args) {

    try {

      this._getFolder(args)

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      const migratorInst = new Migrator()
      await migratorInst.migrationsUp({
        dbAlias: args.dbAlias || "primary",
        env: args.env || "dev",
        file: args.file || null,
        folder: args.folder,
        migrationSteps,
        onlyList: args.list,
        sqlContentMigrate: (+args.sqlContentMigrate === 0 ? 0 : 1)
      });

    } catch (e) {
      console.log('db.migrate.up : Error occured', e);
    }
  }

  public static async down(args) {

    try {

      this._getFolder(args)

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      await migrator.migrationsDown({
        dbAlias: args.dbAlias || "primary",
        env: args.env || "dev",
        file: args.file || null,
        folder: args.folder,
        migrationSteps,
        onlyList: args.list,
        sqlContentMigrate: (+args.sqlContentMigrate === 0 ? 0 : 1)
      });

    } catch (e) {
      console.log('db.migrate.down : Error occured', e);
    }
  }

  public static async list(args) {

    try {

      this._getFolder(args)

      let migrationSteps = args.steps || 9999;

      if (args.file) {
        migrationSteps = 0;
      }

      const data = await migrator.migrationsUp({
        dbAlias: args.dbAlias || "primary",
        env: args.env || "dev",
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
      args.type = args.type || "mysql";
      await migrator.clean(args);
    } catch (e) {
      console.log('db.migrate.clean : Error occured', e);
    }
  }


}

// expose class
export  default MigrationMgr;
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
