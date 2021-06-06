import {
  // ModelXcMetaFactory,
  MysqlClient, PgClient, SqlClient,
  // ExpressXcPolicy,
  SqlClientFactory
} from 'nc-help';
import Noco from "../Noco";
import {Acls, DbConfig, NcConfig} from "../../../interface/config";
import XcDynamicChanges from "../../../interface/XcDynamicChanges";
import {BaseModelSql, XKnex} from "../../dataMapper";
import inflection from "inflection";
import BaseModel from "./BaseModel";
import {XcCron} from "./XcCron";
import {Router} from "express";
import NcMetaIO from "../meta/NcMetaIO";

import debug from 'debug';
import Knex from "knex";
import NcHelp from "../../utils/NcHelp";
import * as fs from "fs";
import NcProjectBuilder from "../NcProjectBuilder";
import XcCache from "../plugins/adapters/cache/XcCache";
import ModelXcMetaFactory from "../../sqlMgr/code/models/xc/ModelXcMetaFactory";
import ExpressXcPolicy from '../../sqlMgr/code/policies/xc/ExpressXcPolicy';

const log = debug('nc:api:base');

const IGNORE_TABLES = [
  'nc_models',
  'nc_roles',
  'nc_routes',
  'nc_loaders',
  'nc_resolvers',
  'nc_hooks',
  'nc_store',
  '_evolutions',
  'nc_evolutions',
  'xc_users',
  'nc_rpc',
  'nc_acl',
  'nc_cron',
  'nc_disabled_models_for_role',
  'nc_audit',
  'xc_knex_migrations',
  'xc_knex_migrations_lock',
  'nc_plugins',
  'nc_migrations',
  'nc_api_tokens',
  'nc_projects',
  'nc_projects_users',
  'nc_relations',
  'nc_shared_views'
];


export default abstract class BaseApiBuilder<T extends Noco> implements XcDynamicChanges {
  public get knex(): XKnex {
    return this.sqlClient?.knex || this.dbDriver;
  }

  public get apiType(): string {
    return this.connectionConfig?.meta?.api?.type;
  }

  public get apiPrefix(): string {
    return this.connectionConfig?.meta?.api?.prefix;
  }

  public get dbAlias(): any {
    return this.connectionConfig?.meta?.dbAlias;
  }

  public get router(): Router {
    if (!this.apiRouter) {
      this.baseLog(`router : Initializing builder router`)
      this.apiRouter = Router();
      // (this.app as any).router.use('/', this.apiRouter)
      (this.projectBuilder as any).router.use('/', this.apiRouter)
    }
    return this.apiRouter;
  }

  public get routeVersionLetter(): string {
    return this.connectionConfig?.meta?.api?.prefix || 'v1'
  }


  protected get projectId(): string {
    return this.projectBuilder?.id;
  }


  public get xcModels() {
    return this.models;
  }

  public readonly app: T;

  public hooks: {
    [key: string]: {
      [key: string]: Array<{
        event: string;
        url: string;
        [key: string]: any;
      }>
    }
  }
  protected tablesCount = 0;
  protected relationsCount = 0;
  protected viewsCount = 0;
  protected functionsCount = 0;
  protected proceduresCount = 0;

  protected projectBuilder: NcProjectBuilder;

  protected models: { [key: string]: BaseModelSql };

  protected metas: { [key: string]: any };

  protected sqlClient: MysqlClient | PgClient | SqlClient | any;

  protected dbDriver: XKnex;
  protected config: NcConfig;
  protected connectionConfig: DbConfig;
  protected cronJob: XcCron;

  protected acls: Acls;
  protected procedureOrFunctionAcls: {
    [name: string]: { [role: string]: boolean }
  };
  protected xcMeta: NcMetaIO;

  private apiRouter: Router;

  constructor(app: T, projectBuilder: NcProjectBuilder, config: NcConfig, connectionConfig: DbConfig) {
    this.models = {};
    this.app = app;
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.metas = {};
    this.acls = {};
    this.procedureOrFunctionAcls = {};
    this.hooks = {};
    this.projectBuilder = projectBuilder;

  }

  public getDbType(): any {
    return this.connectionConfig.client;
  }

  public getDbName(): any {
    return (this.connectionConfig.connection as any)?.database;
  }

  public getDbAlias(): any {
    return this.connectionConfig?.meta?.dbAlias;
  }

  public getSqlClient(): any {
    return this.sqlClient;
  }

  public abstract onTableCreate(tn: string, args?: any): Promise<void>  ;

  public abstract onViewCreate(viewName: string): Promise<void>  ;

  public abstract onFunctionCreate(functionName: string): Promise<void>  ;

  public abstract onProcedureCreate(procedureName: string): Promise<void>  ;

  public abstract onViewDelete(viewName: string): Promise<void> ;

  public abstract onProcedureDelete(procedureName: string): Promise<void> ;

  public abstract onFunctionDelete(functionName: string): Promise<void> ;

  public abstract onPolicyUpdate(tn: string): Promise<void> ;

  public abstract onHandlerCodeUpdate(tn: string): Promise<void> ;

  public abstract onMiddlewareCodeUpdate(tn: string): Promise<void> ;

  public abstract onToggleModels(enabledModels: string[]): Promise<void> ;

  public abstract onToggleModelRelation(relationInModels: any): Promise<void> ;

  public async onTableDelete(tn: string): Promise<void> {
    this.baseLog(`onTableDelete : '%s'`, tn)
    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));
    return this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_relations', null, {
      _or: [{
        tn: {
          eq: tn
        }
      }, {
        rtn: {
          eq: tn
        }
      },]
    })
    await this.deleteTableNameInACL(tn)
  }


  public async onRelationCreate(tnp: string, tnc: string, args?: any): Promise<void> {
    const {
      childColumn,
      onDelete,
      onUpdate,
      parentColumn,
      virtual
    } = args;

    XcCache.del([this.projectId, this.dbAlias, 'table', tnp].join('::'));
    XcCache.del([this.projectId, this.dbAlias, 'table', tnc].join('::'));

    if (!virtual) {
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_relations', {
        tn: tnc,
        _tn: this.getTableNameAlias(tnc),
        cn: childColumn,
        rtn: tnp,
        _rtn: this.getTableNameAlias(tnp),
        rcn: parentColumn,
        type: 'real',
        db_type: this.connectionConfig?.client,
        dr: onDelete,
        ur: onUpdate,
      })
    }

  }

  public async onRelationDelete(tnp: string, tnc: string, args: any): Promise<void> {
    this.baseLog(`onRelationDelete : Within relation delete handler of '%s' => '%s'`, tnp, tnc);

    const {
      childColumn,
      parentColumn,
    } = args;

    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_relations', {
      tn: tnc,
      cn: childColumn,
      rtn: tnp,
      rcn: parentColumn,
      type: 'real',
      db_type: this.connectionConfig?.client
    })

    await this.deleteRelationInACL(tnp, tnc);

    XcCache.del([this.projectId, this.dbAlias, 'table', tnc].join('::'));
    XcCache.del([this.projectId, this.dbAlias, 'table', tnp].join('::'));
  }


  public async onTableRename(oldTableName: string, newTableName: string): Promise<void> {
    this.baseLog(`onTableRename : '%s' => '%s'`, oldTableName, newTableName);
    this.baseLog(`onTableRename : updating table name in hooks meta table - '%s' => '%s'`, oldTableName, newTableName);
    XcCache.del([this.projectId, this.dbAlias, 'table', oldTableName].join('::'));
    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
      tn: newTableName
    }, {
      tn: oldTableName
    })
    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
      rtn: newTableName
    }, {
      rtn: oldTableName
    })

    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_hooks', {
      tn: newTableName
    }, {
      tn: oldTableName
    })


    /* Update virtual views */
    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
      parent_model_title: newTableName,
    }, {'parent_model_title': oldTableName, type: 'vtable'})

    await this.loadHooks();

    await this.modifyTableNameInACL(oldTableName, newTableName);
  }

  public async onGqlSchemaUpdate(_tableName: string, _schema: string): Promise<void> {
    throw new Error('`onGqlSchemaUpdate` not implemented')
  }

  public async onValidationUpdate(tn: string): Promise<void> {
    this.baseLog(`onValidationUpdate : '%s'`, tn);
    const modelRow = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
      title: tn
    });

    if (!modelRow) {
      return;
    }

    const metaObj = JSON.parse(modelRow.meta);
    this.metas[tn] = metaObj;
    this.baseLog(`onValidationUpdate : Generating model instance for '%s' table`, tn)
    this.models[modelRow.title] = this.getBaseModel(metaObj);

    // todo: check tableAlias changed or not
    await this.onTableRename(tn, tn)
  }


  public async onTableUpdate(changeObj: any, beforeMetaUpdate?: (args: any) => Promise<void>): Promise<void> {
    const tn = changeObj.tn;
    this.baseLog(`onTableUpdate : '%s'`, tn);
    this.baseLog(`onTableUpdate : Getting old model meta for '%s'`, tn)
    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));

    const relationTableMetas: Set<any> = new Set();

    const oldModelRow = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
      title: tn
    });

    if (!oldModelRow) {
      return;
    }

    // todo : optimize db operations
    const columns = changeObj.columns
      .filter(c => c.altered !== 4)
      .map(({altered: _al, ...rest}) => rest) || await this.getColumnList(tn);

    /* Get all relations */
    const relations = await this.relationsSyncAndGet();
    const belongsTo = this.extractBelongsToRelationsOfTable(relations, tn);
    const hasMany = this.extractHasManyRelationsOfTable(relations, tn);


    const virtualViews = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_models', {
      condition: {
        type: 'vtable',
        parent_model_title: tn
      }
    });

    const virtualViewsParamsArr = virtualViews.map(v => {
      try {
        return JSON.parse(v.query_params);
      } catch (e) {
      }
      return {}
    })

    const ctx = this.generateContextForTable(tn, columns, [...hasMany, ...belongsTo], hasMany, belongsTo);

    this.baseLog(`onTableUpdate : Generating new model meta for '%s' table`, tn)

    /* create models from table */
    const newMeta = ModelXcMetaFactory.create(this.connectionConfig, {dir: '', ctx, filename: ''}).getObject();


    /* get ACL row  */
    const aclRow = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {tn});

    const acl = JSON.parse(aclRow.acl);
    const oldMeta = JSON.parse(oldModelRow.meta);
    const aclOper = [];

    this.baseLog(`onTableUpdate : Comparing and updating new metadata of '%s' table`, tn)
    for (const column of changeObj.columns) {
      let oldCol;
      let newCol;
      // column update
      if (column.altered === 8 || column.altered === 2) {


        oldCol = oldMeta.columns.find(c => c.cn === column.cno);
        newCol = newMeta.columns.find(c => c.cn === column.cn);
        if (newCol && oldCol && column.dt === oldCol.dt && !newCol?.validate?.func?.length) {
          newCol.validate = oldCol.validate;
        }

        if (column.cno !== column.cn) {

          // todo: populate alias
          newCol._cn = newCol.cn;

          await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
            cn: column.cn
          }, {
            cn: column.cno,
            tn
          })
          await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
            rcn: column.cn
          }, {
            rcn: column.cno,
            rtn: tn
          })

          aclOper.push(async () => this.modifyColumnNameInACL(tn, column.cno, column.cn));

          // virtual views param update
          for (const qp of virtualViewsParamsArr) {
            // @ts-ignore
            const {filters, sortList, showFields} = qp;
            /* update sort field */
            const s = sortList.find(v => v.field === column.cno);
            if (s) {
              s.field = column.cn;
            }
            /* update show field */
            if (column.cno in showFields) {
              showFields[column.cn] = showFields[column.cno];
              delete showFields[column.cno];
            }
            /* update filters */
            if (JSON.stringify(filters).includes(`"${column.cno}"`)) {
              filters.splice(0, filters.length);
            }
          }

          // update relation column name in meta data
          // update column name in belongs to
          if (newMeta.belongsTo?.length) {
            for (const bt of newMeta.belongsTo) {
              if (bt.cn === column.cno) {
                bt.cn = column.cn;
                bt._cn = column._cn;

                // update column name in parent table metadata
                relationTableMetas.add(this.metas[bt.rtn])
                for (const pHm of this.metas[bt.rtn]?.hasMany) {
                  if (pHm.cn === column.cno && pHm.tn === tn) {
                    pHm.cn = column.cn;
                    pHm._cn = column._cn;
                  }
                }
              }
            }
          }

          // update column name in has many
          if (newMeta.hasMany?.length) {
            for (const hm of newMeta.hasMany) {
              if (hm.rcn === column.cno) {
                hm.rcn = column.cn;
                hm._rcn = column._cn;

                // update column name in child table metadata
                relationTableMetas.add(this.metas[hm.tn])
                for (const cBt of this.metas[hm.tn]?.belongsTo) {
                  if (cBt.rcn === column.cno && cBt.rtn === tn) {
                    cBt.rcn = column.cn;
                    cBt._rcn = column._cn;
                  }
                }
              }
            }
          }
        }

        for (const permObj of Object.values(acl)) {
          for (const aclObj of Object.values(permObj)) {
            if (!aclObj.columns || typeof aclObj !== 'object') {
              continue;
            }
            if (oldCol.cn in aclObj.columns && oldCol.cn !== newCol.cn) {
              aclObj.columns[newCol.cn] = aclObj.columns[oldCol.cn];
              delete aclObj.columns[oldCol.cn];
            }
          }
        }

      } else if (column.altered === 4) {
        // handle delete col -- no change
        for (const permObj of Object.values(acl)) {
          for (const aclObj of Object.values(permObj)) {
            if (!aclObj.columns || typeof aclObj !== 'object') {
              continue;
            }
            if (column.cno in aclObj.columns) {
              delete aclObj.columns[column.cno];
            }
          }
        }

        aclOper.push(async () => this.deleteColumnNameInACL(tn, column.cno));


        // virtual views param update
        for (const qp of virtualViewsParamsArr) {
          // @ts-ignore
          const {filters, sortList, showFields} = qp;
          /* update sort field */
          const sIndex = sortList.findIndex(v => v.field === column.cno);
          if (sIndex > -1) {
            sortList.splice(sIndex, 1);
          }
          /* update show field */
          if (column.cno in showFields) {
            delete showFields[column.cno];
          }
          /* update filters */
          if (JSON.stringify(filters).includes(`"${column.cno}"`)) {
            filters.splice(0, filters.length);
          }
        }
      } else if (column.altered === 1) {
        // handle new col -- no change
        for (const permObj of Object.values(acl)) {
          for (const aclObj of Object.values(permObj)) {
            if (!aclObj.columns || typeof aclObj !== 'object') {
              continue;
            }
            aclObj.columns[column.cn] = true;
          }
        }
      } else {
        oldCol = oldMeta.columns.find(c => c.cn === column.cn);
        newCol = newMeta.columns.find(c => c.cn === column.cn);
        if (newCol && oldCol) {
          newCol.validate = oldCol.validate;
        }
      }

      for (let i = 0; i < virtualViewsParamsArr.length; i++) {
        await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
          query_params: JSON.stringify(virtualViewsParamsArr[i])
        }, virtualViews[i].id);
      }
    }

    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
      meta: JSON.stringify(newMeta)
    }, {
      title: tn
    });

    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
      acl: JSON.stringify(acl)
    }, {
      tn
    });

    this.acls[tn] = acl;

    if (beforeMetaUpdate) {
      await beforeMetaUpdate({
        ctx,
        meta: newMeta
      });
    }
    this.baseLog(`onTableUpdate : Generating model instance for '%s' table`, tn)

    this.models[tn] = this.getBaseModel(newMeta);


    await NcHelp.executeOperations(aclOper, this.connectionConfig.client);

    // update relation tables metadata
    for (const relMeta of relationTableMetas) {
      await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
        meta: JSON.stringify(relMeta)
      }, {
        title: relMeta.tn
      });
    }
  }


  public async onViewUpdate(viewName: string, beforeMetaUpdate?: (args: any) => Promise<void>): Promise<void> {
    this.baseLog(`onViewUpdate : '%s'`, viewName);
    this.baseLog(`onViewUpdate : Getting old model meta of '%s' view`, viewName)

    const oldModelRow = this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
      title: viewName
    });

    if (!oldModelRow) {
      return;
    }

    // todo : optimize db operations
    const columns = await this.getColumnList(viewName);


    const ctx = this.generateContextForTable(viewName, columns, [], [], [], 'view');

    this.baseLog(`onViewUpdate : Generating new model meta of '%s' view`, viewName)

    /* create models from table */
    const newMeta = ModelXcMetaFactory.create(this.connectionConfig, {dir: '', ctx, filename: ''}).getObject();

    this.baseLog(`onViewUpdate : Updating model meta of '%s' view`, viewName)

    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
      meta: JSON.stringify(newMeta)
    }, {
      title: viewName
    });

    if (beforeMetaUpdate) {
      await beforeMetaUpdate({
        ctx,
        meta: newMeta
      });
    }
    this.baseLog(`onViewUpdate : Generating model instance for '%s' table`, viewName)

    this.models[viewName] = this.getBaseModel(newMeta);


  }


  public getDbDriver(): XKnex {
    this.initDbDriver();
    return this.dbDriver;
  }


  public async onHooksUpdate(tn?: string): Promise<void> {
    this.baseLog(`onHooksUpdate : %s`, tn)
    await this.loadHooks();
  }

  public async restartCron(args): Promise<any> {
    this.baseLog(`restartCron :`,)
    await this.cronJob.restartCron(args);
  }

  public async removeCron(args): Promise<any> {
    this.baseLog(`removeCron :`,)
    await this.cronJob.removeCron(args);
  }


  public async xcUpgrade(): Promise<any> {
    this.baseLog(`xcUpgrade :`,)


    const NC_VERSIONS = [
      // {name: '0.6', handler: null},
      // {name: '0.7', handler: this.xcUpZeroPointSeven},
      // {name: '0.8', handler: this.xcUpZeroPointEight},
      // {name: '0.9', handler: this.xcUpZeroPointNine},
    ]
    const knex = this.getDbDriver();
    if (!await knex.schema.hasTable('nc_store')) {
      return;
    }
    this.baseLog(`xcUpgrade : Getting configuration from meta database`,)

    const config = await knex('nc_store').where({key: 'NC_CONFIG'}).first();
    if (config) {
      const configObj: NcConfig = JSON.parse(config.value);
      if (configObj.version !== process.env.NC_VERSION) {
        let start = false;
        for (const version of NC_VERSIONS) {
          if (start) {
            await version.handler()
          } else if (version.name === configObj.version) {
            start = true;
            // todo: take backup of current version
          }
          if (version.name === process.env.NC_VERSION) {
            break;
            // todo:
          }
        }
      }
    } else {

      this.baseLog(`xcUpgrade : Inserting config to meta database`,)
      const configObj: NcConfig = JSON.parse(JSON.stringify(this.config));
      delete configObj.envs;
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_store', {
        key: 'NC_CONFIG',
        value: JSON.stringify(configObj)
      });
    }
  }


  public async onAclUpdate(tn: string): Promise<any> {
    this.baseLog(`onAclUpdate : '%s'`, tn);
    this.baseLog(`onAclUpdate : Loading latest acl for '%s'`, tn)
    const aclRow = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {'tn': tn});
    if (aclRow) {
      if (aclRow.type === 'procedure' || aclRow.type === 'function') {
        this.procedureOrFunctionAcls[tn] = JSON.parse(aclRow.acl);
      } else {
        this.acls[tn] = JSON.parse(aclRow.acl);
      }
    }
  }

  // NOTE: xc-meta
  public async loadXcAcl(): Promise<any> {
    this.baseLog(`loadXcAcl :`);
    const aclRows = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl');
    for (const {acl, tn, type} of aclRows) {
      if (type === 'procedure' || type === 'function') {
        this.procedureOrFunctionAcls[tn] = JSON.parse(acl);
      } else {
        this.acls[tn] = JSON.parse(acl);
      }
    }
  }

  public getXcMeta() {
    return this.xcMeta;
  }


  public async xcTablesRowDelete(tn: string): Promise<void> {
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: tn
    });
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      parent_model_title: tn
    });
  }


  protected async loadCommon(): Promise<any> {
    this.baseLog(`loadCommon :`);

    this.cronJob = new XcCron(this.config, this as any, this.app as any);
    await this.cronJob.init();
  }


  protected initDbDriver(): void {
    if (!this.dbDriver) {
      if (this.connectionConfig?.connection?.ssl && typeof this.connectionConfig?.connection?.ssl === 'object') {
        if (this.connectionConfig.connection.ssl.caFilePath) {
          this.connectionConfig.connection.ssl.ca = fs
            .readFileSync(this.connectionConfig.connection.ssl.caFilePath)
            .toString();
        }
        if (this.connectionConfig.connection.ssl.keyFilePath) {
          this.connectionConfig.connection.ssl.key = fs
            .readFileSync(this.connectionConfig.connection.ssl.keyFilePath)
            .toString();
        }
        if (this.connectionConfig.connection.ssl.certFilePath) {
          this.connectionConfig.connection.ssl.cert = fs
            .readFileSync(this.connectionConfig.connection.ssl.certFilePath)
            .toString();
        }
      }

      const isSqlite = this.connectionConfig.client === 'sqlite3';
      this.baseLog(`initDbDriver : initializing db driver first time`)
      this.dbDriver = XKnex(isSqlite ?
        this.connectionConfig.connection as Knex.Config :
        {
          ...this.connectionConfig, connection: {
            ...this.connectionConfig.connection,
            typeCast(_field, next) {
              const res = next();
              if (res instanceof Buffer) {
                return [...res].map(v => ('00' + v.toString(16)).slice(-2)).join('');
              }
              return res;
            }
          }
        } as any);
      if (isSqlite) {
        this.dbDriver.raw(`PRAGMA journal_mode=WAL;`).then(() => {
        })
      }
    }
    if (!this.sqlClient) {

      this.sqlClient = SqlClientFactory.create(this.connectionConfig) as MysqlClient;
      // close knex connection in sqlclient and reuse existing connection
      this.sqlClient.knex.destroy();
      this.sqlClient.knex = this.getDbDriver();
      this.sqlClient.sqlClient = this.getDbDriver();
    }
  }


  // table alias functions
  protected getInflectedName(name: string, inflectionFns: string): string {
    if (inflectionFns && inflectionFns !== 'none') {
      return inflectionFns.split(',').reduce((out, fn) => inflection[fn](out), name);
    }
    return name;
  }

  protected async getColumnList(tn: string): Promise<any[]> {
    this.baseLog(`getColumnList : '%s'`, tn);
    let columns = await this.sqlClient.columnList({tn: tn});
    columns = columns.data.list;
    return columns;
  }


  protected async getRelationList(): Promise<any[]> {
    this.baseLog(`getRelationList :`);

    let relations = await this.sqlClient.relationListAll();
    relations = relations.data.list;
    return relations;
  }

  protected async getXcRelationList(): Promise<any[]> {
    this.baseLog(`getRelationList :`);

    const relations = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_relations');
    return relations;
  }

  protected extractHasManyRelationsOfTable(relations, tn: string, enabledModels?: string[]): any[] {
    this.baseLog(`extractHasManyRelationsOfTable : '%s'`, tn);
    const hasManyRel = relations.filter(r => (r.rtn === tn && (!enabledModels || enabledModels.includes(r.tn))));
    const hasMany = JSON.parse(JSON.stringify(hasManyRel));
    return hasMany;
  }


  protected extractBelongsToRelationsOfTable(relations: any[], tn: string, enabledModels?: string[]): any[] {
    this.baseLog(`extractBelongsToRelationsOfTable : '%s'`, tn);
    const belongsTo = JSON.parse(JSON.stringify(relations.filter(r => (r.tn === tn) && (!enabledModels || enabledModels.includes(r.rtn)))));
    return belongsTo;
  }


  protected generateContextForTable(tn: string, columns: any[], relations, hasMany: any[], belongsTo: any[], type = 'table', table_name_alias?: string): any {
    this.baseLog(`generateContextForTable : '%s' %s`, tn, type);

    for (const col of columns) {
      col._cn = this.getColumnNameAlias(col);
    }

    const tableNameAlias = table_name_alias || this.getTableNameAlias(tn);
    const ctx = {
      dbType: this.connectionConfig.client,
      tn,
      _tn: tableNameAlias,
      tn_camelize: inflection.camelize(tableNameAlias),
      tn_camelize_low: inflection.camelize(tableNameAlias, true),
      columns,
      relations,
      hasMany,
      belongsTo,
      dbAlias: '',
      routeVersionLetter: this.routeVersionLetter,
      type,
      project_id: this.projectId
    };
    return ctx;
  }


  private getColumnNameAlias(col, tableName?: string) {
    return this.metas?.[tableName]?.columns?.find(c => c.cn === col.cn)?._cn || col._cn || this.getInflectedName(col.cn, this.connectionConfig?.meta?.inflection?.cn);
  }

  protected getTableNameAlias(tn: string) {
    if (this.metas?.[tn]?._tn) {
      return this.metas?.[tn]?._tn;
    }
    const modifiedTableName = tn?.replace(/^(?=\d+)/, 'ISN___')
    return this.getInflectedName(modifiedTableName, this.connectionConfig?.meta?.inflection?.tn);
  }

  protected generateContextForHasMany(ctx, tnc: string): any {
    this.baseLog(`generateContextForHasMany : '%s' => '%s'`, ctx.tn, tnc);
    return {
      ...ctx,
      _tn: this.metas[ctx.tn]._tn,
      _ctn: this.metas[tnc]._tn,
      tnc: tnc,
      project_id: this.projectId
    };
  }


  protected generateContextForBelongsTo(ctx: any, rtn: string): any {
    this.baseLog(`generateContextForBelongsTo : '%s' => '%s'`, rtn, ctx.tn);
    return {
      ...ctx,
      rtn,
      _tn: this.metas[ctx.tn]._tn,
      _rtn: this.metas[rtn]._tn,
      project_id: this.projectId
    };
  }


  protected generateRendererArgs(ctx: any): any {
    this.baseLog(`generateRendererArgs : '%s'`, ctx.tn);
    return {dir: '', ctx, filename: ''};
  }


  protected getRelationTableNames(relations, newTablename: string, enabledTableList?: string[]): string[] {
    this.baseLog(`getRelationTableNames : '%s'`, newTablename);
    const relatedTableList = [];

    // get all relation table names
    for (const r of relations) {
      if (newTablename === r.tn && (!enabledTableList || enabledTableList.includes(r.rtn))) {
        if (!relatedTableList.includes(r.rtn)) {
          relatedTableList.push(r.rtn)
        }
      } else if (newTablename === r.rtn && (!enabledTableList || enabledTableList.includes(r.tn))) {
        if (!relatedTableList.includes(r.tn)) {
          relatedTableList.push(r.tn)
        }
      }
    }
    return relatedTableList;
  }

  protected filterRelationsForTable(relations: any[], tn: string, enabledModels?: string[]): any[] {
    this.baseLog(`filterRelationsForTable : '%s'`, tn);
    const tableRelations = relations.filter(r => (
        (r.tn === tn && (!enabledModels || enabledModels.includes(r.rtn)))
        || (r.rtn === tn && (!enabledModels || enabledModels.includes(r.tn)))
      )
    );
    return tableRelations;
  }


  protected getBaseModel(meta): BaseModelSql {
    this.baseLog(`getBaseModel : '%s'`);
    return new BaseModel({
      dbDriver: this.dbDriver,
      ...meta,
      dbModels: this.models
    }, this);
  }

  // NOTE: xc-meta
  protected async loadHooks(): Promise<void> {
    this.baseLog(`loadHooks :`);
    this.hooks = {};
    const hooksList = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_hooks');

    for (const hook of hooksList) {
      if (!(hook.tn in this.hooks)) {
        this.hooks[hook.tn] = {};
      }
      try {
        hook.condition = hook.condition && JSON.parse(hook.condition);
        hook.notification = hook.notification && JSON.parse(hook.notification);
      } catch (e) {
      }
      const key = `${hook.event}.${hook.operation}`;
      this.hooks[hook.tn][key] = this.hooks[hook.tn][key] || [];
      this.hooks[hook.tn][key].push(hook);
    }
  }

  protected async generateAndSaveAcl(name: string, type = 'table'): Promise<void> {
    this.baseLog(`generateAndSaveAcl : '%s' %s`, name, type);

    if (type === 'procedure' || type === 'function') {
      this.baseLog(`generateAndSaveAcl : Generating and inserting '%s' %s acl`, name, type);

      this.procedureOrFunctionAcls[name] = {creator: true, editor: true, guest: false};
      /* create nc_models and its rows if it doesn't exists  */
      if (!(await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {'tn': name}))) {
        await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
          acl: JSON.stringify(this.procedureOrFunctionAcls[name]),
          type
        });
      }
    } else {
      this.baseLog(`generateAndSaveAcl : Generating and inserting '%s' %s acl`, name, type);
      this.acls[name] = new ExpressXcPolicy({dir: '', ctx: {type}, filename: ''}).getObject();

      /* create nc_models and its rows if it doesn't exists  */
      if (!(await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {'tn': name}))) {
        await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
          acl: JSON.stringify(this.acls[name]),
          type
        })
      }
    }
  }

  // NOTE: xc-meta
  protected async readXcModelsAndGroupByType() {

    this.baseLog(`readXcModelsAndGroupByType : `);
    const metaArr = (await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_models'))

    const enabledModels = [];

    const tableAndViewArr = [];
    const functionArr = [];
    const procedureArr = [];

    this.tablesCount = 0;
    this.proceduresCount = 0;
    this.functionsCount = 0;
    this.viewsCount = 0;
    this.relationsCount = 0;

    this.baseLog(`readXcModelsAndGroupByType : Iterating and grouping enabled models`)

    for (const obj of metaArr) {

      if (obj.type === 'procedure') {
        if (obj.enabled) {
          procedureArr.push(JSON.parse(obj.meta));
        }
        this.proceduresCount++;
      } else if (obj.type === 'function') {
        if (obj.enabled) {
          functionArr.push(JSON.parse(obj.meta));
        }
        this.functionsCount++;
      } else if (obj.type !== 'vtable') {
        this.metas[obj.title] = JSON.parse(obj.meta);
        if (obj.enabled) {
          enabledModels.push(obj.title);
        }
        tableAndViewArr.push(obj);
        if (obj.type === 'view') {
          this.viewsCount++;
        } else {
          this.tablesCount++;
        }
      }
    }
    return {metaArr, enabledModels, tableAndViewArr, functionArr, procedureArr};
  }


  protected async relationsSyncAndGet(): Promise<any> {

    // check if relations already synced
    let relations = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_relations', {
      fields: [
        'ur',
        'tn',
        '_tn',
        'cn',
        '_cn',
        'rtn',
        'rcn',
        '_rcn',
        '_rtn',
        'type',
        'db_type',
        'dr'
      ]
    });

    // check if relations already synced
    if (relations.length) {
      this.relationsCount = relations.length;
      return relations
    }

    relations = (await this.sqlClient.relationListAll())?.data?.list;
    this.relationsCount = relations.length;

    // check if relations already synced
    if ((await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_relations')).length) {
      return relations
    }

    // todo: insert parallelly
    for (const relation of relations) {
      relation.enabled = true;
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_relations', {
        tn: relation.tn,
        _tn: this.getTableNameAlias(relation.tn),
        cn: relation.cn,
        _cn: this.getColumnNameAlias({cn: relation.cn}, relation.tn),
        rtn: relation.rtn,
        _rtn: this.getTableNameAlias(relation.rtn),
        rcn: relation.rcn,
        _rcn: this.getColumnNameAlias({cn: relation.rcn}, relation.rtn),
        type: 'real',
        db_type: this.connectionConfig?.client,
        dr: relation?.dr,
        ur: relation?.ur,
      })
    }
    return relations;
  }

  protected async renameTableNameInXcRelations(oldTableName: string, newTableName: string): Promise<any> {
    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
      tn: newTableName
    }, {tn: oldTableName});

    await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_relations', {
      rtn: newTableName
    }, {rtn: oldTableName});
  }

  private baseLog(str, ...args): void {
    log(`${this.dbAlias} : ${str}`, ...args);
  }


  private async modifyTableNameInACL(oldName: string, newName: string): Promise<void> {
    if (oldName === newName) {
      return;
    }


    const replaceTableName = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }

      for (const [key, value] of (Object.entries(obj) as any)) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === oldName) {
            delete obj[key];
            obj[newName] = value;
          }

          replaceTableName(value)
        }
      }
    };


    const acls = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl', {
      xcCondition: {
        acl: {
          like: '%"custom":%'
        }
      }
    })

    for (const aclRow of acls) {
      const aclObj = JSON.parse(aclRow.acl);
      for (const aclOps of Object.values(aclObj)) {
        if (typeof aclOps === 'boolean') {
          continue;
        }

        for (const acl of (Object.values(aclOps) as any[])) {
          if (typeof acl === 'boolean') {
            continue;
          }

          if ('custom' in acl) {
            replaceTableName(acl.custom)
          }
        }
      }

      await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
        acl: JSON.stringify(aclObj)
      }, {
        id: aclRow.id
      });

    }


  }

  // @ts-ignore
  private async deleteTableNameInACL(table: string) {
    const replaceTableName = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }

      for (const [key, value] of (Object.entries(obj) as any)) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            delete obj[key];
          }
          replaceTableName(value)
        }
      }
    };


    const acls = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl', {
      xcCondition: {
        acl: {
          like: '%"custom":%'
        }
      }
    })

    for (const aclRow of acls) {
      const aclObj = JSON.parse(aclRow.acl);
      for (const aclOps of Object.values(aclObj)) {
        if (typeof aclOps === 'boolean') {
          continue;
        }
        for (const acl of (Object.values(aclOps) as any[])) {
          if (typeof acl === 'boolean') {
            continue;
          }
          if ('custom' in acl) {
            replaceTableName(acl.custom)
          }
        }
      }

      await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
        acl: JSON.stringify(aclObj)
      }, {
        id: aclRow.id
      });
    }
  }


  private async modifyColumnNameInACL(table: string, oldName: string, newName: string): Promise<void> {
    this.baseLog(`modifyColumnNameInACL : '${oldName}' =>  '${newName}',  table : '${table}'`)

    if (oldName === newName) {
      return;
    }

    const findColumnAndRename = (obj) => {
      if (!obj) {
        return;
      }
      if ('_and' in obj) {
        for (const o of obj._and) {
          findColumnAndRename(o)
        }
      }
      if ('_or' in obj) {
        for (const o of obj._or) {
          findColumnAndRename(o)
        }
      }
      if ('_not' in obj) {
        findColumnAndRename(obj._not)
      }

      if (oldName in obj) {
        obj[newName] = obj[oldName];
        delete obj[oldName];
      }
    }

    const replaceColumnName = (obj) => {

      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of (Object.entries(obj) as any)) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            findColumnAndRename(value);
          }
        }
        replaceColumnName(value)
      }
    };


    const acls = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl', {
      xcCondition: {
        acl: {
          like: '%"custom":%'
        }
      }
    });

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {

          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of (Object.values(aclOps) as any[])) {

            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl) {
              replaceColumnName(acl.custom);
              findColumnAndRename(acl.custom);
            }

          }
        }


        await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
          acl: JSON.stringify(aclObj)
        }, {
          id: aclRow.id
        });
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }

    await this.loadXcAcl();
  }

  private async deleteColumnNameInACL(table: string, cn: string): Promise<void> {
    this.baseLog(`deleteColumnNameInACL : '${cn}' in '${table}'`)

    const findColumnAndRename = (obj) => {
      if (!obj) {
        return;
      }
      if ('_and' in obj) {
        for (const o of obj._and) {
          findColumnAndRename(o)
        }
      }
      if ('_or' in obj) {
        for (const o of obj._or) {
          findColumnAndRename(o)
        }
      }
      if ('_not' in obj) {
        findColumnAndRename(obj._not)
      }

      if (cn in obj) {
        delete obj[cn];
      }
    }

    const replaceColumnName = (obj) => {

      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of (Object.entries(obj) as any)) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            findColumnAndRename(value);
          }
        }
        replaceColumnName(value)
      }
    };


    const acls = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl', {
      xcCondition: {
        acl: {
          like: '%"custom":%'
        }
      }
    });

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {

          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of (Object.values(aclOps) as any[])) {

            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl) {
              replaceColumnName(acl.custom);
              findColumnAndRename(acl.custom);
            }

          }
        }


        await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
          acl: JSON.stringify(aclObj)
        }, {
          id: aclRow.id
        });
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }

    await this.loadXcAcl()
  }

  private async deleteRelationInACL(parentTable: string, childTable: string): Promise<void> {

    this.baseLog(`deleteRelationInACL : '${parentTable}' => '${childTable}'`)
    const relationExist = (ancestor, obj, exist = false) => {

      if (!obj || typeof obj !== 'object') {
        return exist;
      }

      for (const [key, value] of (Object.entries(obj) as any)) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (ancestor === parentTable && key === childTable && value.relationType === 'hm') {
            return true
          }
          if (ancestor === childTable && key === parentTable && value.relationType === 'bt') {
            return true;
          }
          return exist || relationExist(value.relationType ? key : ancestor, value, exist);
        } else {
          return exist || relationExist(ancestor, value, exist)
        }
      }

      return exist;
    }

    const acls = await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_acl', {
      xcCondition: {
        acl: {
          like: '%"custom":%'
        }
      }
    });

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {

          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of (Object.values(aclOps) as any[])) {

            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl && relationExist(aclRow.tn, acl.custom)) {
              delete acl.custom;
            }

          }
        }


        await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_acl', {
          acl: JSON.stringify(aclObj)
        }, {
          id: aclRow.id
        });
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }
    await this.loadXcAcl()
  }

  public get client() {
    return this.connectionConfig?.client;
  }

  public getProjectId() {
    return this.projectId;
  }


  protected async getManyToManyRelations() {
    const metas = new Set<any>();

    for (const meta of Object.values(this.metas)) {

      // check if table is a Bridge table(or Associative Table) by checking
      // number of foreign keys and columns
      if (meta.belongsTo?.length === 2 && meta.columns.length < 4) {
        const tableMetaA = this.metas[meta.belongsTo[0].rtn];
        const tableMetaB = this.metas[meta.belongsTo[1].rtn];

        // add manytomany data under metadata of both related columns
        tableMetaA.manyToMany = tableMetaA.manyToMany || [];
        tableMetaA.manyToMany.push({
          "tn": tableMetaA.tn,
          "cn": meta.belongsTo[0].rcn,
          "vtn": meta.tn,
          "vcn": meta.belongsTo[0].cn,
          "vrcn": meta.belongsTo[1].cn,
          "rtn": meta.belongsTo[1].rtn,
          "rcn": meta.belongsTo[1].rcn,
          "_tn": tableMetaA._tn,
          "_cn": meta.belongsTo[0]._rcn,
          "_rtn": meta.belongsTo[1]._rtn,
          "_rcn": meta.belongsTo[1]._rcn
        })
        tableMetaB.manyToMany = tableMetaB.manyToMany || [];
        tableMetaB.manyToMany.push({
          "tn": tableMetaB.tn,
          "cn": meta.belongsTo[1].rcn,
          "vtn": meta.tn,
          "vcn": meta.belongsTo[1].cn,
          "vrcn": meta.belongsTo[0].cn,
          "rtn": meta.belongsTo[0].rtn,
          "rcn": meta.belongsTo[0].rcn,
          "_tn": tableMetaB._tn,
          "_cn": meta.belongsTo[1]._rcn,
          "_rtn": meta.belongsTo[0]._rtn,
          "_rcn": meta.belongsTo[0]._rcn
        })
        metas.add(tableMetaA)
        metas.add(tableMetaB)
      }
    }

    // Update metadata of tables which have manytomany relation
    // and recreate basemodel with new meta information
    for (const meta of metas) {
      await this.xcMeta.metaUpdate(this.projectId, this.dbAlias, 'nc_models', {
        meta: JSON.stringify(meta)
      }, {title: meta.tn})
      XcCache.del([this.projectId, this.dbAlias, 'table', meta.tn].join('::'));
      this.models[meta.tn] = this.getBaseModel(meta)
    }
  }

}

export {IGNORE_TABLES};

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
