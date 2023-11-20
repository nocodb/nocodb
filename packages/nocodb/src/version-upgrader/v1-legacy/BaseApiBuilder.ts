import debug from 'debug';
import { Router } from 'express';
import inflection from 'inflection';
import ncModelsOrderUpgrader from './jobs/ncModelsOrderUpgrader';
import ncParentModelTitleUpgrader from './jobs/ncParentModelTitleUpgrader';
import ncRemoveDuplicatedRelationRows from './jobs/ncRemoveDuplicatedRelationRows';
import type NcProjectBuilder from './NcProjectBuilder';
import type { XKnex } from '~/db/CustomKnex';
import type { BaseModelSql } from '~/db/BaseModelSql';
import type { MetaService } from '~/meta/meta.service';
import type Noco from '~/Noco';
import type { MysqlClient, PgClient, SqlClient } from 'nc-help';
import type { DbConfig, NcConfig } from '~/interface/config';
import ModelXcMetaFactory from '~/db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import NcConnectionMgr from '~/utils/common/NcConnectionMgr';

const log = debug('nc:api:source');

export default abstract class BaseApiBuilder<T extends Noco> {
  public abstract readonly type: string;

  public get knex(): XKnex {
    return this.sqlClient?.knex || this.dbDriver;
  }

  public get prefix() {
    return this.baseBuilder?.prefix;
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
      (this.baseBuilder as any).router.use('/', this.apiRouter);
    }
    return this.apiRouter;
  }

  public get routeVersionLetter(): string {
    return this.connectionConfig?.meta?.api?.prefix || 'v1';
  }

  protected get baseId(): string {
    return this.baseBuilder?.id;
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

  protected baseBuilder: NcProjectBuilder;

  protected models: { [key: string]: BaseModelSql };

  protected metas: { [key: string]: NcMetaData };

  protected sqlClient: MysqlClient | PgClient | SqlClient | any;

  protected dbDriver: XKnex;
  protected config: NcConfig;
  protected connectionConfig: DbConfig;

  protected procedureOrFunctionAcls: {
    [name: string]: { [role: string]: boolean };
  };
  protected xcMeta: MetaService;

  private apiRouter: Router;

  constructor(
    app: T,
    baseBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig,
  ) {
    this.models = {};
    this.app = app;
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.metas = {};
    this.procedureOrFunctionAcls = {};
    this.hooks = {};
    this.formViews = {};
    this.baseBuilder = baseBuilder;
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

  public async getSqlClient() {
    return NcConnectionMgr.getSqlClient({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      baseId: this.baseId,
    });
  }

  public async xcUpgrade(): Promise<any> {
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
      this.baseId,
      this.dbAlias,
      'nc_store',
      { key: 'NC_CONFIG' },
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
              version.name,
            );
            await version?.handler?.(<NcBuilderUpgraderCtx>{
              xcMeta: this.xcMeta,
              builder: this,
              dbAlias: this.dbAlias,
              baseId: this.baseId,
            });

            // update version in meta after each upgrade
            configObj.version = version.name;
            await this.xcMeta.metaUpdate(
              this.baseId,
              this.dbAlias,
              'nc_store',
              {
                value: JSON.stringify(configObj),
              },
              {
                key: 'NC_CONFIG',
              },
            );

            // todo: backup data
          }
          if (version.name === process.env.NC_VERSION) {
            break;
          }
        }
        configObj.version = process.env.NC_VERSION;
        await this.xcMeta.metaUpdate(
          this.baseId,
          this.dbAlias,
          'nc_store',
          {
            value: JSON.stringify(configObj),
          },
          {
            key: 'NC_CONFIG',
          },
        );
      }
    } else {
      this.baseLog(`xcUpgrade : Inserting config to meta database`);
      const configObj: NcConfig = JSON.parse(JSON.stringify(this.config));
      delete configObj.envs;
      const isOld = (
        await this.xcMeta.metaList(this.baseId, this.dbAlias, 'nc_models')
      )?.length;
      configObj.version = isOld ? '0009000' : process.env.NC_VERSION;
      await this.xcMeta.metaInsert(this.baseId, this.dbAlias, 'nc_store', {
        key: 'NC_CONFIG',
        value: JSON.stringify(configObj),
      });
      if (isOld) {
        await this.xcUpgrade();
      }
    }
  }

  public getProjectId(): string {
    return this.baseId;
  }

  public async init(): Promise<void> {
    await this.xcUpgrade();
  }

  protected async initDbDriver(): Promise<void> {
    this.dbDriver = await NcConnectionMgr.get({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      baseId: this.baseId,
    });
    this.sqlClient = await NcConnectionMgr.getSqlClient({
      dbAlias: this.dbAlias,
      env: this.config.env,
      config: this.config,
      baseId: this.baseId,
    });
  }

  private baseLog(str, ...args): void {
    log(`${this.dbAlias} : ${str}`, ...args);
  }

  protected generateContextForTable(
    tn: string,
    columns: any[],
    relations,
    hasMany: any[],
    belongsTo: any[],
    type = 'table',
    tableNameAlias?: string,
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
      base_id: this.baseId,
    };
    return ctx;
  }

  private getColumnNameAlias(col, tableName?: string) {
    return (
      this.metas?.[tableName]?.columns?.find((c) => c.cn === col.cn)?._cn ||
      col._cn ||
      this.getInflectedName(col.cn, this.connectionConfig?.meta?.inflection?.cn)
    );
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

  protected async ncUpAddNestedResolverArgs(_ctx: any): Promise<any> {}

  protected getTableNameAlias(tableName: string) {
    let tn = tableName;
    if (this.metas?.[tn]?._tn) {
      return this.metas?.[tn]?._tn;
    }

    if (this.baseBuilder?.prefix) {
      tn = tn.replace(this.baseBuilder?.prefix, '');
    }

    const modifiedTableName = tn?.replace(/^(?=\d+)/, 'ISN___');
    return this.getInflectedName(
      modifiedTableName,
      this.connectionConfig?.meta?.inflection?.tn,
    );
  }

  protected async ncUpManyToMany(_ctx: any): Promise<any> {
    const models = await this.xcMeta.metaList(
      this.baseId,
      this.dbAlias,
      'nc_models',
      {
        fields: ['meta'],
        condition: {
          type: 'table',
        },
      },
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
        meta._tn,
      );
      // generate virtual columns
      meta.v = ModelXcMetaFactory.create(this.connectionConfig, {
        dir: '',
        ctx,
        filename: '',
      }).getVitualColumns();
      // set default display values
      ModelXcMetaFactory.create(
        this.connectionConfig,
        {},
      ).mapDefaultDisplayValue(meta.columns);
      // update meta
      await this.xcMeta.metaUpdate(
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
        },
        { title: meta.tn },
      );
    }

    // generate many to many relations an columns
    await this.getManyToManyRelations({ localMetas: metas });
    return metas;
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
                this.baseId,
                this.dbAlias,
                'nc_models',
                { title: meta.tn },
              )
            ).query_params,
          );
        } catch (e) {
          //  ignore
        }
      }

      meta.v = [
        ...meta.v.filter(
          (vc) => !(vc.hm && meta.manyToMany.some((mm) => vc.hm.tn === mm.vtn)),
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
                  v.vtn === v1.mm.vtn,
              ) &&
              // ignore duplicate
              !meta.manyToMany.some(
                (v1, i1) =>
                  i1 !== i &&
                  v1.tn === v.tn &&
                  v.rtn === v1.rtn &&
                  v.vtn === v1.vtn,
              ),
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
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          meta: JSON.stringify(meta),
          ...(queryParams ? { query_params: JSON.stringify(queryParams) } : {}),
        },
        { title: meta.tn },
      );
      // XcCache.del([this.baseId, this.dbAlias, 'table', meta.tn].join('::'));
      // if (!localMetas) {
      //   this.models[meta.tn] = this.getBaseModel(meta);
      // }
    }

    // Update metadata of associative table
    for (const meta of assocMetas) {
      await this.xcMeta.metaUpdate(
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          mm: 1,
        },
        { title: meta.tn },
      );
    }

    return metas;
  }
}

interface NcBuilderUpgraderCtx {
  xcMeta: MetaService;
  builder: BaseApiBuilder<any>;
  baseId: string;
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
export { NcBuilderUpgraderCtx, NcMetaData, XcTablesPopulateParams };
