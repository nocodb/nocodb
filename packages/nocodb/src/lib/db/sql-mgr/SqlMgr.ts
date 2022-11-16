import fs from 'fs';
import path from 'path';
import url from 'url';

import fsExtra from 'fs-extra';
import importFresh from 'import-fresh';
import inflection from 'inflection';
import slash from 'slash';
import { Tele } from 'nc-help';
import SqlClientFactory from '../sql-client/lib/SqlClientFactory';
// import debug from 'debug';

import KnexMigrator from '../sql-migrator/lib/KnexMigrator';
// import {XKnex} from "../sql-data-mapper";
import NcConnectionMgr from '../../utils/common/NcConnectionMgr';
import { customAlphabet } from 'nanoid';
import Debug from '../util/Debug';
import Result from '../util/Result';
const randomID = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz_', 20);
const log = new Debug('SqlMgr');

const ToolOps = {
  DB_TABLE_LIST: 'tableList',
  DB_VIEW_LIST: 'viewList',
  DB_FUNCTION_LIST: 'functionList',
  DB_SEQUENCE_LIST: 'sequenceList',
  DB_PROCEDURE_LIST: 'procedureList',
  DB_TABLE_COLUMN_LIST: 'columnList',
  DB_TABLE_TRIGGER_LIST: 'triggerList',
  DB_TABLE_RELATION_LIST: 'relationList',
  DB_TABLE_RELATION_LIST_ALL: 'relationListAll',
  DB_TABLE_INDEX_LIST: 'indexList',
  DB_TABLE_ROW_LIST: 'list',
  DB_TABLE_ROW_CREATE: 'insert',
  DB_TABLE_CREATE: 'tableCreate',
  DB_VIEW_CREATE: 'viewCreate',
  DB_FUNCTION_CREATE: 'functionCreate',
  DB_SEQUENCE_CREATE: 'sequenceCreate',
  DB_PROCEDURE_CREATE: 'procedureCreate',

  DB_VIEW_READ: 'viewRead',
  DB_FUNCTION_READ: 'functionRead',
  DB_PROCEDURE_READ: 'procedureRead',

  DB_TABLE_COLUMN_CREATE: 'columnCreate',
  DB_TABLE_TRIGGER_CREATE: 'triggerCreate',
  DB_TABLE_RELATION_CREATE: 'relationCreate',
  DB_TABLE_INDEX_CREATE: 'indexCreate',
  DB_TABLE_UPDATE: 'tableUpdate',
  DB_VIEW_UPDATE: 'viewUpdate',
  DB_FUNCTION_UPDATE: 'functionUpdate',
  DB_SEQUENCE_UPDATE: 'sequenceUpdate',
  DB_PROCEDURE_UPDATE: 'procedureUpdate',
  DB_TABLE_COLUMN_UPDATE: 'columnUpdate',
  DB_TABLE_TRIGGER_UPDATE: 'triggerUpdate',
  DB_TABLE_RELATION_UPDATE: 'relationUpdate',
  DB_TABLE_INDEX_UPDATE: 'indexUpdate',
  DB_TABLE_ROW_UPDATE: 'update',
  DB_TABLE_DELETE: 'tableDelete',
  DB_VIEW_DELETE: 'viewDelete',
  DB_FUNCTION_DELETE: 'functionDelete',
  DB_SEQUENCE_DELETE: 'sequenceDelete',
  DB_PROCEDURE_DELETE: 'procedureDelete',
  DB_TABLE_COLUMN_DELETE: 'columnDelete',
  DB_TABLE_TRIGGER_DELETE: 'triggerDelete',
  DB_TABLE_RELATION_DELETE: 'relationDelete',
  DB_TABLE_INDEX_DELETE: 'indexDelete',
  DB_TABLE_ROW_DELETE: 'delete',

  DB_GET_KNEX_DATA_TYPES: 'getKnexDataTypes',
  DB_PROJECT_OPEN_BY_WEB: 'DB_PROJECT_OPEN_BY_WEB',
  PROJECT_READ_BY_WEB: 'PROJECT_READ_BY_WEB',

  IMPORT_FRESH: 'importFresh',
  WRITE_FILE: 'writeFile',

  REST_API_CALL: 'handleApiCall',
  SQL_CLIENT_EXECUTE_RAW_QUERY: 'executeRawQuery',

  PROJECT_MIGRATIONS_LIST: 'migrationsList',
  PROJECT_MIGRATIONS_UP: 'migrationsUp',
  PROJECT_MIGRATIONS_DOWN: 'migrationsDown',
  PROJECT_MIGRATIONS_TO_SQL: 'migrationsToSql',

  PROJECT_HAS_DB: 'projectHasDb',
  DB_TABLE_RENAME: 'tableRename',

  TEST_CONNECTION: 'testConnection',

  PROJECT_CREATE_BY_WEB: 'projectCreateByWeb',
  PROJECT_CHANGE_ENV: 'projectChangeEnv',

  PROJECT_UPDATE_BY_WEB: 'projectUpdateByWeb',
};

export default class SqlMgr {
  // @ts-ignore
  private project: any;
  // @ts-ignore
  private metaDb: any;
  // @ts-ignore
  private project_id: any;
  private _project: any;
  // @ts-ignore
  private _migrator: KnexMigrator;
  // @ts-ignore
  private logsRef: any;
  private currentProjectJson: any;
  private currentProjectConnections: any;
  private currentProjectServers: any;
  private currentProjectFolder: any;
  // @ts-ignore
  private projectRow: any;
  // @ts-ignore
  private id: any;
  // @ts-ignore
  private projectOpenData: any;

  /**
   * Creates an instance of SqlMgr.
   * @param {*} args
   * @param {String} args.toolDbPath - path to sqlite file that sql mgr will use
   * @memberof SqlMgr
   */
  constructor(args: any = {}) {
    const func = 'constructor';
    log.api(`${func}:args:`, args);
    this.project = args;
    this.metaDb = args.metaDb;
    this.project_id = args.project_id = args.id;
    this._migrator = new KnexMigrator(args);

    this.currentProjectJson = {};
    this.currentProjectConnections = {};
    this.currentProjectServers = {};
    this.currentProjectFolder = {};
    this.projectRow = {};
    this.id = null;
    // }
    return this;
  }

  public migrator() {
    return this._migrator;
  }

  // project() {
  //   return this._project;
  // }
  public async testConnection(args = {}) {
    const client = SqlClientFactory.create(args);
    return client.testConnection();
  }

  public async projectList(args = {}) {
    return this._project.list(args);
  }

  public async projectRead(args) {
    return this._project.read(args);
  }

  public async projectReadByWeb(args) {
    const data = new Result();
    data.data.list = [];
    args.id = 1;

    // todo: read it from config or env
    // this.currentProjectFolder = process.cwd();
    this.currentProjectFolder =
      this.currentProjectJson.toolDir || process.cwd();

    args.folder = slash(this.currentProjectFolder);
    const projectJson = {
      ...this.currentProjectJson,
      envs: { ...this.currentProjectJson.envs },
    };

    // delete db credentials
    for (const env of Object.keys(projectJson.envs)) {
      projectJson.envs[env] = {
        ...projectJson.envs[env],
        db: [...projectJson.envs[env].db],
      };
      for (let i = 0; i < projectJson.envs[env].db.length; i++) {
        projectJson.envs[env].db[i] = {
          ...projectJson.envs[env].db[i],
          connection: {
            database: projectJson.envs[env].db[i].connection.database,
          },
        };
      }
    }

    // remove meta db credentials
    if (projectJson.meta?.db) delete projectJson.meta.db;

    // remove auth credentials
    delete projectJson.auth;

    args.projectJson = projectJson;
    data.data.list[0] = args;
    return data;
  }

  public async projectReadByFolder(args) {
    const _func = this.projectReadByFolder.name;
    const result = new Result();
    log.api(`${_func}:args:`, args);
    //
    // try {
    //   results = await this.toolDb
    //     .select()
    //     .from('projects')
    //     .where({folder: args.folder});
    // } catch (e) {
    //   log.ppe(e, _func);
    //   throw e;
    // }
    result.data.list = [
      {
        folder: args.folder,
      },
    ];
    log.api(`${_func}: result`, result);
    return result;
  }

  public projectGetFolder(args) {
    return path.join(
      this.currentProjectFolder,
      'server',
      'tool',
      args.dbAlias,
      'seeds'
    );
  }

  public getRouteVersionLetter(args) {
    const dbs = this.currentProjectJson.envs[args.env].db;
    for (let index = 0; index < dbs.length; index++) {
      const db = dbs[index];
      if (db.meta.dbAlias === args.dbAlias) {
        if (db.meta && db.meta.api && db.meta.api.prefix) {
          return db.meta.api.prefix;
        }
        return this.genVer(index);
      }
    }
  }

  public genVer(i) {
    const l = 'vwxyzabcdefghijklmnopqrstu';
    return (
      i
        .toString(26)
        .split('')
        .map((v) => l[parseInt(v, 26)])
        .join('') + '1'
    );
  }

  public projectGetGqlPolicyPath(args) {
    return path.join(
      this.currentProjectFolder,
      'server',
      'resolvers',
      args.dbAlias,
      args.tn,
      `${args.tn}.policy.js`
    );
  }

  public async projectOpenByWeb(args) {
    try {
      this.currentProjectConnections = {};
      this.currentProjectJson = {};

      // read the project from local tool db
      const data = new Result();
      data.data.list = [];

      // todo: read it from config or env
      this.currentProjectFolder = args.toolDir || process.cwd();

      this.currentProjectJson = args;

      args.folder = slash(this.currentProjectFolder);

      // create connections for each db connection
      for (const env in this.currentProjectJson.envs) {
        for (let i = 0; i < this.currentProjectJson.envs[env].db.length; i++) {
          const connectionConfig = JSON.parse(
            JSON.stringify(this.currentProjectJson.envs[env].db[i])
          );

          const connectionKey = `${env}_${this.currentProjectJson.envs[env].db[i].meta.dbAlias}`;

          this.currentProjectConnections[connectionKey] =
            SqlClientFactory.create({
              ...connectionConfig,
              knex: NcConnectionMgr.get({
                dbAlias: this.currentProjectJson.envs[env].db[i].meta.dbAlias,
                env: env,
                config: args,
                projectId: args.id,
              }),
            });

          this.currentProjectServers[connectionKey] = {
            xserver: null,
            input: {},
            output: {},
          };
        }
      }

      // args.projectJson = JSON.parse(JSON.stringify(this.currentProjectJson));
      data.data.list[0] = args;

      this.projectOpenData = args;

      return data;
    } catch (e) {
      console.log('projectOpen::error', e);
      throw e;
    }
  }

  /**
   *
   *
   * @param {*} args
   * @param {String} args.env
   * @param {dbAlias} args.dbAlias
   * @returns
   * @memberof SqlMgr
   */
  public async projectGetSqlClient(args) {
    const func = this.projectGetSqlClient.name;
    log.api(`${func}:args:`, args);

    const connectionKey = `${args.env}_${args.dbAlias}`;

    if (connectionKey in this.currentProjectConnections) {
      return this.currentProjectConnections[connectionKey];
    }

    let connectionConfig = {};
    const dbs = this.currentProjectJson.envs[args.env].db;

    for (let index = 0; index < dbs.length; index++) {
      const db = dbs[index];
      if (db.meta.dbAlias === args.dbAlias) {
        connectionConfig = dbs[index];
      }
    }

    if ('client' in connectionConfig) {
      const data = SqlClientFactory.create(connectionConfig);
      this.currentProjectConnections[connectionKey] = data;
      // console.log(data);
      return data;
    }

    throw new Error(`Could not find connectionconfig ${args}`);
  }

  public async projectGetSchemaKey(args) {
    const func = this.projectGetSqlClient.name;
    log.api(`${func}:args:`, args);

    if (!args.env) {
      throw new Error(`Environment is mandatory`);
    }

    let schemaKey = '';
    let connectionConfig: any = {};

    const dbs = this.currentProjectJson.envs[args.env].db;

    for (let index = 0; index < dbs.length; index++) {
      const db = dbs[index];
      if (db.meta.dbAlias === args.dbAlias) {
        connectionConfig = dbs[index];
      }
    }

    if (connectionConfig.client === 'sqlite3') {
      schemaKey = connectionConfig.connection.connection.filename;
    } else {
      schemaKey =
        connectionConfig.connection.host +
        '_' +
        connectionConfig.connection.port +
        '_' +
        connectionConfig.connection.database;
    }

    return schemaKey;

    throw new Error(`Could not find connectionconfig ${args}`);
  }

  public async projectCreateByWeb(args) {
    const func = this.projectCreateByWeb.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    console.log(args);

    try {
      args.folder = args.folder || args.project.folder;
      args.folder = path.dirname(args.folder);
      args.title = args.title || args.project.title;
      args.type = args.type || args.project.type;

      if (this.isDbConnectionProject(args.projectJson)) {
        // ignore
      } else {
        await this.migrator().init(args);
        await this.migrator().sync(args);
      }

      this.projectOpenByWeb(args.projectJson);
    } catch (error) {
      log.ppe(error, func);
    }
    log.api(`${func} :result: ${result}`);
    return result;
  }

  public async projectUpdateByWeb(args) {
    const func = this.projectUpdateByWeb.name;

    const result = new Result();
    log.api(`${func}:args:`, args);

    console.log(args);

    try {
      fs.unlinkSync(path.join(this.currentProjectFolder, 'config.xc.json'));

      args.folder = args.folder || args.project.folder;
      args.folder = path.dirname(args.folder);
      args.title = args.title || args.project.title;
      args.type = args.type || args.project.type;

      if (this.isDbConnectionProject(args.projectJson)) {
      } else {
        await this.migrator().init(args);
        await this.migrator().sync(args);
      }

      this.projectOpenByWeb(args.projectJson);
    } catch (error) {
      log.ppe(error, func);
    }
    log.api(`${func} :result: ${result}`);
    return result;
  }

  public async projectUpdateWeb(args) {
    const func = this.projectUpdateWeb.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    console.log(args);

    try {
      args.title = args.title || args.project.title;
      args.type = args.type || args.project.type;

      if (this.isDbConnectionProject(args.projectJson)) {
      } else {
        await this.migrator().init(args);
        await this.migrator().sync(args);
      }

      this.projectOpenByWeb(args.project);
    } catch (error) {
      log.ppe(error, func);
    }
    log.api(`${func} :result: ${result}`);
    return result;
  }

  public _getDatabaseType(str) {
    switch (str) {
      case 'mysql:':
        return 'mysql';
        break;
      case 'mysql2:':
        return 'mysql2';
        break;
      case 'pg:':
        return 'pg';
        break;
      case 'oracledb:':
        return 'oracledb';
        break;
      case 'mssql:':
        return 'mssql';
        break;
      case 'sqlite3:':
        return 'sqlite3';
        break;
      case 'cockroachdb:':
        return 'pg';
        break;
      default:
        return 'mysql';
    }
  }

  public _getKnexInitObject(sqlConfig) {
    // console.log(sqlConfig);

    const ORACLE_PORT = 1521;

    if (sqlConfig.typeOfDatabase === 'sqlite3') {
      return {
        client: 'sqlite3',
        connection: {
          // filename: "./db/sakila-sqlite"
          filename: sqlConfig.database,
        },
      };
    } else if (sqlConfig.typeOfDatabase === 'oracledb') {
      return {
        client: sqlConfig.typeOfDatabase,
        connection: {
          host: sqlConfig.host,
          user: sqlConfig.user,
          password: sqlConfig.password,
          database: sqlConfig.database,
          port: sqlConfig.port,
          connectString: `localhost:${ORACLE_PORT}/xe`,
          // connectString: `${sqlConfig.host}:${sqlConfig.port}/${sqlConfig.database}`,
        },
      };
    } else if (sqlConfig.typeOfDatabase === 'mariadb') {
      sqlConfig.typeOfDatabase = 'mysql2';
      return {
        client: sqlConfig.typeOfDatabase,
        connection: sqlConfig,
      };
    } else if (sqlConfig.typeOfDatabase === 'cockroachdb') {
      sqlConfig.typeOfDatabase = 'pg';
      return {
        client: sqlConfig.typeOfDatabase,
        connection: sqlConfig,
      };
    } else {
      return {
        client: sqlConfig.typeOfDatabase,
        connection: { ...sqlConfig },
      };
    }
  }

  public _getDbPort(dbType) {
    switch (dbType) {
      case 'mysql':
      case 'mysql2':
        return 3306;
        break;
      case 'pg':
        return 5432;
        break;
      case 'oracledb':
        return '5432';
        break;
      case 'mssql':
        return 1433;
        break;
      case 'sqlite3':
        return 0;
        break;
      default:
        return 'mysql';
    }
  }

  public _parseUrlToConnection(dbUrl) {
    try {
      const config: any = {};

      config.connection = {};
      config.meta = {
        tn: 'nc_evolutions',
        dbAlias: 'db',
      };

      const urlParts = url.parse(dbUrl, true);

      const queryParams = urlParts.query;

      config.client = this._getDatabaseType(urlParts.protocol) || 'mysql';
      config.connection.host = urlParts.hostname || 'localhost';
      config.connection.port =
        +urlParts.port || this._getDbPort(config.typeOfDatabase);
      config.connection.user = queryParams.u || null;
      config.connection.password = queryParams.p || null;
      config.connection.database = queryParams.d || null;

      if (config.client === 'mysql') {
        config.connection.multipleStatements = true;
      }

      if (!config.connection.user || !config.connection.database) {
        let msg = config.connection.user ? '' : 'Username cant be empty';
        msg += config.connection.database ? '' : 'Database name cant be empty';
        throw new Error(msg);
      }

      return config;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  public _createProjectJsonFromDbUrls(args) {
    try {
      const projectJson = {
        title: '',
        envs: {
          _noco: {
            db: [],
            apiClient: {
              data: [],
            },
          },
        },
        workingEnv: '_noco',
        meta: {
          version: '0.5',
          seedsFolder: 'seeds',
          queriesFolder: 'queries',
          apisFolder: 'apis',
          projectType: args.projectType || 'rest',
          type: args.type || 'mvc',
          language: args.language || 'ts',
        },
        version: '0.5',
        seedsFolder: 'seeds',
        queriesFolder: 'queries',
        apisFolder: 'apis',
        projectType: args.projectType || 'rest',
        type: args.type || 'mvc',
        language: args.language || 'ts',
        apiClient: {
          data: [],
        },
      };

      for (let i = 0; i < args.url.length; ++i) {
        const config = this._parseUrlToConnection(args.url[i]);

        if (i) {
          config.meta.dbAlias = i > 1 ? `secondary${i}` : `secondary`;
        }

        projectJson.envs._noco.db.push(config);
      }

      return projectJson;
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  /**
   *
   * @param {*} args
   * @param {Object} args.url - database urls
   * @memberof SqlMgr
   */
  public async projectCreateByDbUrl(args) {
    const func = this.projectCreateByDbUrl.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    try {
      args.folder = path.join(args.folder, 'config.xc.json');

      args.project = {
        title: path.basename(path.dirname(args.folder)),
        folder: args.folder,
        type: 'mysql',
      };

      args.projectJson = this._createProjectJsonFromDbUrls(args);

      // result = await this._project.create(args.project);
      if (result.code) {
        return result;
      }

      args.folder = args.folder || args.project.folder;
      args.folder = path.dirname(args.folder);
      args.title = args.title || args.project.title;
      args.type = args.type || args.project.type;

      if (this.isDbConnectionProject(args.projectJson)) {
      } else {
        await this.migrator().init(args);
        await this.migrator().sync(args);
      }
      // this.projectOpen(args.project);
    } catch (error) {
      log.ppe(error, func);
    }
    log.api(`${func} :result: ${result}`);
    return result;
  }

  /**
   *
   *
   * @param {*} args - project row object
   * @returns
   * @memberof SqlMgr
   */
  public async projectRemove(args) {
    const func = this.projectRemove.name;
    const result = new Result();
    log.api(`${func}:args:`, args);

    // await this.sql-migrator().clean(args);
    await this._project.remove(args);

    return result;
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
  public async sqlOp(args, op, opArgs) {
    const func = this.sqlOp.name;
    log.api(`${func}:args:`, args, op, opArgs);

    console.log(args);

    // create sql client for this operation
    const client = await this.projectGetSqlClient(args);

    // do sql operation
    const data = await client[op](opArgs);

    return data;
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
  public async sqlOpPlus(args, op, opArgs) {
    const func = this.sqlOpPlus.name;
    log.api(`${func}:args:`, args, op, opArgs);

    console.log(args);

    // create sql client for this operation
    const sqlClient = await this.projectGetSqlClient(args);

    // do sql operation
    const sqlMigrationStatements = await sqlClient[op](opArgs);
    console.log(
      `Sql Migration Statement for '${op}'`,
      sqlMigrationStatements.data.object
    );

    args.folder = this.currentProjectFolder;

    if (this.isProjectDbConnection()) {
    } else {
      // create sql migration files
      const sqlMigrationFiles = await this.migrator().migrationsCreate(args);
      console.log(`Sql Migration Files for '${op}'`, sqlMigrationFiles);

      // write sql statements to migration files
      console.log(
        `Write sql migration files for '${op}' with`,
        sqlMigrationStatements
      );
      await this.migrator().migrationsWrite({
        ...args,
        ...sqlMigrationStatements.data.object,
        folder: this.currentProjectFolder,
        up: sqlMigrationFiles.up,
        down: sqlMigrationFiles.down,
      });

      // mark as migration done in nc_evolutions table
      console.log(
        `TODO: write sql migration files for '${op}' with`,
        sqlMigrationStatements
      );
      const migrationArgs = {
        ...args,
        sqlContentMigrate: 0,
        migrationSteps: 9999,
        folder: this.currentProjectFolder,
        sqlClient,
      };
      // console.log(`Migration up args for '${op}'`, migrationArgs);
      await this.migrator().migrationsUp(migrationArgs);
    }

    return sqlMigrationStatements;
  }

  public createExpressRoutes(tables, relations, router = 'express') {
    const routes = [];

    const id = router === 'express' ? ':id' : '{id}';
    const parentId = router === 'express' ? ':parentId' : '{parentId}';

    for (let i = 0; i < tables.length; ++i) {
      /**************** START : express routes ****************/
      routes.push({
        type: 'get',
        url: `/api/v1/${tables[i].tn}`,
        routeFunction: 'list',
        tn: tables[i].tn,
        enabled: true,
      });

      routes.push({
        type: 'post',
        url: `/api/v1/${tables[i].tn}`,
        routeFunction: 'create',
        tn: tables[i].tn,
        enabled: true,
      });

      routes.push({
        type: 'get',
        url: `/api/v1/${tables[i].tn}/${id}`,
        routeFunction: 'read',
        tn: tables[i].tn,
        enabled: true,
      });

      routes.push({
        type: 'put',
        url: `/api/v1/${tables[i].tn}/${id}`,
        routeFunction: 'update',
        tn: tables[i].tn,
        enabled: true,
      });

      routes.push({
        type: 'delete',
        url: `/api/v1/${tables[i].tn}/${id}`,
        routeFunction: 'delete',
        tn: tables[i].tn,
        enabled: true,
      });

      const hasManyRelations = relations.filter((r) => r.tn === tables[i].tn);

      for (let j = 0; j < hasManyRelations.length; ++j) {
        routes.push({
          type: 'get',
          url: `/api/v1/${hasManyRelations[j].rtn}/${parentId}/${tables[i].tn}`,
          routeFunction: `${hasManyRelations[j].rtn}_has_many_${tables[i].tn}`,
          tn: tables[i].tn,
          relation: hasManyRelations[j].rtn,
          enabled: true,
        });
      }

      /**************** END : express routes ****************/
    }

    return routes;
  }

  public getDbType({ env, dbAlias }) {
    const db = this.currentProjectJson.envs[env].db.find(
      (db) => db.meta.dbAlias === dbAlias
    );
    return db.client;
  }

  public async copyAuthMigrations(args) {
    try {
      const dbs = this.currentProjectJson.envs._noco.db;
      const dbType = dbs[0].client;

      console.time('Copy and delete auth user migrations');

      const sqlClient = await this.projectGetSqlClient({
        env: '_noco',
        dbAlias: 'db',
      });
      const usersTableExists = await sqlClient.hasTable({ tn: 'xc_users' });

      if (usersTableExists && usersTableExists.data.value) {
        console.log('A users table already exists, skip auth migrations');
        return;
      }

      if (!args.noauth) {
        await fsExtra.copy(
          path.join(
            this.currentProjectFolder,
            'server',
            'tool',
            'misc',
            'auth',
            dbType
          ),
          path.join(
            this.currentProjectFolder,
            'server',
            'tool',
            'db',
            'migrations'
          )
        );
        await fsExtra.remove(
          path.join(this.currentProjectFolder, 'server', 'tool', 'misc')
        );
      }
      console.timeEnd('Copy and delete auth user migrations');
    } catch (e) {
      console.log('auth migration copying', e);
    }
  }

  public isProjectRest() {
    return this.currentProjectJson.projectType.toLowerCase() === 'rest';
  }

  public isProjectGrpc() {
    return this.currentProjectJson.projectType.toLowerCase() === 'grpc';
  }

  public isProjectGraphql() {
    return this.currentProjectJson.projectType.toLowerCase() === 'graphql';
  }

  public isProjectMigrations() {
    return this.currentProjectJson.projectType.toLowerCase() === 'migrations';
  }

  public isProjectDbConnection() {
    return this.currentProjectJson.projectType.toLowerCase() === 'dbconnection';
  }

  public isProjectNoApis() {
    return (
      this.currentProjectJson.projectType.toLowerCase() === 'dbconnection' ||
      this.currentProjectJson.projectType.toLowerCase() === 'migrations'
    );
  }

  public isRestProject(projectJson) {
    return projectJson.projectType.toLowerCase() === 'rest';
  }

  public isMvc() {
    return (
      this.currentProjectJson.type &&
      this.currentProjectJson.type.toLowerCase() === 'mvc'
    );
  }

  public isGraphqlProject(projectJson) {
    return projectJson.projectType.toLowerCase() === 'graphql';
  }

  public isMigrationsProject(projectJson) {
    return projectJson.projectType.toLowerCase() === 'migrations';
  }

  public isDbConnectionProject(projectJson?) {
    return projectJson?.projectType?.toLowerCase() === 'dbConnection';
  }

  public isNoApisProject(projectJson) {
    return (
      projectJson.projectType.toLowerCase() === 'dbConnection' ||
      projectJson.projectType.toLowerCase() === 'migrations'
    );
  }

  public async handleApiCall(apiMeta) {
    const req = this.axiosRequestMake(apiMeta);
    // t = process.hrtime();
    const data = await require('axios')(req);

    apiMeta.response.status = data.status;
    apiMeta.response.headers = data.headers;
    apiMeta.response.data = data.data;

    return {
      ...apiMeta,
      body: JSON.stringify(apiMeta.body, null, 2),
      response: {
        ...apiMeta.response,
        // timeTaken: t2,
        createdAt: Date.now(),
      },
    };
  }

  public async handleAxiosCall(apiMeta) {
    // t = process.hrtime();
    const data = await require('axios')(...apiMeta);

    Tele.emit('evt', { evt_type: 'import:excel:url' });
    return data.data;
  }

  public axiosRequestMake(apiMeta) {
    if (apiMeta.body) {
      try {
        apiMeta.body = JSON.parse(apiMeta.body);
      } catch (e) {
        console.log(e);
      }
    }

    if (apiMeta.auth) {
      try {
        apiMeta.auth = JSON.parse(apiMeta.auth);
      } catch (e) {
        console.log(e);
      }
    }

    apiMeta.response = {};
    const req = {
      params: apiMeta.parameters
        ? apiMeta.parameters.reduce((paramsObj, param) => {
            if (param.name && param.enabled) {
              paramsObj[param.name] = param.value;
            }
            return paramsObj;
          }, {})
        : {},
      url: apiMeta.path,
      method: apiMeta.method,
      data: apiMeta.body,
      headers: apiMeta.headers
        ? apiMeta.headers.reduce((headersObj, header) => {
            if (header.name && header.enabled) {
              headersObj[header.name] = header.value;
            }
            return headersObj;
          }, {})
        : {},
      withCredentials: true,
    };
    return req;
  }

  public async migrationsList(args) {
    return this._migrator.migrationsList(args);
  }

  public async migrationsUp(args) {
    return this._migrator.migrationsUp(args);
  }

  public async migrationsDown(args) {
    return this._migrator.migrationsDown(args);
  }

  public async migrationsToSql(args) {
    return this._migrator.migrationsToSql(args);
  }

  public async executeRawQuery(args, query) {
    const client = await this.projectGetSqlClient(args);
    return client.raw(query);
  }

  public async projectChangeEnv(args) {
    try {
      const xcConfig = JSON.parse(
        fs.readFileSync(
          path.join(this.currentProjectFolder, 'config.xc.json'),
          'utf8'
        )
      );
      xcConfig.workingEnv = args.env;
      fs.writeFileSync(
        path.join(this.currentProjectFolder, 'config.xc.json'),
        JSON.stringify(xcConfig, null, 2)
      );
    } catch (e) {
      console.log(e);
      throw e;
    }
  }

  // table alias functions

  public async getTableNameAlias({ inflectionFn, tn }) {
    if (inflectionFn) {
      return inflection[inflectionFn](tn);
    }
    return tn;
  }

  public async getColumnNameAlias({ inflectionFn, cn }) {
    if (inflectionFn) {
      return inflection[inflectionFn](cn);
    }
    return cn;
  }

  public async handleRequest(operation, args) {
    let result;

    try {
      const op = (
        args.sqlOpPlus &&
        !process.env.NC_TRY &&
        !('NC_MIGRATIONS_DISABLED' in process.env)
          ? this.sqlOpPlus
          : this.sqlOp
      ).bind(this);

      switch (operation) {
        case 'tableCreateStatement':
          console.log('Within tableCreateStatement handler', args);
          result = await op(args, 'tableCreateStatement', args.args);
          break;
        case 'tableInsertStatement':
          console.log('Within tableInsertStatement handler', args);
          result = await op(args, 'tableInsertStatement', args.args);
          break;
        case 'tableUpdateStatement':
          console.log('Within tableUpdateStatement handler', args);
          result = await op(args, 'tableUpdateStatement', args.args);
          break;
        case 'tableSelectStatement':
          console.log('Within tableSelectStatement handler', args);
          result = await op(args, 'tableSelectStatement', args.args);
          break;
        case 'tableDeleteStatement':
          console.log('Within tableDeleteStatement handler', args);
          result = await op(args, 'tableDeleteStatement', args.args);
          break;
        case ToolOps.DB_TABLE_LIST:
          console.log('Within DB_TABLE_LIST handler', args);
          result = await op(args, 'tableList', args.args);
          break;
        case ToolOps.DB_VIEW_LIST:
          console.log('Within DB_VIEW_LIST handler', args);
          result = await op(args, 'viewList', args.args);
          break;
        case ToolOps.DB_FUNCTION_LIST:
          console.log('Within DB_FUNCTION_LIST handler', args);
          result = await op(args, 'functionList', args.args);
          break;
        case ToolOps.DB_SEQUENCE_LIST:
          console.log('Within DB_SEQUENCE_LIST handler', args);
          result = await op(args, 'sequenceList', args.args);
          break;
        case ToolOps.DB_PROCEDURE_LIST:
          console.log('Within DB_PROCEDURE_LIST handler', args);
          result = await op(args, 'procedureList', args.args);
          break;
        case ToolOps.DB_TABLE_COLUMN_LIST:
          console.log('Within DB_TABLE_COLUMN_LIST handler', args);
          result = await op(args, 'columnList', args.args);
          break;
        case ToolOps.DB_TABLE_TRIGGER_LIST:
          console.log('Within DB_TABLE_TRIGGER_LIST handler', args);
          result = await op(args, 'triggerList', args.args);
          break;
        case ToolOps.DB_TABLE_RELATION_LIST:
          console.log('Within DB_TABLE_RELATION_LIST handler', args);
          result = await op(args, 'relationList', args.args);
          break;
        case ToolOps.DB_TABLE_RELATION_LIST_ALL:
          console.log('Within DB_TABLE_RELATION_LIST_ALL handler', args);
          result = await op(args, 'relationListAll', args.args);
          break;
        case ToolOps.DB_TABLE_INDEX_LIST:
          console.log('Within DB_TABLE_INDEX_LIST handler', args);
          result = await op(args, 'indexList', args.args);
          break;
        case ToolOps.DB_TABLE_ROW_LIST:
          console.log('Within DB_TABLE_ROW_LIST handler', args);
          result = await op(args, 'list', args.args);
          break;

        case ToolOps.DB_TABLE_RENAME:
          console.log('Within DB_TABLE_RENAME handler', args);
          result = await op(args, 'tableRename', args.args);
          break;

        case ToolOps.DB_TABLE_CREATE:
          console.log('Within DB_TABLE_CREATE handler', args);
          result = await op(args, 'tableCreate', args.args);
          break;
        case ToolOps.DB_VIEW_CREATE:
          console.log('Within DB_VIEW_CREATE handler', args);
          result = await op(args, 'viewCreate', args.args);
          break;
        case ToolOps.DB_FUNCTION_CREATE:
          console.log('Within DB_FUNCTION_CREATE handler', args);
          result = await op(args, 'functionCreate', args.args);
          break;
        case ToolOps.DB_SEQUENCE_CREATE:
          console.log('Within DB_SEQUENCE_CREATE handler', args);
          result = await op(args, 'sequenceCreate', args.args);
          break;
        case ToolOps.DB_PROCEDURE_CREATE:
          console.log('Within DB_PROCEDURE_CREATE handler', args);
          result = await op(args, 'procedureCreate', args.args);
          break;

        case ToolOps.DB_TABLE_TRIGGER_CREATE:
          console.log('Within DB_TABLE_TRIGGER_CREATE handler', args);
          result = await op(args, 'triggerCreate', args.args);
          break;
        case ToolOps.DB_TABLE_RELATION_CREATE:
          console.log('Within DB_TABLE_RELATION_CREATE handler', args);
          args.args.foreignKeyName =
            args.args.foreignKeyName || `fk${randomID()}`;
          result = await op(args, 'relationCreate', args.args);
          break;
        case ToolOps.DB_TABLE_INDEX_CREATE:
          console.log('Within DB_TABLE_INDEX_CREATE handler', args);
          result = await op(args, 'indexCreate', args.args);
          break;
        case ToolOps.DB_TABLE_ROW_CREATE:
          console.log('Within DB_TABLE_ROW_CREATE handler', args);
          result = await op(args, 'insert', args.args);
          break;
        case ToolOps.DB_TABLE_UPDATE:
          console.log('Within DB_TABLE_UPDATE handler', args);
          result = await op(args, 'tableUpdate', args.args);
          break;
        case ToolOps.DB_VIEW_UPDATE:
          console.log('Within DB_VIEW_UPDATE handler', args);
          result = await op(args, 'viewUpdate', args.args);
          break;
        case ToolOps.DB_FUNCTION_UPDATE:
          console.log('Within DB_FUNCTION_UPDATE handler', args);
          result = await op(args, 'functionUpdate', args.args);
          break;
        case ToolOps.DB_SEQUENCE_UPDATE:
          console.log('Within DB_SEQUENCE_UPDATE handler', args);
          result = await op(args, 'sequenceUpdate', args.args);
          break;
        case ToolOps.DB_PROCEDURE_UPDATE:
          console.log('Within DB_PROCEDURE_UPDATE handler', args);
          result = await op(args, 'procedureUpdate', args.args);
          break;

        case ToolOps.DB_TABLE_TRIGGER_UPDATE:
          console.log('Within DB_TABLE_TRIGGER_UPDATE handler', args);
          result = await op(args, 'triggerUpdate', args.args);
          break;
        case ToolOps.DB_TABLE_RELATION_UPDATE:
          console.log('Within DB_TABLE_RELATION_UPDATE handler', args);
          result = await op(args, 'relationUpdate', args.args);
          break;
        case ToolOps.DB_TABLE_INDEX_UPDATE:
          console.log('Within DB_TABLE_INDEX_UPDATE handler', args);
          result = await op(args, 'indexUpdate', args.args);
          break;
        case ToolOps.DB_TABLE_ROW_UPDATE:
          console.log('Within DB_TABLE_ROW_UPDATE handler', args);
          result = await op(args, 'update', args.args);
          break;
        case ToolOps.DB_TABLE_DELETE:
          console.log('Within DB_TABLE_DELETE handler', args);
          result = await op(args, 'tableDelete', args.args);
          break;
        case ToolOps.DB_VIEW_DELETE:
          console.log('Within DB_VIEW_DELETE handler', args);
          result = await op(args, 'viewDelete', args.args);
          break;
        case ToolOps.DB_FUNCTION_DELETE:
          console.log('Within DB_FUNCTION_DELETE handler', args);
          result = await op(args, 'functionDelete', args.args);
          break;
        case ToolOps.DB_SEQUENCE_DELETE:
          console.log('Within DB_SEQUENCE_DELETE handler', args);
          result = await op(args, 'sequenceDelete', args.args);
          break;
        case ToolOps.DB_PROCEDURE_DELETE:
          console.log('Within DB_PROCEDURE_DELETE handler', args);
          result = await op(args, 'procedureDelete', args.args);
          break;

        case ToolOps.DB_TABLE_TRIGGER_DELETE:
          console.log('Within DB_TABLE_TRIGGER_DELETE handler', args);
          result = await op(args, 'triggerDelete', args.args);
          break;
        case ToolOps.DB_TABLE_RELATION_DELETE:
          console.log('Within DB_TABLE_RELATION_DELETE handler', args);
          result = await op(args, 'relationDelete', args.args);
          break;
        case ToolOps.DB_TABLE_INDEX_DELETE:
          console.log('Within DB_TABLE_INDEX_DELETE handler', args);
          result = await op(args, 'indexDelete', args.args);
          break;
        case ToolOps.DB_TABLE_ROW_DELETE:
          console.log('Within DB_TABLE_ROW_DELETE handler', args);
          result = await op(args, 'delete', args.args);
          break;
        case ToolOps.DB_GET_KNEX_DATA_TYPES:
          console.log('Within DB_TABLE_ROW_DELETE handler', args);
          result = await op(args, 'getKnexDataTypes', args.args);
          break;
        case ToolOps.DB_PROJECT_OPEN_BY_WEB:
          console.log('Within DB_PROJECT_OPEN handler', args);
          result = '';
          break;
        case ToolOps.PROJECT_READ_BY_WEB:
          console.log('Within PROJECT_READ_BY_WEB handler', args);
          result = this.projectReadByWeb({});
          break;
        case ToolOps.DB_VIEW_READ:
          console.log('Within DB_VIEW_READ handler', args);
          result = await op(args, 'viewRead', args.args);
          break;
        case ToolOps.DB_FUNCTION_READ:
          console.log('Within DB_FUNCTION_READ handler', args);
          result = await op(args, 'functionRead', args.args);
          break;
        case ToolOps.DB_PROCEDURE_READ:
          console.log('Within DB_FUNCTION_READ handler', args);
          result = await op(args, 'procedureRead', args.args);
          break;

        case ToolOps.IMPORT_FRESH:
          console.log('Within IMPORT_FRESH handler', args);
          result = await importFresh(args.args.path);
          break;
        case ToolOps.WRITE_FILE:
          console.log('Within WRITE_FILE handler', args);
          result = fs.writeFileSync(args.args.path, args.args.data);
          break;

        case ToolOps.REST_API_CALL:
          console.log('Within REST_API_CALL handler', args);
          result = this.handleApiCall(args.args);
          break;
        case 'handleAxiosCall':
          console.log('Within handleAxiosCall handler', args);
          result = this.handleAxiosCall(args.args);
          break;

        case ToolOps.PROJECT_MIGRATIONS_LIST:
          console.log('Within PROJECT_MIGRATIONS_LIST handler', args);
          result = await this.migrationsList(args.args);
          break;
        case ToolOps.PROJECT_MIGRATIONS_UP:
          console.log('Within PROJECT_MIGRATIONS_UP handler', args);
          result = await this.migrationsUp(args.args);
          break;
        case ToolOps.PROJECT_MIGRATIONS_DOWN:
          console.log('Within PROJECT_MIGRATIONS_DOWN handler', args);
          result = await this.migrationsDown(args.args);
          break;
        case ToolOps.PROJECT_MIGRATIONS_TO_SQL:
          console.log('Within PROJECT_MIGRATIONS_TO_SQL handler', args);
          result = await this.migrationsToSql(args.args);
          break;

        case ToolOps.SQL_CLIENT_EXECUTE_RAW_QUERY:
          console.log('Within SQL_CLIENT_EXECUTE_RAW_QUERY handler', args);
          result = await this.executeRawQuery(args, args.args);
          break;

        case ToolOps.PROJECT_HAS_DB:
          console.log('Within PROJECT_HAS_DB handler', args);
          result = await this.projectHasDb();
          break;

        case ToolOps.TEST_CONNECTION:
          console.log('Within TEST_CONNECTION handler', args);
          result = await this.testConnection(args.args);
          break;

        case ToolOps.PROJECT_CREATE_BY_WEB:
          console.log('Within PROJECT_CREATE_BY_WEB handler', args);
          result = await this.projectCreateByWeb(args.args);
          break;

        case ToolOps.PROJECT_UPDATE_BY_WEB:
          console.log('Within PROJECT_UPDATE_BY_WEB handler', args);
          result = await this.projectUpdateByWeb(args.args);
          break;

        case ToolOps.PROJECT_CHANGE_ENV:
          console.log('Within PROJECT_CHANGE_ENV handler', args);
          result = await this.projectChangeEnv(args.args);
          break;

        case 'tableMetaCreate':
        case 'tableMetaDelete':
        case 'tableMetaRecreate':
        case 'viewMetaCreate':
        case 'viewMetaDelete':
        case 'viewMetaRecreate':
        case 'procedureMetaCreate':
        case 'procedureMetaDelete':
        case 'procedureMetaRecreate':
        case 'functionMetaCreate':
        case 'functionMetaDelete':
        case 'functionMetaRecreate':
          result = { msg: 'success' };
          break;

        default:
          throw new Error('Operation not found');
          break;
      }
    } catch (e) {
      throw e;
    } finally {
    }
    return result;
  }

  public async handleRequestWithFile(operation, _args, _file) {
    let result;

    try {
      // console.log(operation, args);

      // const op = (args.sqlOpPlus ? this.sqlOpPlus : this.sqlOp).bind(this);

      switch (operation) {
        default:
          throw new Error('Operation not found');
          break;
      }
    } catch (e) {
      throw e;
    } finally {
    }
    return result;
  }

  public projectHasDb() {
    for (const env of Object.values(this.currentProjectJson.envs) as any[]) {
      if (env.db.length) {
        return true;
      }
    }
    return false;
  }

  public static stats: any;
}

SqlMgr.stats = SqlMgr.stats || {};
