// import * as fs from "fs";

import debug from 'debug';
import { Router } from 'express';
import inflection from 'inflection';
// import Knex from "knex";
import {
  MysqlClient,
  PgClient,
  SqlClient,
  // SqlClientFactory,
} from 'nc-help';

import XcDynamicChanges from '../../../interface/XcDynamicChanges';
import { Acls, DbConfig, NcConfig } from '../../../interface/config';
import { BaseModelSql, XKnex } from '../../db/sql-data-mapper';
import ModelXcMetaFactory from '../../db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import ExpressXcPolicy from '../../db/sql-mgr/code/policies/xc/ExpressXcPolicy';
import NcHelp from '../NcHelp';
import NcProjectBuilder from '../../v1-legacy/NcProjectBuilder';
import Noco from '../../Noco';
import NcMetaIO from '../../meta/NcMetaIO';
import XcCache from '../../v1-legacy/plugins/adapters/cache/XcCache';
import { Tele } from 'nc-help';

import BaseModel from './BaseModel';
import { XcCron } from './XcCron';
import NcConnectionMgr from './NcConnectionMgr';
import updateColumnNameInFormula from './helpers/updateColumnNameInFormula';
import addErrorOnColumnDeleteInFormula from './helpers/addErrorOnColumnDeleteInFormula';
import ncModelsOrderUpgrader from './jobs/ncModelsOrderUpgrader';
import ncParentModelTitleUpgrader from './jobs/ncParentModelTitleUpgrader';
import ncRemoveDuplicatedRelationRows from './jobs/ncRemoveDuplicatedRelationRows';
import xcMetaDiffSync from './handlers/xcMetaDiffSync';
import { UITypes } from 'nocodb-sdk';

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
  'nc_shared_views',
];

export default abstract class BaseApiBuilder<T extends Noco>
  implements XcDynamicChanges
{
  public abstract readonly type: string;

  public get knex(): XKnex {
    return this.sqlClient?.knex || this.dbDriver;
  }

  public get prefix() {
    return this.projectBuilder?.prefix;
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
      this.baseLog(`router : Initializing builder router`);
      this.apiRouter = Router();
      // (this.app as any).router.use('/', this.apiRouter)
      (this.projectBuilder as any).router.use('/', this.apiRouter);
    }
    return this.apiRouter;
  }

  public get routeVersionLetter(): string {
    return this.connectionConfig?.meta?.api?.prefix || 'v1';
  }

  protected get projectId(): string {
    return this.projectBuilder?.id;
  }

  public get xcModels() {
    return this.models;
  }

  public get client() {
    return this.connectionConfig?.client;
  }

  public readonly app: T;

  public hooks: {
    [tableName: string]: {
      [key: string]: Array<{
        event: string;
        url: string;
        [key: string]: any;
      }>;
    };
  };

  public formViews: {
    [tableName: string]: any;
  };

  protected tablesCount = 0;
  protected relationsCount = 0;
  protected viewsCount = 0;
  protected functionsCount = 0;
  protected proceduresCount = 0;

  protected projectBuilder: NcProjectBuilder;

  protected models: { [key: string]: BaseModelSql };

  protected metas: { [key: string]: NcMetaData };

  protected sqlClient: MysqlClient | PgClient | SqlClient | any;

  protected dbDriver: XKnex;
  protected config: NcConfig;
  protected connectionConfig: DbConfig;
  protected cronJob: XcCron;

  protected acls: Acls;
  protected procedureOrFunctionAcls: {
    [name: string]: { [role: string]: boolean };
  };
  protected xcMeta: NcMetaIO;

  private apiRouter: Router;

  constructor(
    app: T,
    projectBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig
  ) {
    this.models = {};
    this.app = app;
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.metas = {};
    this.acls = {};
    this.procedureOrFunctionAcls = {};
    this.hooks = {};
    this.formViews = {};
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
    return NcConnectionMgr.getSqlClient({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      projectId: this.projectId,
    });
  }

  public abstract onViewCreate(viewName: string): Promise<void>;

  public abstract onFunctionCreate(functionName: string): Promise<void>;

  public abstract onProcedureCreate(procedureName: string): Promise<void>;

  public abstract onViewDelete(viewName: string): Promise<void>;

  public abstract onProcedureDelete(procedureName: string): Promise<void>;

  public abstract onFunctionDelete(functionName: string): Promise<void>;

  public abstract onPolicyUpdate(tn: string): Promise<void>;

  public abstract onHandlerCodeUpdate(tn: string): Promise<void>;

  public abstract onMiddlewareCodeUpdate(tn: string): Promise<void>;

  public abstract onToggleModels(enabledModels: string[]): Promise<void>;

  public abstract onToggleModelRelation(relationInModels: any): Promise<void>;

  public async onTableDelete(
    tn: string,
    extras?: {
      ignoreVirtualRelations?: boolean;
      ignoreRelations?: boolean;
      ignoreViews?: boolean;
    }
  ): Promise<void> {
    this.baseLog(`onTableDelete : '%s'`, tn);
    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));
    if (!extras?.ignoreRelations)
      await this.xcMeta.metaDelete(
        this.projectId,
        this.dbAlias,
        'nc_relations',
        null,
        {
          _and: [
            {
              _or: [
                {
                  tn: {
                    eq: tn,
                  },
                },
                {
                  rtn: {
                    eq: tn,
                  },
                },
              ],
            },
            ...(extras?.ignoreVirtualRelations
              ? [{ type: { neq: 'virtual' } }]
              : []),
          ],
        }
      );

    await this.deleteTableNameInACL(tn);

    await this.xcMeta.metaDelete(
      this.projectId,
      this.dbAlias,
      'nc_shared_views',
      {
        model_name: tn,
      }
    );
    if (delete this.metas[tn]) delete this.metas[tn];
    if (delete this.models[tn]) delete this.models[tn];
  }

  public async onRelationCreate(
    tnp: string,
    tnc: string,
    args?: any
  ): Promise<void> {
    const {
      childColumn,
      onDelete,
      onUpdate,
      parentColumn,
      virtual,
      foreignKeyName: fkn,
    } = args;

    XcCache.del([this.projectId, this.dbAlias, 'table', tnp].join('::'));
    XcCache.del([this.projectId, this.dbAlias, 'table', tnc].join('::'));

    if (!virtual) {
      await this.xcMeta.metaInsert(
        this.projectId,
        this.dbAlias,
        'nc_relations',
        {
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
          fkn,
        }
      );
    } else {
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_relations',
        {
          _tn: this.getTableNameAlias(tnc),
          _rtn: this.getTableNameAlias(tnp),
        },
        {
          tn: tnc,
          cn: childColumn,
          rtn: tnp,
          rcn: parentColumn,
        }
      );
    }
    Tele.emit('evt', { evt_type: 'relation:created' });
  }

  public async onRelationDelete(
    tnp: string,
    tnc: string,
    args: any
  ): Promise<void> {
    this.baseLog(
      `onRelationDelete : Within relation delete handler of '%s' => '%s'`,
      tnp,
      tnc
    );

    const { childColumn, parentColumn } = args;

    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_relations', {
      tn: tnc,
      cn: childColumn,
      rtn: tnp,
      rcn: parentColumn,
      type: 'real',
      db_type: this.connectionConfig?.client,
    });

    await this.deleteRelationInACL(tnp, tnc);

    XcCache.del([this.projectId, this.dbAlias, 'table', tnc].join('::'));
    XcCache.del([this.projectId, this.dbAlias, 'table', tnp].join('::'));

    for (const tn of [tnc, tnp]) {
      const { virtualViews, virtualViewsParamsArr } =
        await this.extractSharedAndVirtualViewsParams(tn);

      // extract alias of relation virtual column
      const relation = tnc === tn ? 'bt' : 'hm';
      const alias = this.getMeta(tn)?.v?.find(
        (v) => v?.[relation]?.tn === tnc && v?.[relation]?.rtn === tnp
      )?._cn;

      // virtual views param update
      for (const qp of virtualViewsParamsArr) {
        // @ts-ignore
        const { showFields = {}, fieldsOrder, extraViewParams = {} } = qp;

        /* update show field */
        if (alias in showFields) {
          delete showFields[alias];
        }

        /* update fieldsOrder */
        const index = fieldsOrder.indexOf(alias);
        if (index > -1) {
          fieldsOrder.splice(index, 1);
        }

        /* update formView params */
        //  extraViewParams.formParams.fields
        if (extraViewParams?.formParams?.fields?.[alias]) {
          delete extraViewParams.formParams.fields[alias];
        }
      }
      await this.updateSharedAndVirtualViewsParams(
        virtualViewsParamsArr,
        virtualViews
      );
    }
  }

  private async updateSharedAndVirtualViewsParams(
    virtualViewsParamsArr: any[],
    virtualViews: any[]
  ) {
    // update virtual views params
    for (let i = 0; i < virtualViewsParamsArr.length; i++) {
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          query_params: JSON.stringify(virtualViewsParamsArr[i]),
        },
        virtualViews[i].id
      );
    }
  }

  private async extractSharedAndVirtualViewsParams(tn: string) {
    const virtualViews = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        condition: {
          type: 'vtable',
          parent_model_title: tn,
        },
      }
    );
    const virtualViewsParamsArr = virtualViews.map((v) => {
      try {
        return JSON.parse(v.query_params);
      } catch (e) {}
      return {};
    });

    return {
      virtualViews,
      virtualViewsParamsArr,
    };
  }

  public async onTableRename(
    oldTableName: string,
    newTableName: string
  ): Promise<void> {
    this.baseLog(`onTableRename : '%s' => '%s'`, oldTableName, newTableName);
    this.baseLog(
      `onTableRename : updating table name in hooks meta table - '%s' => '%s'`,
      oldTableName,
      newTableName
    );
    XcCache.del(
      [this.projectId, this.dbAlias, 'table', oldTableName].join('::')
    );
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        tn: newTableName,
      },
      {
        tn: oldTableName,
      }
    );
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        rtn: newTableName,
      },
      {
        rtn: oldTableName,
      }
    );

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_hooks',
      {
        tn: newTableName,
      },
      {
        tn: oldTableName,
      }
    );

    /* Update virtual views */
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        parent_model_title: newTableName,
      },
      { parent_model_title: oldTableName, type: 'vtable' }
    );

    await this.loadHooks();
    await this.loadFormViews();

    await this.modifyTableNameInACL(oldTableName, newTableName);
  }

  public async onTableAliasRename(
    oldTableAliasName: string,
    newTableAliasName: string
  ): Promise<any> {
    this.baseLog(
      `onTableAliasRename : '%s' => '%s'`,
      oldTableAliasName,
      newTableAliasName
    );
    this.baseLog(
      `onTableAliasRename : updating table name in hooks meta table - '%s' => '%s'`,
      oldTableAliasName,
      newTableAliasName
    );

    const tableName =
      this.getTableName(oldTableAliasName) ||
      this.getTableName(newTableAliasName);

    XcCache.del([this.projectId, this.dbAlias, 'table', tableName].join('::'));
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        _rtn: newTableAliasName,
      },
      {
        _rtn: oldTableAliasName,
      }
    );

    const meta = this.metas[tableName];
    meta._tn = newTableAliasName;

    if (oldTableAliasName === newTableAliasName) {
      return;
    }

    // delete old model
    delete this.models[tableName];

    // todo: update virtual columns

    // const rootPath = `/api/${ctx.routeVersionLetter}/${ctx._tn}`;

    const relatedTableList = new Set<string>();

    // update in hasMany
    for (const hm of meta.hasMany || []) {
      hm._rtn = newTableAliasName;
      relatedTableList.add(hm.tn);
    }
    // update in belongsTo
    for (const bt of meta.belongsTo || []) {
      bt._tn = newTableAliasName;
      relatedTableList.add(bt.rtn);
    }

    // update in MnyToMany
    for (const mm of meta.manyToMany || []) {
      mm._tn = newTableAliasName;
      relatedTableList.add(mm.rtn);
    }

    for (const v of meta.v || []) {
      if (v?.hm?._rtn) v.hm._rtn = newTableAliasName;
      else if (v?.bt?._tn) v.bt._tn = newTableAliasName;
      else if (v?.mm?._tn) v.mm._tn = newTableAliasName;
      else if (v?.lk) {
        if (v?.lk.type === 'hm') {
          v.lk._rtn = newTableAliasName;
        } else if (v?.lk.type === 'bt' || v.lk.type === 'mm') {
          v.lk._tn = newTableAliasName;
        }
      } else if (v?.rl) {
        if (v.rl === 'hm') {
          v.rl._rtn = newTableAliasName;
        } else if (v.rl.type === 'bt' || v.rl.type === 'mm') {
          v.rl._tn = newTableAliasName;
        }
      }
      // todo: lookup and rollup
    }

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        _tn: newTableAliasName,
      },
      {
        _tn: oldTableAliasName,
      }
    );
    /* Update meta data */
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        meta: JSON.stringify(meta),
        alias: newTableAliasName,
      },
      { title: tableName, type: 'table' }
    );

    for (const relTableName of relatedTableList) {
      const meta = this.getMeta(relTableName);
      // update in hasMany
      for (const hm of meta.hasMany || []) {
        if (hm.tn !== tableName) continue;
        hm._tn = newTableAliasName;
      }
      // update in belongsTo
      for (const bt of meta.belongsTo || []) {
        if (bt.rtn !== tableName) continue;
        bt._rtn = newTableAliasName;
      }

      // update in MnyToMany
      for (const mm of meta.manyToMany || []) {
        if (mm.rtn !== tableName) continue;
        mm._rtn = newTableAliasName;
      }

      for (const v of meta.v || []) {
        if (v?.hm?.tn === tableName) v.hm._tn = newTableAliasName;
        else if (v?.bt?.rtn === tableName) v.bt._rtn = newTableAliasName;
        else if (v?.mm?.rtn === tableName) v.mm._rtn = newTableAliasName;
        else if (v?.lk?.ltn === tableName) {
          v.lk._ltn = newTableAliasName;
          if (v?.lk.type === 'hm') {
            v.lk._tn = newTableAliasName;
          } else if (v?.lk.type === 'bt' || v.lk.type === 'mm') {
            v.lk._rtn = newTableAliasName;
          }
        } else if (v?.rl?.rltn === tableName) {
          v.rl._rltn = newTableAliasName;
          if (v.rl?.type === 'hm') {
            v.rl._tn = newTableAliasName;
          } else if (v.rl.type === 'bt' || v.rl.type === 'mm') {
            v.rl._rtn = newTableAliasName;
          }
        }

        // todo: lookup and rollup
        // mm._tn = newTableAliasName;
        // relatedTableList.add(mm.rtn);
      }

      // todo: update virtual columns
      // todo: delete cache
      // todo: update in db

      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
        },
        {
          title: relTableName,
        }
      );

      XcCache.del(
        [this.projectId, this.dbAlias, 'table', relTableName].join('::')
      );
    }

    return { meta, relatedTableList, tableName };
    // await this.modifyTableNameInACL(oldTableAliasName, newTableAliasName);
  }

  public async onGqlSchemaUpdate(
    _tableName: string,
    _schema: string
  ): Promise<void> {
    throw new Error('`onGqlSchemaUpdate` not implemented');
  }

  // todo: change name to meta uodate
  public async onMetaUpdate(tn: string): Promise<void> {
    this.baseLog(`onValidationUpdate : '%s'`, tn);
    const modelRow = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        title: tn,
        type: 'table',
      }
    );

    if (!modelRow) {
      return;
    }

    const metaObj = JSON.parse(modelRow.meta);
    this.metas[tn] = metaObj;
    this.baseLog(
      `onValidationUpdate : Generating model instance for '%s' table`,
      tn
    );
    this.models[modelRow.title] = this.getBaseModel(metaObj);

    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));

    // todo: check tableAlias changed or not
    // todo:
    // await this.onTableRename(tn, tn)
  }

  public async onTableUpdate(
    changeObj: any,
    beforeMetaUpdate?: (args: any) => Promise<void>
  ): Promise<void> {
    const tn = changeObj.tn;
    this.baseLog(`onTableUpdate : '%s'`, tn);
    this.baseLog(`onTableUpdate : Getting old model meta for '%s'`, tn);
    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));

    // get columns list from db
    const columnsFromDb = await this.getColumnList(tn);

    const relationTableMetas: Set<any> = new Set();

    const oldModelRow = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        title: tn,
      }
    );

    let queryParams: any;
    try {
      queryParams = JSON.parse(oldModelRow.query_params);
    } catch (e) {
      queryParams = {};
    }

    if (!oldModelRow) {
      return;
    }

    // todo : optimize db operations
    const columns =
      changeObj.columns
        .filter((c) => c.altered !== 4)
        .map(({ altered: _al, ...rest }) =>
          this.mergeUiColAndDbColMetas(
            rest,
            columnsFromDb?.find((c) => c.cn === rest.cn)
          )
        ) || (await this.getColumnList(tn));

    /* Get all relations */
    const relations = await this.relationsSyncAndGet();
    const belongsTo = this.extractBelongsToRelationsOfTable(relations, tn);
    const hasMany = this.extractHasManyRelationsOfTable(relations, tn);

    const { virtualViews, virtualViewsParamsArr } =
      await this.extractSharedAndVirtualViewsParams(tn);

    const ctx = this.generateContextForTable(
      tn,
      columns,
      [...hasMany, ...belongsTo],
      hasMany,
      belongsTo
    );

    this.baseLog(
      `onTableUpdate : Generating new model meta for '%s' table`,
      tn
    );

    /* create models from table */
    const newMeta: any = ModelXcMetaFactory.create(this.connectionConfig, {
      dir: '',
      ctx,
      filename: '',
    }).getObject();

    /* get ACL row  */
    const aclRow = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      { tn }
    );

    const acl = JSON.parse(aclRow.acl);
    const oldMeta = JSON.parse(oldModelRow.meta);

    // copy virtual columns and many to many relations from old meta to new
    newMeta.v = oldMeta.v;
    newMeta.manyToMany = oldMeta.manyToMany;

    const aclOper = [];

    this.baseLog(
      `onTableUpdate : Comparing and updating new metadata of '%s' table`,
      tn
    );
    for (const column of changeObj.columns) {
      let oldCol;
      let newCol;
      // column update
      if (column.altered === 8 || column.altered === 2) {
        oldCol = oldMeta.columns.find((c) => c.cn === column.cno);
        newCol = newMeta.columns.find((c) => c.cn === column.cn);
        if (
          newCol &&
          oldCol &&
          column.dt === oldCol.dt &&
          !newCol?.validate?.func?.length
        ) {
          newCol.validate = oldCol.validate;
        }

        // column rename
        if (column.cno !== column.cn) {
          updateColumnNameInFormula({
            virtualColumns: newMeta.v,
            oldColumnName: oldCol.cn,
            newColumnName: newCol.cn,
          });

          // todo: populate alias
          newCol._cn = newCol.cn;

          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_relations',
            {
              cn: column.cn,
            },
            {
              cn: column.cno,
              tn,
            }
          );
          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_relations',
            {
              rcn: column.cn,
            },
            {
              rcn: column.cno,
              rtn: tn,
            }
          );

          aclOper.push(async () =>
            this.modifyColumnNameInACL(tn, column.cno, column.cn)
          );

          // virtual views param update
          for (const qp of [queryParams, ...virtualViewsParamsArr]) {
            if (!qp) continue;
            // @ts-ignore
            const {
              filters,
              sortList,
              showFields = {},
              fieldsOrder,
              extraViewParams = {},
            } = qp;
            /* update sort field */
            const s = sortList?.find((v) => v.field === column.cno);
            if (s) {
              s.field = column.cn;
            }
            /* update show field */
            if (column.cno in showFields) {
              showFields[column.cn] = showFields[column.cno];
              delete showFields[column.cno];
            }
            /* update filters */
            if (
              filters &&
              JSON.stringify(filters).includes(`"${column.cno}"`)
            ) {
              filters.splice(0, filters.length);
            }

            /* update fieldsOrder */
            const index = fieldsOrder.indexOf(column.cno);
            if (index > -1) {
              fieldsOrder[index] = column.cn;
            }

            /* update formView params */
            //  extraViewParams.formParams.fields
            if (extraViewParams?.formParams?.fields?.[column.cno]) {
              extraViewParams.formParams.fields[column.cn] =
                extraViewParams.formParams.fields[column.cno];
              delete extraViewParams.formParams.fields[column.cno];
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
                relationTableMetas.add(this.metas[bt.rtn]);
                for (const pHm of this.metas[bt.rtn]?.hasMany) {
                  if (pHm.cn === column.cno && pHm.tn === tn) {
                    pHm.cn = column.cn;
                    pHm._cn = column._cn;
                  }
                }
              }

              // update lookup columns
              this.metas[bt.rtn].v?.forEach((v) => {
                if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cno) {
                  relationTableMetas.add(this.metas[bt.rtn]);
                  v.lk.lcn = column.cn;
                  v.lk._lcn = column._cn;
                }
              });
            }
          }

          // update column name in has many
          if (newMeta.hasMany?.length) {
            for (const hm of newMeta.hasMany) {
              if (hm.rcn === column.cno) {
                hm.rcn = column.cn;
                hm._rcn = column._cn;

                // update column name in child table metadata
                relationTableMetas.add(this.metas[hm.tn]);
                for (const cBt of this.metas[hm.tn]?.belongsTo) {
                  if (cBt.rcn === column.cno && cBt.rtn === tn) {
                    cBt.rcn = column.cn;
                    cBt._rcn = column._cn;
                  }
                }
              }

              // update lookup columns
              this.metas[hm.tn].v?.forEach((v) => {
                if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cno) {
                  relationTableMetas.add(this.metas[hm.tn]);
                  v.lk.lcn = column.cn;
                  v.lk._lcn = column._cn;
                }
              });
            }
          }

          // update column name in many to many
          if (newMeta.manyToMany?.length) {
            for (const mm of newMeta.manyToMany) {
              if (mm.cn === column.cno) {
                mm.cn = column.cn;
                mm._cn = column._cn;

                // update column name in child table metadata
                relationTableMetas.add(this.metas[mm.rtn]);
                for (const cMm of this.metas[mm.rtn]?.manyToMany) {
                  if (cMm.rcn === column.cno && cMm.rtn === tn) {
                    cMm.rcn = column.cn;
                    cMm._rcn = column._cn;
                  }
                }
              }

              // update lookup columns
              this.metas[mm.rtn].v?.forEach((v) => {
                if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cno) {
                  relationTableMetas.add(this.metas[mm.rtn]);
                  v.lk.lcn = column.cn;
                  v.lk._lcn = column._cn;
                }
              });
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

        addErrorOnColumnDeleteInFormula({
          virtualColumns: newMeta.v,
          columnName: column.cno,
        });

        aclOper.push(async () => this.deleteColumnNameInACL(tn, column.cno));

        // virtual views param update
        for (const qp of [...virtualViewsParamsArr]) {
          // @ts-ignore
          const {
            filters,
            sortList,
            showFields = {},
            fieldsOrder,
            extraViewParams = {},
          } = qp;
          /* update sort field */
          const sIndex = (sortList || []).findIndex(
            (v) => v.field === column.cno
          );
          if (sIndex > -1) {
            sortList.splice(sIndex, 1);
          }
          /* update show field */
          if (column.cno in showFields) {
            delete showFields[column.cno];
          }
          /* update filters */
          if (filters && JSON.stringify(filters)?.includes(`"${column.cno}"`)) {
            filters.splice(0, filters.length);
          }

          /* update fieldsOrder */
          const index = fieldsOrder.indexOf(column.cno);
          if (index > -1) {
            fieldsOrder.splice(index, 1);
          }

          /* update formView params */
          //  extraViewParams.formParams.fields
          if (extraViewParams?.formParams?.fields?.[column.cno]) {
            delete extraViewParams.formParams.fields[column.cno];
          }
        }

        // Delete lookup columns mapping to current column
        // update column name in belongs to
        if (newMeta.belongsTo?.length) {
          for (const bt of newMeta.belongsTo) {
            // filter out lookup columns which maps to current col
            this.metas[bt.rtn].v = this.metas[bt.rtn].v?.filter((v) => {
              if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cn) {
                relationTableMetas.add(this.metas[bt.rtn]);
                return false;
              }
              return true;
            });
          }
        }

        // update column name in has many
        if (newMeta.hasMany?.length) {
          for (const hm of newMeta.hasMany) {
            // filter out lookup columns which maps to current col
            this.metas[hm.tn].v = this.metas[hm.tn].v?.filter((v) => {
              if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cn) {
                relationTableMetas.add(this.metas[hm.tn]);
                return false;
              }
              return true;
            });
          }
        }

        // update column name in many to many
        if (newMeta.manyToMany?.length) {
          for (const mm of newMeta.manyToMany) {
            // filter out lookup columns which maps to current col
            this.metas[mm.rtn].v = this.metas[mm.rtn].v?.filter((v) => {
              if (v.lk && v.lk.ltn === tn && v.lk.lcn === column.cn) {
                relationTableMetas.add(this.metas[mm.rtn]);
                return false;
              }
              return true;
            });
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

        if (queryParams?.showFields) {
          queryParams.showFields[column.cno] = true;
        }
      } else {
        oldCol = oldMeta.columns.find((c) => c.cn === column.cn);
        newCol = newMeta.columns.find((c) => c.cn === column.cn);
        if (newCol && oldCol) {
          newCol.validate = oldCol.validate;
        }
      }
    }

    await this.updateSharedAndVirtualViewsParams(
      virtualViewsParamsArr,
      virtualViews
    );

    // update relation tables metadata
    for (const relMeta of relationTableMetas) {
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(relMeta),
        },
        {
          title: relMeta.tn,
        }
      );
      this.models[relMeta.tn] = this.getBaseModel(relMeta);
      XcCache.del(
        [this.projectId, this.dbAlias, 'table', relMeta.tn].join('::')
      );
    }

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        meta: JSON.stringify(newMeta),
        ...(queryParams ? { query_params: JSON.stringify(queryParams) } : {}),
      },
      {
        title: tn,
      }
    );
    XcCache.del([this.projectId, this.dbAlias, 'table', tn].join('::'));

    this.models[tn] = this.getBaseModel(newMeta);

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        acl: JSON.stringify(acl),
      },
      {
        tn,
      }
    );

    this.acls[tn] = acl;

    if (beforeMetaUpdate) {
      await beforeMetaUpdate({
        ctx,
        meta: newMeta,
      });
    }
    this.baseLog(
      `onTableUpdate : Generating model instance for '%s' table`,
      tn
    );

    await NcHelp.executeOperations(aclOper, this.connectionConfig.client);
  }

  protected mergeUiColAndDbColMetas(uiCol, dbCol) {
    return {
      ...(uiCol || {}),
      ...(dbCol || {}),
      // persist x props for single/multi select
      ...(uiCol?.uidt === UITypes.SingleSelect ||
      uiCol?.uidt === UITypes.MultiSelect
        ? {
            dtx: uiCol.dtx,
            dtxp: uiCol.dtxp,
            dtxs: uiCol.dtxs,
          }
        : {}),
    };
  }

  public async onViewUpdate(
    viewName: string,
    beforeMetaUpdate?: (args: any) => Promise<void>
  ): Promise<void> {
    this.baseLog(`onViewUpdate : '%s'`, viewName);
    this.baseLog(
      `onViewUpdate : Getting old model meta of '%s' view`,
      viewName
    );

    const oldModelRow = this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        title: viewName,
      }
    );

    if (!oldModelRow) {
      return;
    }

    // todo : optimize db operations
    const columns = await this.getColumnList(viewName);

    const ctx = this.generateContextForTable(
      viewName,
      columns,
      [],
      [],
      [],
      'view'
    );

    this.baseLog(
      `onViewUpdate : Generating new model meta of '%s' view`,
      viewName
    );

    /* create models from table */
    const newMeta = ModelXcMetaFactory.create(this.connectionConfig, {
      dir: '',
      ctx,
      filename: '',
    }).getObject();

    this.baseLog(`onViewUpdate : Updating model meta of '%s' view`, viewName);

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        meta: JSON.stringify(newMeta),
      },
      {
        title: viewName,
      }
    );

    if (beforeMetaUpdate) {
      await beforeMetaUpdate({
        ctx,
        meta: newMeta,
      });
    }
    this.baseLog(
      `onViewUpdate : Generating model instance for '%s' table`,
      viewName
    );

    this.models[viewName] = this.getBaseModel(newMeta);
  }

  public getDbDriver(): XKnex {
    this.initDbDriver();
    return this.dbDriver;
  }

  public async onHooksUpdate(tn?: string): Promise<void> {
    this.baseLog(`onHooksUpdate : %s`, tn);
    await this.loadHooks();
  }

  public async restartCron(args): Promise<any> {
    this.baseLog(`restartCron :`);
    await this.cronJob.restartCron(args);
  }

  public async removeCron(args): Promise<any> {
    this.baseLog(`removeCron :`);
    await this.cronJob.removeCron(args);
  }

  public async xcUpgrade(): Promise<any> {
    this.baseLog(`xcUpgrade :`);

    const NC_VERSIONS = [
      { name: '0009000', handler: null },
      { name: '0009044', handler: this.ncUpManyToMany.bind(this) },
      { name: '0083006', handler: ncModelsOrderUpgrader },
      { name: '0083007', handler: ncParentModelTitleUpgrader },
      { name: '0083008', handler: ncRemoveDuplicatedRelationRows },
      { name: '0084002', handler: this.ncUpAddNestedResolverArgs.bind(this) },
    ];
    if (!(await this.xcMeta?.knex?.schema?.hasTable?.('nc_store'))) {
      return;
    }
    this.baseLog(`xcUpgrade : Getting configuration from meta database`);

    const config = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_store',
      { key: 'NC_CONFIG' }
    );

    if (config) {
      const configObj: NcConfig = JSON.parse(config.value);
      if (configObj.version !== process.env.NC_VERSION) {
        for (const version of NC_VERSIONS) {
          // compare current version and old version
          if (version.name > configObj.version) {
            this.baseLog(
              `xcUpgrade : Upgrading '%s' => '%s'`,
              configObj.version,
              version.name
            );
            await version?.handler?.(<NcBuilderUpgraderCtx>{
              xcMeta: this.xcMeta,
              builder: this,
              dbAlias: this.dbAlias,
              projectId: this.projectId,
            });

            // update version in meta after each upgrade
            configObj.version = version.name;
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_store',
              {
                value: JSON.stringify(configObj),
              },
              {
                key: 'NC_CONFIG',
              }
            );

            // todo: backup data
          }
          if (version.name === process.env.NC_VERSION) {
            break;
          }
        }
        configObj.version = process.env.NC_VERSION;
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_store',
          {
            value: JSON.stringify(configObj),
          },
          {
            key: 'NC_CONFIG',
          }
        );
      }
    } else {
      this.baseLog(`xcUpgrade : Inserting config to meta database`);
      const configObj: NcConfig = JSON.parse(JSON.stringify(this.config));
      delete configObj.envs;
      const isOld = (
        await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_models')
      )?.length;
      configObj.version = isOld ? '0009000' : process.env.NC_VERSION;
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_store', {
        key: 'NC_CONFIG',
        value: JSON.stringify(configObj),
      });
      if (isOld) {
        await this.xcUpgrade();
      }
    }
  }

  public async onAclUpdate(tn: string): Promise<any> {
    this.baseLog(`onAclUpdate : '%s'`, tn);
    this.baseLog(`onAclUpdate : Loading latest acl for '%s'`, tn);
    const aclRow = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      { tn: tn }
    );
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
    const aclRows = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl'
    );
    for (const { acl, tn, type } of aclRows) {
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

  public async xcTablesRowDelete(tn: string, extras?: any): Promise<void> {
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: tn,
    });
    if (!extras?.ignoreViews)
      await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
        parent_model_title: tn,
      });
  }

  public async onVirtualRelationCreate(
    parentTable: string,
    childTable: string
  ): Promise<any> {
    return this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        _tn: this.getTableNameAlias(childTable),
        _rtn: this.getTableNameAlias(parentTable),
      },
      {
        tn: childTable,
        rtn: parentTable,
      }
    );
  }

  public async onManyToManyRelationCreate(
    parent: string,
    child: string,
    _args?: any
  ) {
    return this.getManyToManyRelations({ parent, child });
  }

  public async onManyToManyRelationDelete(
    parent: string,
    child: string,
    _args?: any
  ) {
    const parentMeta = this.metas[parent];
    const childMeta = this.metas[child];

    parentMeta.manyToMany = parentMeta.manyToMany.filter(
      (mm) =>
        !(
          (mm.tn === parent && mm.rtn === child) ||
          (mm.tn === child && mm.rtn === parent)
        )
    );
    childMeta.manyToMany = childMeta.manyToMany.filter(
      (mm) =>
        !(
          (mm.tn === parent && mm.rtn === child) ||
          (mm.tn === child && mm.rtn === parent)
        )
    );

    // filter lookup and relation virtual columns
    parentMeta.v = parentMeta.v.filter(
      ({ mm, ...rest }) =>
        (!mm ||
          !(
            (mm.tn === parent && mm.rtn === child) ||
            (mm.tn === child && mm.rtn === parent)
          )) &&
        // check for lookup
        !(
          rest.lk &&
          rest.lk.type === 'mm' &&
          ((rest.lk.tn === parent && rest.lk.rtn === child) ||
            (rest.lk.tn === child && rest.lk.rtn === parent))
        )
    );
    childMeta.v = childMeta.v.filter(
      ({ mm, ...rest }) =>
        (!mm ||
          !(
            (mm.tn === parent && mm.rtn === child) ||
            (mm.tn === child && mm.rtn === parent)
          )) &&
        // check for lookup
        !(
          rest.lk &&
          rest.lk.type === 'mm' &&
          ((rest.lk.tn === parent && rest.lk.rtn === child) ||
            (rest.lk.tn === child && rest.lk.rtn === parent))
        )
    );

    for (const meta of [parentMeta, childMeta]) {
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
        },
        { title: meta.tn }
      );
      XcCache.del([this.projectId, this.dbAlias, 'table', meta.tn].join('::'));
      this.models[meta.tn] = this.getBaseModel(meta);
    }

    // todo: many to many form view field update

    for (const [tnp, tnc] of [
      [parent, child],
      [child, parent],
    ]) {
      const { virtualViews, virtualViewsParamsArr } =
        await this.extractSharedAndVirtualViewsParams(tnp);

      const alias = this.getMeta(tnp)?.v?.find(
        (v) => v?.tn === tnp && v?.mm?.rtn === tnc
      )?._cn;

      // virtual views param update
      for (const qp of virtualViewsParamsArr) {
        // @ts-ignore
        const { showFields = {}, fieldsOrder, extraViewParams = {} } = qp;

        /* update show field */
        if (alias in showFields) {
          delete showFields[alias];
        }

        /* update fieldsOrder */
        const index = fieldsOrder.indexOf(alias);
        if (index > -1) {
          fieldsOrder.splice(index, 1);
        }

        /* update formView params */
        //  extraViewParams.formParams.fields
        if (extraViewParams?.formParams?.fields?.[alias]) {
          delete extraViewParams.formParams.fields[alias];
        }
      }

      await this.updateSharedAndVirtualViewsParams(
        virtualViewsParamsArr,
        virtualViews
      );
    }
  }

  public getProjectId(): string {
    return this.projectId;
  }

  public async init(): Promise<void> {
    await this.xcUpgrade();
  }

  public async onVirtualColumnAliasUpdate({
    tn,
    oldAlias,
    newAlias,
  }: any): Promise<void> {
    const model = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      { title: tn }
    );
    const meta = JSON.parse(model.meta);
    this.models[tn] = this.getBaseModel(meta);

    const virtualViews = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        condition: {
          type: 'vtable',
          parent_model_title: tn,
        },
      }
    );
    const virtualViewsParamsArr = virtualViews.map((v) => {
      try {
        return JSON.parse(v.query_params);
      } catch (e) {}
      return {};
    });

    for (const qp of [...virtualViewsParamsArr]) {
      if (!qp) continue;
      // @ts-ignore
      const { showFields = {}, fieldsOrder, extraViewParams = {} } = qp;
      /* update show field */
      if (oldAlias in showFields) {
        showFields[newAlias] = showFields[oldAlias];
        delete showFields[oldAlias];
      }

      /* update fieldsOrder */
      const index = fieldsOrder.indexOf(oldAlias);
      if (index > -1) {
        fieldsOrder[index] = newAlias;
      }

      /* update formView params */
      //  extraViewParams.formParams.fields
      if (extraViewParams?.formParams?.fields?.[oldAlias]) {
        extraViewParams.formParams.fields[newAlias] =
          extraViewParams.formParams.fields[oldAlias];
        delete extraViewParams.formParams.fields[oldAlias];
      }
    }

    await this.updateSharedAndVirtualViewsParams(
      virtualViewsParamsArr,
      virtualViews
    );
  }

  protected async loadCommon(): Promise<any> {
    this.baseLog(`loadCommon :`);

    this.cronJob = new XcCron(this.config, this as any, this.app as any);
    await this.cronJob.init();
  }

  protected initDbDriver(): void {
    this.dbDriver = NcConnectionMgr.get({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      projectId: this.projectId,
    });
    this.sqlClient = NcConnectionMgr.getSqlClient({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      projectId: this.projectId,
    });
    // if (!this.dbDriver) {
    //   if(this.projectBuilder?.prefix){
    //     this.dbDriver = this.xcMeta.knex
    //   }else {
    //     if (this.connectionConfig?.connection?.ssl && typeof this.connectionConfig?.connection?.ssl === 'object') {
    //       if (this.connectionConfig.connection.ssl.caFilePath) {
    //         this.connectionConfig.connection.ssl.ca = fs
    //           .readFileSync(this.connectionConfig.connection.ssl.caFilePath)
    //           .toString();
    //       }
    //       if (this.connectionConfig.connection.ssl.keyFilePath) {
    //         this.connectionConfig.connection.ssl.key = fs
    //           .readFileSync(this.connectionConfig.connection.ssl.keyFilePath)
    //           .toString();
    //       }
    //       if (this.connectionConfig.connection.ssl.certFilePath) {
    //         this.connectionConfig.connection.ssl.cert = fs
    //           .readFileSync(this.connectionConfig.connection.ssl.certFilePath)
    //           .toString();
    //       }
    //     }
    //
    //     const isSqlite = this.connectionConfig.client === 'sqlite3';
    //     this.baseLog(`initDbDriver : initializing db driver first time`)
    //     this.dbDriver = XKnex(isSqlite ?
    //       this.connectionConfig.connection as Knex.Config :
    //       {
    //         ...this.connectionConfig, connection: {
    //           ...this.connectionConfig.connection,
    //           typeCast(_field, next) {
    //             const res = next();
    //             if (res instanceof Buffer) {
    //               return [...res].map(v => ('00' + v.toString(16)).slice(-2)).join('');
    //             }
    //             return res;
    //           }
    //         }
    //       } as any);
    //     if (isSqlite) {
    //       this.dbDriver.raw(`PRAGMA journal_mode=WAL;`).then(() => {
    //       })
    //     }
    //   }
    // }
    // if (!this.sqlClient) {
    //   this.sqlClient = SqlClientFactory.create(this.connectionConfig) as MysqlClient;
    //   // close knex connection in sqlclient and reuse existing connection
    //   this.sqlClient.knex.destroy();
    //   this.sqlClient.knex = this.getDbDriver();
    //   this.sqlClient.sqlClient = this.getDbDriver();
    // }
  }

  // table alias functions
  protected getInflectedName(_name: string, inflectionFns: string): string {
    let name = _name;
    if (process.env.NC_INFLECTION) {
      inflectionFns = 'camelize';
    }

    if (inflectionFns && inflectionFns !== 'none') {
      name = inflectionFns
        .split(',')
        .reduce((out, fn) => inflection?.[fn]?.(out) || out, name);
    }
    return this.apiType === 'graphql' ? name.replace(/[^_\da-z]/gi, '_') : name;
  }

  protected async getColumnList(tn: string): Promise<any[]> {
    this.baseLog(`getColumnList : '%s'`, tn);
    let columns = await this.sqlClient.columnList({ tn });
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

    const relations = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_relations'
    );
    return relations;
  }

  protected extractHasManyRelationsOfTable(
    relations,
    tn: string,
    enabledModels?: string[]
  ): any[] {
    this.baseLog(`extractHasManyRelationsOfTable : '%s'`, tn);
    const hasManyRel = relations.filter(
      (r) => r.rtn === tn && (!enabledModels || enabledModels.includes(r.tn))
    );
    const hasMany = JSON.parse(JSON.stringify(hasManyRel));
    return hasMany;
  }

  protected extractBelongsToRelationsOfTable(
    relations: any[],
    tn: string,
    enabledModels?: string[]
  ): any[] {
    this.baseLog(`extractBelongsToRelationsOfTable : '%s'`, tn);
    const belongsTo = JSON.parse(
      JSON.stringify(
        relations.filter(
          (r) =>
            r.tn === tn && (!enabledModels || enabledModels.includes(r.rtn))
        )
      )
    );
    return belongsTo;
  }

  protected generateContextForMeta(meta: any): any {
    return this.generateContextForTable(
      meta.tn,
      meta.columns,
      [...meta.hasMany, ...meta.belongsTo],
      meta.hasMany,
      meta.belongsTo,
      'table',
      meta._tn
    );
  }

  protected generateContextForTable(
    tn: string,
    columns: any[],
    relations,
    hasMany: any[],
    belongsTo: any[],
    type = 'table',
    tableNameAlias?: string
  ): any {
    this.baseLog(`generateContextForTable : '%s' %s`, tn, type);

    for (const col of columns) {
      col._cn = col._cn || this.getColumnNameAlias(col);
    }

    // tslint:disable-next-line:variable-name
    const _tn = tableNameAlias || this.getTableNameAlias(tn);

    const ctx = {
      dbType: this.connectionConfig.client,
      tn,
      _tn,
      tn_camelize: inflection.camelize(_tn),
      tn_camelize_low: inflection.camelize(_tn, true),
      columns,
      relations,
      hasMany,
      belongsTo,
      dbAlias: '',
      routeVersionLetter: this.routeVersionLetter,
      type,
      project_id: this.projectId,
    };
    return ctx;
  }

  protected getTableNameAlias(tableName: string) {
    let tn = tableName;
    if (this.metas?.[tn]?._tn) {
      return this.metas?.[tn]?._tn;
    }

    if (this.projectBuilder?.prefix) {
      tn = tn.replace(this.projectBuilder?.prefix, '');
    }

    const modifiedTableName = tn?.replace(/^(?=\d+)/, 'ISN___');
    return this.getInflectedName(
      modifiedTableName,
      this.connectionConfig?.meta?.inflection?.tn
    );
  }

  protected getTableName(alias) {
    return Object.values(this.metas).find((m) => m._tn === alias)?.tn;
  }

  protected generateContextForHasMany(ctx, tnc: string): any {
    this.baseLog(`generateContextForHasMany : '%s' => '%s'`, ctx.tn, tnc);
    return {
      ...ctx,
      _tn: this.metas[ctx.tn]?._tn,
      _ctn: this.metas[tnc]?._tn,
      ctn: tnc,
      project_id: this.projectId,
    };
  }

  protected generateContextForBelongsTo(ctx: any, rtn: string): any {
    this.baseLog(`generateContextForBelongsTo : '%s' => '%s'`, rtn, ctx.tn);
    return {
      ...ctx,
      rtn,
      _tn: this.metas[ctx.tn]._tn,
      _rtn: this.metas[rtn]._tn,
      project_id: this.projectId,
    };
  }

  protected generateRendererArgs(ctx: any): any {
    this.baseLog(`generateRendererArgs : '%s'`, ctx.tn);
    return { dir: '', ctx, filename: '' };
  }

  protected getRelationTableNames(
    relations,
    newTablename: string,
    enabledTableList?: string[]
  ): string[] {
    this.baseLog(`getRelationTableNames : '%s'`, newTablename);
    const relatedTableList = [];

    // get all relation table names
    for (const r of relations) {
      if (
        newTablename === r.tn &&
        (!enabledTableList || enabledTableList.includes(r.rtn))
      ) {
        if (!relatedTableList.includes(r.rtn)) {
          relatedTableList.push(r.rtn);
        }
      } else if (
        newTablename === r.rtn &&
        (!enabledTableList || enabledTableList.includes(r.tn))
      ) {
        if (!relatedTableList.includes(r.tn)) {
          relatedTableList.push(r.tn);
        }
      }
    }
    return relatedTableList;
  }

  protected filterRelationsForTable(
    relations: any[],
    tn: string,
    enabledModels?: string[]
  ): any[] {
    this.baseLog(`filterRelationsForTable : '%s'`, tn);
    const tableRelations = relations.filter(
      (r) =>
        (r.tn === tn && (!enabledModels || enabledModels.includes(r.rtn))) ||
        (r.rtn === tn && (!enabledModels || enabledModels.includes(r.tn)))
    );
    return tableRelations;
  }

  protected getBaseModel(meta): BaseModelSql {
    this.baseLog(`getBaseModel : '%s'`);
    this.metas[meta.tn] = meta;
    return new BaseModel(
      {
        dbDriver: this.dbDriver,
        ...meta,
        dbModels: this.models,
      },
      this
    );
  }

  // NOTE: xc-meta
  protected async loadHooks(): Promise<void> {
    this.baseLog(`loadHooks :`);
    this.hooks = {};
    const hooksList = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_hooks'
    );

    for (const hook of hooksList) {
      if (!(hook.tn in this.hooks)) {
        this.hooks[hook.tn] = {};
      }
      try {
        hook.condition = hook.condition && JSON.parse(hook.condition);
        hook.notification = hook.notification && JSON.parse(hook.notification);
      } catch (e) {}
      const key = `${hook.event}.${hook.operation}`;
      this.hooks[hook.tn][key] = this.hooks[hook.tn][key] || [];
      this.hooks[hook.tn][key].push(hook);
    }
  }

  // NOTE: xc-meta
  public async loadFormViews(): Promise<void> {
    this.baseLog(`loadFormViews :`);
    this.formViews = {};
    const formViewList = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        condition: {
          show_as: 'form',
        },
      }
    );

    for (const formView of formViewList) {
      if (!(formView.parent_model_title in this.formViews)) {
        this.formViews[formView.parent_model_title] = {};
      }
      try {
        formView.query_params =
          formView.query_params && JSON.parse(formView.query_params);
      } catch (e) {}
      // this.formViews[formView.parent_model_title][formView.id] = formView;
      this.formViews[formView.parent_model_title][formView.title] = formView;
    }
  }

  protected async generateAndSaveAcl(
    name: string,
    type = 'table'
  ): Promise<void> {
    this.baseLog(`generateAndSaveAcl : '%s' %s`, name, type);

    if (type === 'procedure' || type === 'function') {
      this.baseLog(
        `generateAndSaveAcl : Generating and inserting '%s' %s acl`,
        name,
        type
      );

      this.procedureOrFunctionAcls[name] = {
        creator: true,
        editor: true,
        guest: false,
      };
      /* create nc_models and its rows if it doesn't exists  */
      if (
        !(await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
        }))
      ) {
        await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
          acl: JSON.stringify(this.procedureOrFunctionAcls[name]),
          type,
        });
      }
    } else {
      this.baseLog(
        `generateAndSaveAcl : Generating and inserting '%s' %s acl`,
        name,
        type
      );
      this.acls[name] = new ExpressXcPolicy({
        dir: '',
        ctx: { type },
        filename: '',
      }).getObject();

      /* create nc_models and its rows if it doesn't exists  */
      if (
        !(await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
        }))
      ) {
        await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_acl', {
          tn: name,
          acl: JSON.stringify(this.acls[name]),
          type,
        });
      }
    }
  }

  // NOTE: xc-meta
  protected async readXcModelsAndGroupByType() {
    this.baseLog(`readXcModelsAndGroupByType : `);
    const metaArr = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models'
    );

    const enabledModels = [];

    const tableAndViewArr = [];
    const functionArr = [];
    const procedureArr = [];

    this.tablesCount = 0;
    this.proceduresCount = 0;
    this.functionsCount = 0;
    this.viewsCount = 0;
    this.relationsCount = 0;

    this.baseLog(
      `readXcModelsAndGroupByType : Iterating and grouping enabled models`
    );

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
    return {
      metaArr,
      enabledModels,
      tableAndViewArr,
      functionArr,
      procedureArr,
    };
  }

  protected async relationsSyncAndGet(): Promise<any> {
    // check if relations already synced
    let relations = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
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
          'dr',
          'fkn',
        ],
      }
    );

    // check if relations already synced
    if (relations.length) {
      this.relationsCount = relations.length;
      return relations;
    }

    relations = (await this.sqlClient.relationListAll())?.data?.list;
    this.relationsCount = relations.length;

    // check if relations already synced
    if (
      (await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_relations'))
        .length
    ) {
      return relations;
    }

    // todo: insert parallelly
    for (const relation of relations) {
      relation.enabled = true;
      relation.fkn = relation?.cstn;
      await this.xcMeta.metaInsert(
        this.projectId,
        this.dbAlias,
        'nc_relations',
        {
          tn: relation.tn,
          _tn: this.getTableNameAlias(relation.tn),
          cn: relation.cn,
          _cn: this.getColumnNameAlias({ cn: relation.cn }, relation.tn),
          rtn: relation.rtn,
          _rtn: this.getTableNameAlias(relation.rtn),
          rcn: relation.rcn,
          _rcn: this.getColumnNameAlias({ cn: relation.rcn }, relation.rtn),
          type: 'real',
          db_type: this.connectionConfig?.client,
          dr: relation?.dr,
          ur: relation?.ur,
          fkn: relation?.cstn,
        }
      );
    }
    return relations;
  }

  protected async syncRelations(): Promise<boolean> {
    const [relations, missingRelations] =
      await this.getRelationsAndMissingRelations();
    if (!missingRelations) return false;

    this.relationsCount = relations.length + missingRelations.length;

    for (const relation of missingRelations) {
      await this.xcMeta.metaInsert(
        this.projectId,
        this.dbAlias,
        'nc_relations',
        {
          tn: relation.tn,
          _tn: this.getTableNameAlias(relation.tn),
          cn: relation.cn,
          _cn: this.getColumnNameAlias({ cn: relation.cn }, relation.tn),
          rtn: relation.rtn,
          _rtn: this.getTableNameAlias(relation.rtn),
          rcn: relation.rcn,
          _rcn: this.getColumnNameAlias({ cn: relation.rcn }, relation.rtn),
          type: 'real',
          db_type: this.connectionConfig?.client,
          dr: relation?.dr,
          ur: relation?.ur,
          fkn: relation?.cstn,
        }
      );
    }
    return true;
  }

  protected async getRelationsAndMissingRelations(): Promise<[any, any]> {
    // Relations in metadata
    const relations = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
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
          'dr',
          'fkn',
        ],
      }
    );

    // Relations in DB
    const dbRelations = (await this.sqlClient.relationListAll())?.data?.list;

    // Relations missing in metadata
    const missingRelations = dbRelations
      .filter((dbRelation) => {
        return relations.every(
          (relation) => relation?.fkn !== dbRelation?.cstn
        );
      })
      .map((relation) => {
        relation.enabled = true;
        relation.fkn = relation?.cstn;
        return relation;
      });

    return [relations, missingRelations];
  }

  protected async renameTableNameInXcRelations(
    oldTableName: string,
    newTableName: string
  ): Promise<any> {
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        tn: newTableName,
      },
      { tn: oldTableName }
    );

    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        rtn: newTableName,
      },
      { rtn: oldTableName }
    );
  }

  protected async getManyToManyRelations({
    parent = null,
    child = null,
    localMetas = null,
  } = {}): Promise<Set<any>> {
    const metas = new Set<any>();
    const assocMetas = new Set<any>();

    if (localMetas) {
      for (const meta of localMetas) {
        this.metas[meta.tn] = meta;
      }
    }

    for (const meta of Object.values(this.metas)) {
      // check if table is a Bridge table(or Associative Table) by checking
      // number of foreign keys and columns
      if (meta.belongsTo?.length === 2 && meta.columns.length < 5) {
        if (
          parent &&
          child &&
          !(
            [parent, child].includes(meta.belongsTo[0].rtn) &&
            [parent, child].includes(meta.belongsTo[1].rtn)
          )
        ) {
          continue;
        }

        const tableMetaA = this.metas[meta.belongsTo[0].rtn];
        const tableMetaB = this.metas[meta.belongsTo[1].rtn];

        /*        // remove hasmany relation with associate table from tables
                tableMetaA.hasMany.splice(tableMetaA.hasMany.findIndex(hm => hm.tn === meta.tn), 1)
                tableMetaB.hasMany.splice(tableMetaB.hasMany.findIndex(hm => hm.tn === meta.tn), 1)*/

        // add manytomany data under metadata of both linked tables
        tableMetaA.manyToMany = tableMetaA.manyToMany || [];
        if (tableMetaA.manyToMany.every((mm) => mm.vtn !== meta.tn)) {
          tableMetaA.manyToMany.push({
            tn: tableMetaA.tn,
            cn: meta.belongsTo[0].rcn,
            vtn: meta.tn,
            vcn: meta.belongsTo[0].cn,
            vrcn: meta.belongsTo[1].cn,
            rtn: meta.belongsTo[1].rtn,
            rcn: meta.belongsTo[1].rcn,
            _tn: tableMetaA._tn,
            _cn: meta.belongsTo[0]._rcn,
            _rtn: meta.belongsTo[1]._rtn,
            _rcn: meta.belongsTo[1]._rcn,
          });
          metas.add(tableMetaA);
        }
        // ignore if A & B are same table
        if (tableMetaB !== tableMetaA) {
          tableMetaB.manyToMany = tableMetaB.manyToMany || [];
          if (tableMetaB.manyToMany.every((mm) => mm.vtn !== meta.tn)) {
            tableMetaB.manyToMany.push({
              tn: tableMetaB.tn,
              cn: meta.belongsTo[1].rcn,
              vtn: meta.tn,
              vcn: meta.belongsTo[1].cn,
              vrcn: meta.belongsTo[0].cn,
              rtn: meta.belongsTo[0].rtn,
              rcn: meta.belongsTo[0].rcn,
              _tn: tableMetaB._tn,
              _cn: meta.belongsTo[1]._rcn,
              _rtn: meta.belongsTo[0]._rtn,
              _rcn: meta.belongsTo[0]._rcn,
            });
            metas.add(tableMetaB);
          }
        }
        assocMetas.add(meta);
      }
    }

    // Update metadata of tables which have manytomany relation
    // and recreate basemodel with new meta information
    for (const meta of metas) {
      let queryParams;

      // update showfields on new many to many relation create
      if (parent && child) {
        try {
          queryParams = JSON.parse(
            (
              await this.xcMeta.metaGet(
                this.projectId,
                this.dbAlias,
                'nc_models',
                { title: meta.tn }
              )
            ).query_params
          );
        } catch (e) {
          //  ignore
        }
      }

      meta.v = [
        ...meta.v.filter(
          (vc) => !(vc.hm && meta.manyToMany.some((mm) => vc.hm.tn === mm.vtn))
        ),
        // todo: ignore duplicate m2m relations
        // todo: optimize, just compare associative table(Vtn)
        ...meta.manyToMany
          .filter(
            (v, i) =>
              !meta.v.some(
                (v1) =>
                  v1.mm &&
                  ((v1.mm.tn === v.tn && v.rtn === v1.mm.rtn) ||
                    (v1.mm.rtn === v.tn && v.tn === v1.mm.rtn)) &&
                  v.vtn === v1.mm.vtn
              ) &&
              // ignore duplicate
              !meta.manyToMany.some(
                (v1, i1) =>
                  i1 !== i &&
                  v1.tn === v.tn &&
                  v.rtn === v1.rtn &&
                  v.vtn === v1.vtn
              )
          )
          .map((mm) => {
            if (
              queryParams?.showFields &&
              !(`${mm._tn} <=> ${mm._rtn}` in queryParams.showFields)
            ) {
              queryParams.showFields[`${mm._tn} <=> ${mm._rtn}`] = true;
            }

            return {
              mm,
              _cn: `${mm._tn} <=> ${mm._rtn}`,
            };
          }),
      ];
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
          ...(queryParams ? { query_params: JSON.stringify(queryParams) } : {}),
        },
        { title: meta.tn }
      );
      XcCache.del([this.projectId, this.dbAlias, 'table', meta.tn].join('::'));
      if (!localMetas) {
        this.models[meta.tn] = this.getBaseModel(meta);
      }
    }

    // Update metadata of associative table
    for (const meta of assocMetas) {
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          mm: 1,
        },
        { title: meta.tn }
      );
      if (!localMetas) {
        XcCache.del(
          [this.projectId, this.dbAlias, 'table', meta.tn].join('::')
        );
        this.models[meta.tn] = this.getBaseModel(meta);
      }
    }

    return metas;
  }

  protected async ncUpAddNestedResolverArgs(_ctx: any): Promise<any> {}

  protected async ncUpManyToMany(_ctx: any): Promise<any> {
    const models = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        fields: ['meta'],
        condition: {
          type: 'table',
        },
      }
    );
    if (!models.length) {
      return;
    }
    const metas = [];
    // add virtual columns for relations
    for (const metaObj of models) {
      const meta = JSON.parse(metaObj.meta);
      metas.push(meta);
      const ctx = this.generateContextForTable(
        meta.tn,
        meta.columns,
        [],
        meta.hasMany,
        meta.belongsTo,
        meta.type,
        meta._tn
      );
      // generate virtual columns
      meta.v = ModelXcMetaFactory.create(this.connectionConfig, {
        dir: '',
        ctx,
        filename: '',
      }).getVitualColumns();
      // set default primary values
      ModelXcMetaFactory.create(
        this.connectionConfig,
        {}
      ).mapDefaultPrimaryValue(meta.columns);
      // update meta
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
        },
        { title: meta.tn }
      );
    }

    // generate many to many relations an columns
    await this.getManyToManyRelations({ localMetas: metas });
    return metas;
  }

  private getColumnNameAlias(col, tableName?: string) {
    return (
      this.metas?.[tableName]?.columns?.find((c) => c.cn === col.cn)?._cn ||
      col._cn ||
      this.getInflectedName(col.cn, this.connectionConfig?.meta?.inflection?.cn)
    );
  }

  private baseLog(str, ...args): void {
    log(`${this.dbAlias} : ${str}`, ...args);
  }

  private async modifyTableNameInACL(
    oldName: string,
    newName: string
  ): Promise<void> {
    if (oldName === newName) {
      return;
    }

    const replaceTableName = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }

      for (const [key, value] of Object.entries(obj) as any) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === oldName) {
            delete obj[key];
            obj[newName] = value;
          }

          replaceTableName(value);
        }
      }
    };

    const acls = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        xcCondition: {
          acl: {
            like: '%"custom":%',
          },
        },
      }
    );

    for (const aclRow of acls) {
      const aclObj = JSON.parse(aclRow.acl);
      for (const aclOps of Object.values(aclObj)) {
        if (typeof aclOps === 'boolean') {
          continue;
        }

        for (const acl of Object.values(aclOps) as any[]) {
          if (typeof acl === 'boolean') {
            continue;
          }

          if ('custom' in acl) {
            replaceTableName(acl.custom);
          }
        }
      }

      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_acl',
        {
          acl: JSON.stringify(aclObj),
        },
        {
          id: aclRow.id,
        }
      );
    }
  }

  // @ts-ignore
  private async deleteTableNameInACL(table: string) {
    const replaceTableName = (obj) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
        return;
      }

      for (const [key, value] of Object.entries(obj) as any) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            delete obj[key];
          }
          replaceTableName(value);
        }
      }
    };

    const acls = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        xcCondition: {
          acl: {
            like: '%"custom":%',
          },
        },
      }
    );

    for (const aclRow of acls) {
      const aclObj = JSON.parse(aclRow.acl);
      for (const aclOps of Object.values(aclObj)) {
        if (typeof aclOps === 'boolean') {
          continue;
        }
        for (const acl of Object.values(aclOps) as any[]) {
          if (typeof acl === 'boolean') {
            continue;
          }
          if ('custom' in acl) {
            replaceTableName(acl.custom);
          }
        }
      }

      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_acl',
        {
          acl: JSON.stringify(aclObj),
        },
        {
          id: aclRow.id,
        }
      );
    }
  }

  private async modifyColumnNameInACL(
    table: string,
    oldName: string,
    newName: string
  ): Promise<void> {
    this.baseLog(
      `modifyColumnNameInACL : '${oldName}' =>  '${newName}',  table : '${table}'`
    );

    if (oldName === newName) {
      return;
    }

    const findColumnAndRename = (obj) => {
      if (!obj) {
        return;
      }
      if ('_and' in obj) {
        for (const o of obj._and) {
          findColumnAndRename(o);
        }
      }
      if ('_or' in obj) {
        for (const o of obj._or) {
          findColumnAndRename(o);
        }
      }
      if ('_not' in obj) {
        findColumnAndRename(obj._not);
      }

      if (oldName in obj) {
        obj[newName] = obj[oldName];
        delete obj[oldName];
      }
    };

    const replaceColumnName = (obj) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(obj) as any) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            findColumnAndRename(value);
          }
        }
        replaceColumnName(value);
      }
    };

    const acls = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        xcCondition: {
          acl: {
            like: '%"custom":%',
          },
        },
      }
    );

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {
          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of Object.values(aclOps) as any[]) {
            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl) {
              replaceColumnName(acl.custom);
              findColumnAndRename(acl.custom);
            }
          }
        }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_acl',
          {
            acl: JSON.stringify(aclObj),
          },
          {
            id: aclRow.id,
          }
        );
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }

    await this.loadXcAcl();
  }

  private async deleteColumnNameInACL(
    table: string,
    cn: string
  ): Promise<void> {
    this.baseLog(`deleteColumnNameInACL : '${cn}' in '${table}'`);

    const findColumnAndRename = (obj) => {
      if (!obj) {
        return;
      }
      if ('_and' in obj) {
        for (const o of obj._and) {
          findColumnAndRename(o);
        }
      }
      if ('_or' in obj) {
        for (const o of obj._or) {
          findColumnAndRename(o);
        }
      }
      if ('_not' in obj) {
        findColumnAndRename(obj._not);
      }

      if (cn in obj) {
        delete obj[cn];
      }
    };

    const replaceColumnName = (obj) => {
      if (!obj || typeof obj !== 'object') {
        return;
      }

      for (const [key, value] of Object.entries(obj) as any) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (key === table) {
            findColumnAndRename(value);
          }
        }
        replaceColumnName(value);
      }
    };

    const acls = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        xcCondition: {
          acl: {
            like: '%"custom":%',
          },
        },
      }
    );

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {
          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of Object.values(aclOps) as any[]) {
            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl) {
              replaceColumnName(acl.custom);
              findColumnAndRename(acl.custom);
            }
          }
        }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_acl',
          {
            acl: JSON.stringify(aclObj),
          },
          {
            id: aclRow.id,
          }
        );
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }

    await this.loadXcAcl();
  }

  private async deleteRelationInACL(
    parentTable: string,
    childTable: string
  ): Promise<void> {
    this.baseLog(`deleteRelationInACL : '${parentTable}' => '${childTable}'`);
    const relationExist = (ancestor, obj, exist = false) => {
      if (!obj || typeof obj !== 'object') {
        return exist;
      }

      for (const [key, value] of Object.entries(obj) as any) {
        if (!value || typeof value !== 'object') {
          continue;
        }
        if ('relationType' in value) {
          if (
            ancestor === parentTable &&
            key === childTable &&
            value.relationType === 'hm'
          ) {
            return true;
          }
          if (
            ancestor === childTable &&
            key === parentTable &&
            value.relationType === 'bt'
          ) {
            return true;
          }
          return (
            exist ||
            relationExist(value.relationType ? key : ancestor, value, exist)
          );
        } else {
          return exist || relationExist(ancestor, value, exist);
        }
      }

      return exist;
    };

    const acls = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        xcCondition: {
          acl: {
            like: '%"custom":%',
          },
        },
      }
    );

    for (const aclRow of acls) {
      try {
        const aclObj = JSON.parse(aclRow.acl);
        for (const aclOps of Object.values(aclObj)) {
          if (typeof aclOps === 'boolean') {
            continue;
          }

          for (const acl of Object.values(aclOps) as any[]) {
            if (typeof acl === 'boolean') {
              continue;
            }

            if ('custom' in acl && relationExist(aclRow.tn, acl.custom)) {
              delete acl.custom;
            }
          }
        }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_acl',
          {
            acl: JSON.stringify(aclObj),
          },
          {
            id: aclRow.id,
          }
        );
      } catch (e) {
        console.log('modifyColumnNameInACL : error : ', e);
      }
    }
    await this.loadXcAcl();
  }

  public async onTableCreate(_tn: string, _args?: any) {
    Tele.emit('evt', { evt_type: 'table:created' });
  }

  public onVirtualTableUpdate(args: any) {
    const meta = XcCache.get(
      [this.projectId, this.dbAlias, 'table', args.tn].join('::')
    );
    if (meta && meta.id === args.id) {
      XcCache.del([this.projectId, this.dbAlias, 'table', args.tn].join('::'));
      // todo: update meta and model
    }
    if (
      args?.query_params?.extraViewParams?.formParams &&
      this.formViews[args.tn]?.[args.view_name]
    ) {
      this.formViews[args.tn][args.view_name].query_params = args.query_params;
    }
  }

  public async onVirtualTableRename(_args: any) {
    await this.loadFormViews();
  }

  public getMeta(tableName: string): NcMetaData {
    return this.metas?.[tableName];
  }

  /*  protected async getAndSync(tableName: string): Promise<any[]> {
    const tableRelations = (await this.getRelationList()).filter(
      rel => rel.tn === tableName
    );

    const existingTableRelations = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        xcCondition: {
          type: 'real',
          _or: [
            {
              tn: {
                eq: tableName
              }
            },
            {
              rtn: {
                eq: tableName
              }
            }
          ]
        }
      }
    );

    ret;
  }*/

  public async onTableMetaRecreate(tableName: string): Promise<void> {
    this.baseLog(`onTableMetaRecreate : '%s'`, tableName);
    const oldMeta = this.getMeta(tableName);

    const virtualRelations = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_relations',
      {
        xcCondition: {
          _or: [
            {
              tn: {
                eq: tableName,
              },
            },
            {
              rtn: {
                eq: tableName,
              },
            },
          ],
        },
      }
    );
    const colListRef = {};
    const tableList =
      (await this.getSqlClient()?.tableList())?.data?.list || [];

    colListRef[tableName] = await this.getColumnList(tableName);

    // @ts-ignore
    const relations = await this.getRelationList();

    for (const vCol of oldMeta.v || []) {
      if (vCol.lk) {
      }
      if (vCol.rl) {
      }
    }

    for (const rel of virtualRelations) {
      colListRef[rel.tn] =
        colListRef[rel.tn] || (await this.getColumnList(rel.tn));
      colListRef[rel.rtn] =
        colListRef[rel.rtn] || (await this.getColumnList(rel.rtn));

      // todo: compare with real relation list
      if (
        !(
          tableList.find((t) => t.tn === rel.rtn) &&
          tableList.find((t) => t.tn === rel.tn) &&
          colListRef[rel.tn].find((t) => t.cn === rel.cn) &&
          colListRef[rel.rtn].find((t) => t.cn === rel.rcn)
        )
      )
        await this.xcMeta.metaDelete(
          this.projectId,
          this.dbAlias,
          'nc_relations',
          rel.id
        );
    }

    // todo : handle query params
    const oldModelRow = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      { title: tableName }
    );

    await this.onTableDelete(tableName, {
      ignoreRelations: true,
      ignoreViews: true,
    } as any);

    let queryParams: any;
    try {
      queryParams = JSON.parse(oldModelRow.query_params);
    } catch (e) {
      queryParams = {};
    }

    const { virtualViews, virtualViewsParamsArr } =
      await this.extractSharedAndVirtualViewsParams(tableName);

    for (const oldColumn of oldMeta.columns) {
      if (colListRef[tableName].find((c) => c.cn === oldColumn.cn)) continue;
      addErrorOnColumnDeleteInFormula({
        virtualColumns: oldMeta.v,
        columnName: oldColumn.cn,
      });
    }

    await this.onTableCreate(tableName, { oldMeta });

    const meta = this.getMeta(tableName);

    for (const oldColumn of oldMeta.columns) {
      if (meta.columns.find((c) => c.cn === oldColumn.cn)) continue;

      // virtual views param update
      for (const qp of [queryParams, ...virtualViewsParamsArr]) {
        if (!qp) continue;

        // @ts-ignore
        const {
          filters = {},
          sortList = [],
          showFields = {},
          fieldsOrder = [],
          extraViewParams = {},
        } = qp;

        /* update sort field */
        const sIndex = (sortList || []).findIndex(
          (v) => v.field === oldColumn._cn
        );
        if (sIndex > -1) {
          sortList.splice(sIndex, 1);
        }
        /* update show field */
        if (oldColumn.cn in showFields || oldColumn._cn in showFields) {
          delete showFields[oldColumn.cn];
          delete showFields[oldColumn._cn];
        }
        /* update filters */
        // todo: remove only corresponding filter and compare field name
        if (
          filters &&
          (JSON.stringify(filters)?.includes(`"${oldColumn.cn}"`) ||
            JSON.stringify(filters)?.includes(`"${oldColumn._cn}"`))
        ) {
          filters.splice(0, filters.length);
        }

        /* update fieldsOrder */
        let index = fieldsOrder.indexOf(oldColumn.cn);
        if (index > -1) {
          fieldsOrder.splice(index, 1);
        }
        index = fieldsOrder.indexOf(oldColumn._cn);
        if (index > -1) {
          fieldsOrder.splice(index, 1);
        }

        /* update formView params */
        //  extraViewParams.formParams.fields
        if (extraViewParams?.formParams?.fields?.[oldColumn.cn]) {
          delete extraViewParams.formParams.fields[oldColumn.cn];
        }
        if (extraViewParams?.formParams?.fields?.[oldColumn._cn]) {
          delete extraViewParams.formParams.fields[oldColumn._cn];
        }
      }
    }

    await this.updateSharedAndVirtualViewsParams(
      virtualViewsParamsArr,
      virtualViews
    );
    await this.metaQueryParamsUpdate(queryParams, tableName);
  }

  private async metaQueryParamsUpdate(queryParams: any, tableName: string) {
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        query_params: JSON.stringify(queryParams),
      },
      { title: tableName, type: 'table' }
    );
  }

  protected async getOrderVal(): Promise<number> {
    const order =
      (
        await this.xcMeta
          .knex('nc_models')
          .where({
            project_id: this.projectId,
            db_alias: this.dbAlias,
          })
          .max('order as max')
          .first()
      )?.max || 0;
    return order;
  }

  public async xcMetaDiffSync(): Promise<void> {
    return xcMetaDiffSync.call(this);
  }

  public abstract xcTablesPopulate(args?: XcTablesPopulateParams): Promise<any>;
}

interface NcBuilderUpgraderCtx {
  xcMeta: NcMetaIO;
  builder: BaseApiBuilder<any>;
  projectId: string;
  dbAlias: string;
}

interface NcMetaData {
  tn: string;
  _tn?: string;
  v: Array<{
    _cn?: string;
    [key: string]: any;
  }>;
  columns: Array<{
    _cn?: string;
    cn?: string;
    uidt?: string;
    [key: string]: any;
  }>;

  [key: string]: any;
}

type XcTablesPopulateParams = {
  tableNames?: Array<{
    tn: string;
    _tn?: string;
  }>;
  type?: 'table' | 'view' | 'function' | 'procedure';
  columns?: {
    [tn: string]: any;
  };
  oldMetas?: {
    [tn: string]: NcMetaData;
  };
};
export {
  IGNORE_TABLES,
  NcBuilderUpgraderCtx,
  NcMetaData,
  XcTablesPopulateParams,
};
