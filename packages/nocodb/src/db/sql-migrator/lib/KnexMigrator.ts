import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import glob from 'glob';
import Handlebars from 'handlebars';
import mkdirp from 'mkdirp';
import rmdir from 'rmdir';
import SqlClientFactory from '../../sql-client/lib/SqlClientFactory';
import Debug from '../../util/Debug';
import Emit from '../../util/emit';
import Result from '../../util/Result';
import * as fileHelp from '../../util/file.help';
import SqlMigrator from './SqlMigrator';
import { getToolDir, NcConfig } from '~/utils/nc-config';

const evt = new Emit();
const log = new Debug('KnexMigrator');
/**
 * Class to create an instance of KnexMigrator
 *
 * @class KnexMigrator
 * @extends {SqlMigrator}
 */
export default class KnexMigrator extends SqlMigrator {
  // @ts-ignore
  private baseObj: any;
  // @ts-ignore
  private base_id: any;
  private metaDb: any;
  private toolDir: string;

  /**
   * Creates an instance of KnexMigrator.
   * @memberof KnexMigrator
   */
  constructor(baseObj?: any) {
    super();
    this.baseObj = baseObj;
    this.base_id = baseObj?.base_id;
    this.base = baseObj?.config;
    this.metaDb = baseObj?.metaDb;
    this.toolDir = getToolDir();
  }

  emit(data, _args?) {
    log.api(data);
    evt.evt.emit('UI', {
      status: 0,
      data: `Migrator : ${data}`,
    });
  }

  emitW(data, _args?) {
    log.warn(data);
    evt.evt.emit('UI', {
      status: 1,
      data,
    });
  }

  emitE(data, _args?) {
    log.error(data);
    evt.evt.emit('UI', {
      status: -1,
      data,
    });
  }

  /**
   *
   * @ignore
   * @param {*} args
   * @returns {String} Absolute path of environment
   * @memberof KnexMigrator
   */
  _getWorkingEnvDir(args) {
    return path.join(
      this.toolDir,
      'nc',
      this.base.id,
      args.dbAlias,
      'migrations',
    );
  }

  async _initAllEnvOnFilesystem() {
    const { envs } = this.base;

    // working env will have all databases
    const { workingEnv } = this.base;

    for (let i = 0; i < envs[workingEnv].db.length; ++i) {
      const { dbAlias } = envs[workingEnv].db[i].meta;
      await this._initDbOnFs({
        dbAlias,
      });
    }
  }

  async _cleanDbAliasOnFilesystem(args) {
    const { envs } = this.base;

    // working env will have all databases
    const toCleanEnv = args.env || this.base.workingEnv;

    for (let i = 0; i < envs[toCleanEnv].db.length; ++i) {
      const { dbAlias } = envs[toCleanEnv].db[i].meta;

      await this._cleanFs({
        dbAlias,
      });
    }
  }

  async _initDbOnFs(args) {
    this.emit(
      'Creating folder: ',
      path.join(this.toolDir, 'nc', this.base.id, args.dbAlias, 'migrations'),
    );

    try {
      // @ts-ignore
      // @ts-ignore
      await promisify(mkdirp)(
        path.join(this.toolDir, 'nc', this.base.id, args.dbAlias, 'migrations'),
      );
      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const dirStat = await promisify(fs.stat)(
        path.join(this.toolDir, 'nc', this.base.id, args.dbAlias, 'migrations'),
      );

      // @ts-ignore
      await promisify(mkdirp)(
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.metaFolder || 'meta',
        ),
      );

      this.emit(
        'Creating folder: ',
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.seedsFolder,
        ),
      );

      // @ts-ignore
      await promisify(mkdirp)(
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.seedsFolder,
        ),
      );
      this.emit(
        'Creating folder: ',
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.queriesFolder,
        ),
      );

      // @ts-ignore
      await promisify(mkdirp)(
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.queriesFolder,
        ),
      );
      this.emit(
        'Creating folder: ',
        path.join(this.toolDir, 'nc', this.base.id, this.base.meta.apisFolder),
      );

      // @ts-ignore
      await promisify(mkdirp)(
        path.join(this.toolDir, 'nc', this.base.id, this.base.meta.apisFolder),
      );

      // @ts-ignore
      await promisify(mkdirp)(
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.metaFolder || 'meta',
        ),
      );

      // @ts-ignore
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const metaStat = await promisify(fs.stat)(
        path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          this.base.meta.metaFolder || 'meta',
        ),
      );
    } catch (e) {
      log.debug(
        'Error creating folders (migrations, apis, seeds, queries):',
        path.join(this.toolDir, 'nc', this.base.id, args.dbAlias, 'migrations'),
      );
    }
  }

  async _cleanFs(args) {
    this.emit(
      'Removing folder: ',
      path.join(this.toolDir, 'nc', this.base.id, args.dbAlias),
    );

    try {
      await promisify(rmdir)(
        path.join(this.toolDir, 'nc', this.base.id, args.dbAlias),
      );
    } catch (e) {
      log.debug(
        'Error removing folder:',
        path.join(this.toolDir, 'nc', this.base.id, args.dbAlias),
        e,
      );
    }
  }

  async _readProjectJson(projJsonFilePath = null) {
    try {
      // projJsonFilePath = `${path.join(this.toolDir, "config.xc.json")}`;

      log.debug('_readProjectJson', projJsonFilePath);
      const exists = await promisify(fs.exists)(projJsonFilePath);

      if (exists) {
        // this.base = await promisify(jsonfile.readFile)(projJsonFilePath);
        this.base = await promisify(fs.readFile)(projJsonFilePath, 'utf8');
        this.base = JSON.parse(this.base, (_key, value) => {
          return typeof value === 'string'
            ? Handlebars.compile(value, { noEscape: true })(process.env)
            : value;
        });
        this.base.folder = this.toolDir || path.dirname(projJsonFilePath);
      } else {
        throw new Error('Base file should have got created');
      }
    } catch (e) {
      log.debug('error in _readProjectJson: ', e);
    }
  }

  async _initProjectJsonFile(args) {
    try {
      if (!args.folder) {
        args.folder = this.toolDir;
      }

      const projJsonFilePath = `${path.join(args.folder, 'config.xc.json')}`;
      log.debug(args, projJsonFilePath);

      const exists = await promisify(fs.exists)(projJsonFilePath);

      if (exists) {
        await this._readProjectJson(projJsonFilePath);
        this.emit('Migrator for base initalised successfully');
      } else if (
        Object.keys(process.env).some((envKey) =>
          envKey.startsWith('NC_DB_URL'),
        )
      ) {
        this.base = await NcConfig.createByEnv();
      } else {
        args.type = args.type || 'sqlite';

        let freshProject = require('./templates/sqlite.template');

        if (args.baseJson) {
          freshProject = args.baseJson;
        } else {
          switch (args.type) {
            case 'mysql':
            case 'mysql2':
              freshProject = require('./templates/mysql.template.js');
              break;

            case 'pg':
              freshProject = require('./templates/pg.template.js');
              break;

            case 'mssql':
              freshProject = require('./templates/mssql.template.js');
              break;

            case 'oracle':
              freshProject = require('./templates/oracle.template.js');
              break;

            case 'sqlite':
              freshProject = require('./templates/sqlite.template.js');
              break;

            default:
              throw new Error('Unknown database option provided');
              break;
          }
        }

        if (!args.folder) {
          args.folder = freshProject.folder;
        }

        //freshProject.folder = args.folder;

        // @ts-ignore
        await promisify(mkdirp)(`${args.folder}`);

        this.emit(`Base folder created successfully: ${args.folder}`);

        const newProjectJsonPath = path.join(args.folder, 'config.xc.json');

        if (args.title) {
          freshProject.title = args.title;
        }

        await promisify(fs.writeFile)(
          newProjectJsonPath,
          JSON.stringify(freshProject, null, 2),
          'utf-8',
        );

        this.emit(`Base json created successfully: ${newProjectJsonPath}`);

        await this._readProjectJson(newProjectJsonPath);
      }
    } catch (e) {
      log.debug(e);
      throw e;
    }
  }

  async _initDbWithSql(connectionConfig) {
    const sqlClient =
      connectionConfig.sqlClient ||
      (await SqlClientFactory.create(connectionConfig));
    if (connectionConfig.client === 'oracledb') {
      this.emit(
        `${connectionConfig.client}: Creating DB if not exists ${connectionConfig.connection.user}`,
      );
      await sqlClient.createDatabaseIfNotExists({
        database: connectionConfig.connection.user,
      });
    } else if (connectionConfig.client !== 'sqlite3') {
      this.emit(
        `${connectionConfig.client}: Creating DB if not exists ${connectionConfig.connection.database}`,
      );
      await sqlClient.createDatabaseIfNotExists({
        database: connectionConfig.connection.database,
      });
    } else {
      this.emit(
        `${connectionConfig.client}: Creating DB if not exists ${connectionConfig.connection.connection.filename}`,
      );
      await sqlClient.createDatabaseIfNotExists({
        database: connectionConfig.connection.connection.filename,
      });
    }

    this.emit(`Creating Table if not exists in ${connectionConfig.meta.tn}`);

    if (!('NC_MIGRATIONS_DISABLED' in process.env)) {
      await sqlClient.createTableIfNotExists({
        tn: connectionConfig.meta.tn,
      });
    }
    // if (connectionConfig.client === "pg") {
    //   this.emit(
    //     `Creating Function 'xc_trigger_update_timestamp' if not exists in ${connectionConfig.connection.databaseName}`
    //   );
    //   await sqlClient.raw(`CREATE OR REPLACE FUNCTION xc_trigger_update_timestamp()
    //                     RETURNS TRIGGER AS $$
    //                     BEGIN
    //                       NEW.updated_at = NOW();
    //                       RETURN NEW;
    //                     END;
    //                     $$ LANGUAGE plpgsql;`);
    // }
  }

  async _cleanDbWithSql(connectionConfig) {
    const sqlClient = await SqlClientFactory.create(connectionConfig);
    if (connectionConfig.client === 'oracledb') {
      this.emit(`Dropping DB : ${connectionConfig.connection.user}`);
      await sqlClient.dropDatabase({
        database: connectionConfig.connection.user,
      });
    } else if (connectionConfig.client === 'sqlite3') {
      this.emit(
        `Dropping DB : ${connectionConfig.connection.connection.filename}`,
      );
      await sqlClient.dropDatabase({
        database: connectionConfig.connection.connection.filename,
      });
    } else {
      this.emit(`Dropping DB : ${connectionConfig.connection.database}`);
      await sqlClient.dropDatabase({
        database: connectionConfig.connection.database,
      });
    }

    // await sqlClient.createTableIfNotExists({tn: connectionConfig.meta.tn});
  }

  async _initEnvDbsWithSql(env, dbAlias = null, sqlClient = null) {
    const { envs } = this.base;

    this.emit(`Initialising env: ${env}`);

    for (let i = 0; i < this.base.envs[env].db.length; ++i) {
      const connectionConfig = envs[env].db[i];

      /* if no dbAlias - init all dbs in env. Else check if it matches the one sent in args */
      if (!dbAlias || dbAlias === envs[env].db[i].meta.dbAlias) {
        await this._initDbWithSql({ ...connectionConfig, sqlClient });
      }
    }
  }

  async _initAllEnvDbsWithSql(_args) {
    // const env = '';

    for (const env in this.base.envs) {
      await this._initEnvDbsWithSql(env, null);
    }
  }

  async _cleanAllEnvDbs() {
    const { envs } = this.base;
    // removes all envs
    for (const env in envs) {
      for (let i = 0; i < envs[env].db.length; ++i) {
        const connectionConfig = envs[env].db[i];
        await this._cleanDbWithSql(connectionConfig);
      }
    }
  }

  async _cleanEnvDbsWithSql(args) {
    const { envs } = this.base;

    if (args.env) {
      // remove environment from argument
      const { env } = args;

      for (let i = 0; i < envs[env].db.length; ++i) {
        const connectionConfig = envs[env].db[i];

        if (args.dbAlias) {
          // remove dbAlias from argument
          if (args.dbAlias == connectionConfig.meta.dbAlias) {
            await this._cleanDbWithSql(connectionConfig);
          }
        } else {
          // remove all dbAlias in this environment
          await this._cleanDbWithSql(connectionConfig);
        }
      }
    } else {
      this._cleanAllEnvDbs();
    }
  }

  _getSqlConnectionFromDbAlias(dbAlias, env?) {
    env = env || this.base.workingEnv;

    for (let i = 0; i < this.base.envs[env].db.length; ++i) {
      const connection = this.base.envs[env].db[i];
      if (connection.meta.dbAlias === dbAlias) {
        return connection;
      }
    }
  }

  async _migrationsUp(args): Promise<any> {
    const result = new Result();

    result.data.object = {};
    result.data.object.list = [];

    if (process.env.NC_MIGRATIONS_DISABLED) {
      return result;
    }
    try {
      const { onlyList } = args;
      let { migrationSteps } = args;

      if (!migrationSteps && !args.file) {
        result.code = -1;
        result.message =
          'Neither num of steps nor file is specified for migration';
        log.debug('Neither num of steps nor file is specified for migration');
        log.debug('See help');
        return result;
      }

      /** ************** START : get files and migrations *************** */
      // get all evolutions from fs
      // const files = await promisify(glob)(args.upFilesPattern);
      // const filesDown = await promisify(glob)(args.downFilesPattern);

      let files;
      let filesDown;

      if (this.metaDb) {
        filesDown = files = await this.metaDb('nc_migrations')
          .where({
            base_id: this.base_id,
            db_alias: args.dbAlias,
          })
          .orderBy('id', 'asc');
      } else {
        files = await promisify(glob)(args.upFilesPattern);
        filesDown = await promisify(glob)(args.downFilesPattern);
      }

      // get evolutions from sql
      const connection = this._getSqlConnectionFromDbAlias(
        args.dbAlias,
        args.env,
      );
      const sqlClient =
        args.sqlClient || (await SqlClientFactory.create(connection));

      let migrations = await sqlClient.selectAll(
        sqlClient.getTnPath(connection.meta.tn),
      );

      if (this.suffix) {
        migrations = migrations.filter((m) => m.title.includes(this.suffix));
      }

      /** ************** END : get files and migrations *************** */

      if (files.length === migrations.length) {
        this.emit(
          `Evolutions are upto date for ' ${args.env} : ${args.dbAlias} '`,
        );
        for (let i = 0; i < migrations.length; ++i) {
          result.data.object.list.push({
            title: migrations[i].title,
            titleDown: migrations[i].titleDown,
            status: false,
          });
        }

        result.data.object.pending = files.length - migrations.length;
      } else if (files.length > migrations.length || onlyList) {
        this.emit(
          `Number of evolutions pending for '${args.env}:${args.dbAlias}': '${
            files.length - migrations.length
          }'`,
        );
        result.data.object.pending = files.length - migrations.length;

        /** ************** START : Find file index to begin migrations *************** */
        let fileIndex = 0;
        // ignore the files which are migrated already
        if (migrations.length !== 0) {
          // get last evolution that was made
          const lastEvolution = migrations[migrations.length - 1];
          let i = 0;
          // find the index of the last evolution in evolution list of files
          for (; i < files.length; ++i) {
            if (this.metaDb) {
              if (files[i].title.indexOf(lastEvolution.title) !== -1) {
                i++;
                break;
              }
            } else {
              if (files[i].indexOf(lastEvolution.title) !== -1) {
                i++;
                break;
              }
            }
          }

          fileIndex = i;
        }
        /** ************** END : Find file index to begin migrations *************** */

        try {
          /** ************** START : calculate migration steps from filename *************** */
          if (!migrationSteps) {
            let fileFound = 0;
            for (let i = fileIndex; i < files.length; ++i) {
              migrationSteps++;
              if (this.metaDb) {
                if (files[i].title.includes(args.file)) {
                  fileFound = 1;
                  break;
                }
              } else {
                if (files[i].includes(args.file)) {
                  fileFound = 1;
                  break;
                }
              }
            }
            if (!fileFound) {
              log.debug(
                `Error : There is no file ${args.file} in migration directory`,
              );
              return;
            }
          }
          /** ************** END : calculate migration steps from filename *************** */

          if (onlyList) {
            if (this.metaDb) {
              for (let i = 0; i < fileIndex; ++i) {
                result.data.object.list.push({
                  title: files[i].title,
                  titleDown: filesDown[i].title_down,
                  status: false,
                });
              }
            } else {
              for (let i = 0; i < fileIndex; ++i) {
                const fileParts = files[i].split('/');
                const downFileParts = filesDown[i].split('/');
                result.data.object.list.push({
                  title: fileParts[fileParts.length - 1],
                  titleDown: downFileParts[fileParts.length - 1],
                  status: false,
                });
              }
            }
          }

          const upStatements = [];
          const metaTableInserts = [];

          /** ************** START : Apply migrations *************** */
          for (
            let i = fileIndex;
            i < files.length && i < fileIndex + migrationSteps;
            ++i
          ) {
            let fileName;
            let fileNameDown;

            if (this.metaDb) {
              fileName = files[i].title;
              fileNameDown = files[i].title_down;
            } else {
              const splits = files[i].split('/');
              fileName = splits[splits.length - 1];

              const splitsDown = filesDown[i].split('/');
              fileNameDown = splitsDown[splitsDown.length - 1];
            }

            if (onlyList) {
              log.debug(fileName);
              // result.data.object.list.push(fileName)
              result.data.object.list.push({
                title: fileName,
                titleDown: fileNameDown,
                status: true,
              });
            } else {
              let upStatement;
              if (this.metaDb) {
                upStatement = files[i].up;
              } else {
                upStatement = await promisify(fs.readFile)(files[i], 'utf8');
              }
              if (args.sqlContentMigrate) {
                // Split base on comments which starts with `xc` , eg : /* xc :test */ , /*xc*/
                upStatements.push(
                  ...upStatement
                    .split(/\/\*\s*xc[\s\S]*?\s*\*\//)
                    .filter((s) => s.trim()),
                );
              }

              metaTableInserts.push({
                title: fileName,
                titleDown: fileNameDown,
                // description: files[i],
                status: 0,
                // created: Date.now()
              });
            }
          }

          if (onlyList) {
          } else {
            const vm = this;

            const trx = await sqlClient.knex.transaction();
            try {
              for (const query of upStatements) {
                await trx.raw(query);
                vm.emit(`'${query}' : Executed SQL query`);
              }
              for (const data of metaTableInserts) {
                await trx(sqlClient.getTnPath(connection.meta.tn)).insert(data);
                vm.emit(
                  `'${data.title}' : Updating bookkeeping of SQL UP migration - done`,
                );
              }
              await trx.commit();

              //console.log('========== success ')
            } catch (error) {
              await trx.rollback();
              vm.emitW(
                `Migration operation failed, Database restored to previous state`,
              );
              log.ppe(error, '');
              throw error;
            }
          }

          /** ************** END : Apply migrations *************** */
        } catch (e) {
          this.emitE(`Error while migrating up : ${e.code} and ${e.message}`);
          log.debug(e);
          throw e;
        }
      } else {
        result.data.object.pending = -1;
        this.emitE('Evolutions are dirty - reset the whole thing please');
      }
    } catch (e) {
      log.debug('Error in evolutionUp', e);
      result.code = -1;
      result.message = e.message;
      throw e;
    }

    return result;
  }

  async _migrationsDown(args) {
    if (process.env.NC_MIGRATIONS_DISABLED) {
      return;
    }

    // const {env} = args;
    let { migrationSteps } = args;
    const { onlyList } = args;

    if (!migrationSteps && !args.file) {
      log.debug('Neither num of steps nor file is specified for migartion');
      log.debug('See help');
      return;
    }

    if (args.onlyList) {
      log.debug('Pending migration list:');
    } else {
      log.debug('Migrating Down:');
    }

    try {
      let files;
      if (this.metaDb) {
        files = await this.metaDb('nc_migrations')
          .where({
            base_id: this.base_id,
            db_alias: args.dbAlias,
          })
          .orderBy('title', 'asc');
      } else {
        // get all evolutions from fs
        files = await promisify(glob)(args.downFilesPattern);
      }
      // get done evolutions from sql
      const connection = this._getSqlConnectionFromDbAlias(
        args.dbAlias,
        args.env,
      );
      const sqlClient = await SqlClientFactory.create(connection);
      const migrations = await sqlClient.selectAll(
        sqlClient.getTnPath(connection.meta.tn),
      );

      if (migrations.length) {
        try {
          if (!migrationSteps) {
            let fileFound = 0;
            for (let i = migrations.length - 1; i >= 0; --i) {
              migrationSteps++;
              if (this.metaDb) {
                if (files[i].title_down.includes(args.file)) {
                  fileFound = 1;
                  break;
                }
              } else {
                if (files[i].includes(args.file)) {
                  fileFound = 1;
                  break;
                }
              }
            }
            if (!fileFound) {
              log.debug(
                `Error : There is no file ${args.file} in migration directory`,
              );
              return;
            }
          }

          const downStatements = [];
          const metaDownDeletes = [];
          for (
            let i = migrations.length - 1, j = 0;
            i >= 0 && j < migrationSteps;
            --i, ++j
          ) {
            let fileName;
            if (this.metaDb) {
              fileName = files[i].title_down;
            } else {
              const splits = files[i].split('/');
              fileName = splits[splits.length - 1];
            }
            if (onlyList) {
              log.debug(fileName);
            } else {
              let downStatement;
              this.emit(`Migrating Down: '${fileName}'`);
              if (this.metaDb) {
                downStatement = files[i].down;
              } else {
                downStatement = await promisify(fs.readFile)(files[i], 'utf8');
              }
              if (args.sqlContentMigrate)
                downStatements.push(
                  ...downStatement
                    .split(/\/\*\s*xc[\s\S]*?\s*\*\//)
                    .filter((s) => s.trim()),
                );

              metaDownDeletes.push({
                titleDown: fileName,
              });
            }
          }

          const vm = this;

          const trx = await sqlClient.knex.transaction();
          try {
            for (const query of downStatements) {
              await trx.raw(query).transacting(trx);
              vm.emit(`'${query}' : Executed SQL query`);
            }
            for (const condition of metaDownDeletes) {
              vm.emit(
                `'${condition.titleDown}' : Updating bookkeeping of SQL DOWN migration - done`,
              );
              await trx(sqlClient.getTnPath(connection.meta.tn))
                .where(condition)
                .del();
            }

            await trx.commit();
            //console.log('========== success ');
          } catch (error) {
            await trx.rollback();
            vm.emitW(
              `Migration operation failed, Database restored to previous state`,
            );
            log.ppe(error, '');
            throw error;
          }
        } catch (e) {
          throw e;
        }
      }
    } catch (e) {
      log.debug('Error in evolutionUp', e);
    }
  }

  /**
   * Initialises migration base
   * Creates base json file in pwd of where command is run.
   * Creates xmigrator folder in pwd, within which migrations for all dbs will be sored
   *
   * @param {object} args
   * @param {String} args.type - type of database (mysql | pg | oracle | mssql | sqlite)
   * @param {String} args.title - Name of Base
   * @param {String} args.folder - Base Dir
   * @memberof KnexMigrator
   */
  async init(args) {
    // if (this.metaDb) {
    //   return;
    // }

    const func = this.init.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    log.debug(args);
    try {
      // await this._initProjectJsonFile(args);
      await this._initAllEnvOnFilesystem();
    } catch (e) {
      log.debug('Error in creating migration base:', e);
      throw e;
    }
  }

  /**
   * Sync is called after init() or any change to config.xc.json file
   * This initialises databases and migration tables within each connection of config.xc.json
   *
   * @memberof KnexMigrator
   */
  async sync(args: any = {}) {
    const func = this.sync.name;
    log.api(`${func}:args:`, args);

    try {
      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }

      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }

      /* if no env - init all envs */
      if (!args.env) {
        /* happens when creating the base */
        for (const env in this.base.envs) {
          args.env = env;
          await this._initEnvDbsWithSql(args.env, args.dbAlias, args.sqlClient);
        }
      } else {
        await this._initEnvDbsWithSql(args.env, args.dbAlias, args.sqlClient);
      }
    } catch (e) {
      log.debug('Error in creating migration base:', e);
      throw e;
    }
  }

  /**
   *
   * @param {Object} args
   * @param {Object} args.env
   * @param {Object} args.dbAlias
   * @param {Object} args.json
   * @memberof KnexMigrator
   */
  async clean(args) {
    const func = this.clean.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }

      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }
      if (!args.env) {
        await this._cleanDbAliasOnFilesystem(args);
      }

      await this._cleanEnvDbsWithSql(args);

      log.debug('Cleaning all Databases');
    } catch (e) {
      log.debug('Error in cleaning migration base:', e);
      throw e;
    }
  }

  /**
   * Creates up and down migration files within migration folders
   *
   * @param {object} args
   * @param {String} args.dbAlias - Database alias within environment
   * @returns {object} files
   * @returns {String} files.up
   * @returns {String} files.down
   * @memberof KnexMigrator
   */
  async migrationsCreate(args: any = {}) {
    const func = this.migrationsCreate.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }
      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }

      // create filenames
      const prefix = `${fileHelp.getUniqFilenamePrefix()}${this.suffix}`;
      const upFileName = fileHelp.getFilenameForUp(prefix);
      const downFileName = fileHelp.getFilenameForDown(prefix);
      if (this.metaDb) {
        await this.metaDb('nc_migrations').insert({
          base_id: this.base_id,
          db_alias: args.dbAlias,
          up: '',
          down: '',
          title: upFileName,
          title_down: downFileName,
        });
      } else {
        // create files
        await promisify(fs.writeFile)(
          path.join(this._getWorkingEnvDir(args), upFileName),
          '',
          'utf-8',
        );
        await promisify(fs.writeFile)(
          path.join(this._getWorkingEnvDir(args), downFileName),
          '',
          'utf-8',
        );
      }

      this.emit(
        `Migration files created successfully : '${upFileName}' and '${downFileName}'`,
      );

      return {
        up: upFileName,
        down: downFileName,
      };
    } catch (e) {
      log.debug(e);
      throw e;
    }
  }

  /**
   * Creates up and down migration files within migration folders
   *
   * @param {object} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @returns {String} files.up
   * @returns {String} files.down
   * @memberof KnexMigrator
   */
  async migrationsDelete(args = {}) {
    const func = this.migrationsDelete.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }
      //
      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }
      /**
       *
       * Call migrationsDown() here
       *  Then delete the files
       *  Then delete the records
       *
       */
    } catch (e) {
      log.debug(e);
      throw e;
    }

    return result;
  }

  /**
   * migrationsUp
   *
   * @param {object} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @param {Number} args.steps - number of steps to migrate
   * @param {String} args.file - till which file to migration
   * @param {Number} args.sqlContentMigrate - defaults to 1 ,
   *                  on zero sqlContent is ignored
   *                  and only filenames are migrated to _evolution table
   * @memberof KnexMigrator
   */
  async migrationsUp(args: any = {}) {
    const func = this.migrationsUp.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    // if (!this.base) {
    //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
    // }
    // if (NcConfigFactory.hasDbUrl()) {
    //   this.base = NcConfigFactory.make();
    // }
    // console.log(this.base);

    return await this._migrationsUp({
      env: args.env,
      dbAlias: args.dbAlias,
      migrationSteps: args.migrationSteps,
      file: args.file,
      onlyList: args.onlyList,
      upFilesPattern: path.join(
        this.toolDir,
        'nc',
        this.base.id,
        args.dbAlias,
        'migrations',
        '*.up.sql',
      ),
      downFilesPattern: path.join(
        this.toolDir,
        'nc',
        this.base.id,
        args.dbAlias,
        'migrations',
        '*.down.sql',
      ),
      tn: this._getEvolutionsTablename(args), //`${this.toolDir}`,
      sqlContentMigrate: args.sqlContentMigrate,
      sqlClient: args.sqlClient,
    });
  }

  /**
   * migrationsDown
   *
   * @param {object} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @param {Number} args.steps - number of steps to migrate
   * @param {String} args.file - till which file to migration
   * @param {Number} args.sqlContentMigrate - defaults to 1 ,
   *                  on zero sqlContent is ignored
   *                  and only filenames are migrated to _evolution table
   * @memberof KnexMigrator
   */
  async migrationsDown(args) {
    const func = this.migrationsDown.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    // if (!this.base) {
    //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
    // }
    //
    // if (NcConfigFactory.hasDbUrl()) {
    //   this.base = NcConfigFactory.make();
    // }

    await this._migrationsDown({
      env: args.env,
      dbAlias: args.dbAlias,
      migrationSteps: args.migrationSteps,
      onlyList: args.onlyList,
      file: args.file,
      upFilesPattern: path.join(
        this.toolDir,
        'nc',
        this.base.id,
        args.dbAlias,
        'migrations',
        '*.up.sql',
      ),
      downFilesPattern: path.join(
        this.toolDir,
        'nc',
        this.base.id,
        args.dbAlias,
        'migrations',
        '*.down.sql',
      ),
      tn: this._getEvolutionsTablename(args), //`_evolutions`,
      sqlContentMigrate: args.sqlContentMigrate,
    });
  }

  /**
   * Migrations write
   *
   * @param {*} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @param {Object[]} args.upStatement - array of sql statements in obj
   * @param {String} args.upStatement[].sql - sql statements without ';'
   * @param {Object[]} args.downStatement
   * @param {String} args.downStatement[].sql - sql statements without ';'
   * @param {String} args.up - up filename - up filename (only name not entire path)
   * @param {String} args.down - down filename - down filename (only name not entire path)
   * @memberof KnexMigrator
   */
  async migrationsWrite(args) {
    const func = this.migrationsWrite.name;
    // const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }
      //
      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }

      let upStatement = '';
      let downStatement = '';

      for (let i = 0; i < args.upStatement.length; i++) {
        upStatement = `${upStatement + args.upStatement[i].sql};`;
      }
      log.debug('migrationsWrite: created up statement', upStatement);

      for (let i = 0; i < args.downStatement.length; i++) {
        downStatement = `${downStatement + args.downStatement[i].sql};`;
      }
      log.debug('migrationsWrite: created downStatement', downStatement);
      if (this.metaDb) {
        if (
          await this.metaDb('nc_migrations')
            .where({
              base_id: this.base_id,
              db_alias: args.dbAlias,
              title: args.up,
            })
            .first()
        ) {
          await this.metaDb('nc_migrations')
            .update({
              up: upStatement,
              down: downStatement,
            })
            .where({
              base_id: this.base_id,
              db_alias: args.dbAlias,
              title: args.up,
            });
        } else {
          await this.metaDb('nc_migrations').insert({
            base_id: this.base_id,
            db_alias: args.dbAlias,
            up: upStatement,
            down: downStatement,
            title: args.up,
            title_down: args.down,
          });
        }
      } else {
        await promisify(fs.writeFile)(
          path.join(this._getWorkingEnvDir(args), args.up),
          upStatement,
          'utf-8',
        );
        log.debug('migrationsWrite: wrote to file', args.up);

        await promisify(fs.writeFile)(
          path.join(this._getWorkingEnvDir(args), args.down),
          downStatement,
          'utf-8',
        );
      }
      log.debug('migrationsWrite: wrote to file', args.down);
    } catch (error) {
      log.debug('migrationsWrite error: ', error);
    }
  }

  /**
   * Migrations List
   *
   * @param {object} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {Number} args.steps - number of steps to migrate
   * @param {String} args.file - till which file to migration
   * @returns {Object} Result
   * @returns {Object} Result.data
   * @returns {Object} Result.data.object
   * @returns {String} Result.data.object.list
   * @returns {String} Result.data.object.pending
   * @memberof KnexMigrator
   */
  async migrationsList(args) {
    const result = await this.migrationsUp(args);
    return result;
  }

  /**
   * Migrations to SQL
   *
   * @param {*} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @returns {Object} Result
   * @returns {Object} Result.data
   * @returns {Object} Result.data.object
   * @returns {String} Result.data.object.up
   * @returns {String} Result.data.object.down
   * @memberof KnexMigrator
   */
  async migrationsToSql(args) {
    const result = new Result();

    try {
      result.data.object = {
        up: '',
        down: '',
      };

      // if (!this.base) {
      //   await this._readProjectJson(path.join(args.folder, "config.xc.json"));
      // }
      //
      // if (NcConfigFactory.hasDbUrl()) {
      //   this.base = NcConfigFactory.make();
      // }
      if (this.metaDb) {
        const migration = await this.metaDb('nc_migrations')
          .where({
            db_alias: args.dbAlias,
            base_id: this.base.id,
            title: args.title,
          })
          .first();

        result.data.object.up = migration.up;
        result.data.object.down = migration.down;
      } else {
        const upFilePath = path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          'migrations',
          args.title,
        );
        const downFilePath = path.join(
          this.toolDir,
          'nc',
          this.base.id,
          args.dbAlias,
          'migrations',
          args.titleDown,
        );

        result.data.object.up = await promisify(fs.readFile)(
          upFilePath,
          'utf8',
        );
        result.data.object.down = await promisify(fs.readFile)(
          downFilePath,
          'utf8',
        );
      }
      console.log('migrationsToSql', result.data.object);
    } catch (e) {
      console.log('migrationsToSql', e);
    }

    return result;
  }

  /**
   * Migrations Squash
   *
   *
   * @param {*} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @param {String} args.file
   * @param {String} args.steps
   * @param {String} args.up
   * @param {String} args.down
   * @memberof KnexMigrator
   */
  async migrationsSquash() {}

  /**
   * Migrations Create Manual
   *
   * @param {*} args
   * @param {String} args.env
   * @param {String} args.dbAlias
   * @param {String} args.folder
   * @param {String} args.file
   * @param {String} args.steps
   * @param {String} args.up
   * @param {String} args.down
   * @memberof KnexMigrator
   */
  async migrationsCreateManually() {}

  async _writeProjectJson(folder, _json) {
    const freshProject = '';
    const newProjectJsonPath = path.join(folder, 'config.xc.json');

    await promisify(fs.writeFile)(
      newProjectJsonPath,
      JSON.stringify(freshProject, null, 2),
      'utf-8',
    );
  }

  // async _getProjectJson(args) {
  //
  //   // if (!this.base) {
  //   //   if (args.folder) {
  //   //     await this._readProjectJson(path.join(args.folder, "config.xc.json"));
  //   //   } else {
  //   //     await this._readProjectJson(path.join(this.toolDir, "config.xc.json"));
  //   //   }
  //   // }
  //   //
  //   // if (NcConfigFactory.hasDbUrl()) {
  //   //   this.base = NcConfigFactory.make();
  //   // }
  //
  // }

  /**
   *
   * @param args
   * @param {String} args.folder - defaults to this.toolDir
   * @param {String} args.key
   * @param {String} args.value
   * @returns {Result}
   */
  async migrationsRenameProjectKey(args) {
    const func = this.migrationsRenameProjectKey.name;
    const result: any = new Result();
    log.api(`${func}:args:`, args);

    try {
      if (args.key && args.value) {
        result.code = -1;
        result.message = `Insufficient number of arguments`;
        this.emitE(`Insufficient number of arguments`);
      }

      // await this._getProjectJson(args);

      if (args.key in this.base) {
        this.base.key = args.value;
        await this._writeProjectJson(this.toolDir, this.base);
      }

      this.emitE(
        `Base key('${args.key}') is set to value successfully ${args.value}`,
      );
    } catch (e) {
      result.code = -1;
      result.object = e;
      console.log(e);
    }

    log.api(`${func}:result:`, result);

    return result;
  }

  /**
   * update json
   * update sqlite
   * base reopen
   *
   * @param args
   * @param {String} args.folder
   * @param {String} args.env
   * @param {String} args.envValue
   * @returns {Promise<void>}
   */
  async migrationsCreateEnv(args) {
    const func = this.migrationsRenameProjectKey.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      if (args.folder && args.env) {
        result.code = -1;
        result.message = 'Insufficient number of arguments';
      }

      // await this._getProjectJson(args);

      if (args.env in this.base.envs) {
        result.code = -1;
        result.message = `${args.env} already exists`;
        this.emitE(`${args.env} already exists`);
      } else {
        if (args.envValue) {
          this.base[args.env] = args.envValue;
        } else {
          this.base[args.env] = [];
        }

        await this._writeProjectJson(this.toolDir, this.base);
        await this._initEnvDbsWithSql(args.env);
        this.emitE(`Environment ' ${args.env} ' created succesfully in base.`);
      }
    } catch (e) {
      result.code = -1;
      result.code = `Exception occured in ${func} : ${e}`;
      result.object = e;
      console.log(e);
    }

    return result;
  }

  async migrationsRenameEnv(_sargs) {}

  /**
   * update json
   * update sqlite
   * base reopen
   *
   * @param args
   * @param {String} args.folder
   * @param {String} args.env
   * @returns {Promise<void>}
   */
  async migrationsDeleteEnv(args) {
    const func = this.migrationsDeleteEnv.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      if (args.folder && args.env) {
        result.code = -1;
        result.message = 'Insufficient number of arguments';
      }

      // await this._getProjectJson(args);

      if (args.env in this.base.envs) {
        await this._cleanEnvDbsWithSql(args);
        delete this.base.envs[args.env];
        await this._writeProjectJson(this.toolDir, this.base);
        this.emitE(`${args.env} deleted`);
      } else {
        result.code = -1;
        result.message = `${args.env} doesn't exist in base json`;
        this.emitE(`${args.env} doesn't exist in base json`);
      }
    } catch (e) {
      result.code = -1;
      result.code = `Exception occured in ${func} : ${e}`;
      result.object = e;
      console.log(e);
    }

    return result;
  }

  /**
   *
   * @param args
   * @param {String} args.folder
   * @param {String} args.env
   * @param {String} args.db
   * @returns {Result}
   */
  async migrationsCreateEnvDb(args) {
    const func = this.migrationsRenameProjectKey.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      if (args.folder && args.env && args.dbAlias) {
        result.code = -1;
        result.message = 'Insufficient number of arguments';
      }

      // await this._getProjectJson(args);

      if (args.env in this.base.envs) {
        let found = 0;
        // find if dbAlias exists in sent environment
        for (let i = 0; i < this.base.envs[args.env].db.length; ++i) {
          const db = this.base.envs[args.env].db[i];

          if (db.meta.dbAlas === args.db.meta.dbAlias) {
            found = 1;
            break;
          }
        }

        if (!found) {
          if (args.env === this.base.workingEnv) {
            // is the input env === dev environment - then push it to last
            this.base.envs[args.env].db.push(args.db);
            // TODO : init fs and db
          } else {
            let foundInWorkingEnv = 0;
            let i = 0;
            for (; i < this.base.envs[this.base.workingEnv].db.length; ++i) {
              const db = this.base.envs[this.base.workingEnv].db[i];

              if (db.meta.alias === args.db.meta.alias) {
                foundInWorkingEnv = 1;
                break;
              }
            }

            if (foundInWorkingEnv) {
              // in this working env index - place it at the right position
              this.base.envs[args.env].db.splice(i, 0, args.db);
            } else {
              this.base.envs[args.env].db.push(args.db);
            }
          }

          // TODO : init db for this dbAlias

          await this._writeProjectJson(this.toolDir, this.base);
        } else {
          result.code = -1;
          result.message = 'Database connection already exists with DbAlias';
          this.emitE(
            `Database connection already exists with DbAlias : ${args.db.meta.dbAlias}`,
          );
        }
      } else {
        result.code = -1;
        result.message = 'Invalid DbAlias';
        this.emitE(`Invalid DbAlias : ${args.db.meta.dbAlias}`);
      }
    } catch (e) {
      result.code = -1;
      result.code = `Exception occured in ${func} : ${e}`;
      result.object = e;
      console.log(e);
    }

    return result;
  }

  async migrationsUpdateEnvDb(_args) {
    throw new Error('Not implemented');
  }

  async migrationsDeleteEnvDb(_args) {
    throw new Error('Not implemented');
  }

  async migrationsUpWithExternalClient(_args) {
    throw new Error('Not implemented');
  }

  async migrationsDownWithExternalClient(_args) {
    throw new Error('Not implemented');
  }

  _getEvolutionsTablename({ env, dbAlias }) {
    const config = this._getSqlConnectionFromDbAlias({ env, dbAlias });
    if (config && config.meta && config.meta.tn) {
      return config.meta.tn;
    }
    return 'nc_evolutions';
  }

  private get suffix(): string {
    if (this.base?.prefix) return `_${this.base?.prefix.slice(3, 7)}`;
    return '';
  }
}
