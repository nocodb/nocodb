import DataLoader from 'dataloader';
import debug from 'debug';
import { Router } from 'express';
import { execute } from 'graphql';
import { GraphQLJSON } from 'graphql-type-json';
import _ from 'lodash';
import { BaseType } from 'xc-core-ts';

import ExpressXcTsPolicyGql from '../../db/sql-mgr/code/gql-policies/xc-ts/ExpressXcTsPolicyGql';
import GqlXcSchemaFactory from '../../db/sql-mgr/code/gql-schema/xc-ts/GqlXcSchemaFactory';
import ModelXcMetaFactory from '../../db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import NcHelp from '../../utils/NcHelp';
import BaseApiBuilder from '../../utils/common/BaseApiBuilder';

import { m2mNotChildren, m2mNotChildrenCount } from './GqlCommonResolvers';
import GqlMiddleware from './GqlMiddleware';
import { GqlProcedureResolver } from './GqlProcedureResolver';
import GqlResolver from './GqlResolver';
import commonSchema from './common.schema';
import type NcMetaIO from '../../meta/NcMetaIO';
import type { XcTablesPopulateParams } from '../../utils/common/BaseApiBuilder';
import type Noco from '../../Noco';
import type NcProjectBuilder from '../NcProjectBuilder';
import type { DbConfig, NcConfig } from '../../../interface/config';
import type XcMetaMgr from '../../../interface/XcMetaMgr';

const log = debug('nc:api:gql');

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

// Base class of GQL type
class XCType {
  constructor(o) {
    for (const k in o) {
      if (!this[k]) {
        this[k] = o[k];
      }
    }
  }
}

export class GqlApiBuilder extends BaseApiBuilder<Noco> implements XcMetaMgr {
  public readonly type = 'gql';
  private resolvers: {
    [key: string]: GqlResolver | GqlProcedureResolver;
    ___procedure?: GqlProcedureResolver;
  };
  private schemas: { [key: string]: any };
  private types: { [key: string]: new (o: any) => any };
  private policies: { [key: string]: any };
  private readonly gqlRouter: Router;
  private resolversCount = 0;
  private customResolver: any;

  constructor(
    app: Noco,
    projectBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig,
    xcMeta?: NcMetaIO
  ) {
    super(app, projectBuilder, config, connectionConfig);
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.resolvers = {};
    this.schemas = {};
    this.types = {};
    this.metas = {};
    this.policies = {};
    this.gqlRouter = Router();
    this.xcMeta = xcMeta;
  }

  public async init(): Promise<void> {
    await super.init();
    // return await this.loadResolvers(null);
  }

  public async onToggleModelRelation(relationInModels: any): Promise<void> {
    this.log(`onToggleModelRelation: Within ToggleModelRelation event handler`);

    const modelNames: string[] = [
      ...new Set(
        relationInModels.map((rel) => {
          return rel.relationType === 'hm' ? rel.rtn : rel.tn;
        })
      ),
    ] as string[];

    // get current meta from db
    const metas = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        xcCondition: {
          title: {
            in: modelNames,
          },
        },
      }
    );

    for (const {
      meta,
      id,
      title,
      // schema_previous
    } of metas) {
      const metaObj = JSON.parse(meta);
      /* filter relation where this table is present */
      const hasMany = metaObj.hasMany.filter(({ enabled }) => enabled);
      const belongsTo = metaObj.belongsTo.filter(({ enabled }) => enabled);
      const columns = await this.getColumnList(title);
      const ctx = this.generateContextForTable(
        title,
        columns,
        [...hasMany, ...belongsTo],
        hasMany,
        belongsTo
      );

      const oldSchema = this.schemas[title];

      this.log(
        `onToggleModelRelation : Generating schema for '%s' table`,
        title
      );
      const newSchema = (this.schemas[title] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString());
      if (oldSchema !== this.schemas[title]) {
        // keep upto 5 schema backup on table update
        // const previousSchemas = [oldSchema]
        // if (schema_previous) {
        //   previousSchemas = [...JSON.parse(schema_previous), oldSchema].slice(-5);
        // }
        this.log(
          `onToggleModelRelation : Updating and taking backup of schema for '%s' table`,
          title
        );

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            schema: newSchema,
            // schema_previous: JSON.stringify(previousSchemas)
          },
          {
            id,
          }
        );
      }
    }
    await this.xcTablesRead(modelNames);
    await this.reInitializeGraphqlEndpoint();
  }

  public async onTableCreate(tn: string, args): Promise<void> {
    this.log(`onTableCreate : '%s' `, tn);

    await super.onTableCreate(tn, args);

    // get columns list from db
    const columnsFromDb = await this.getColumnList(tn);

    const columns = args.columns
      ? {
          [tn]: args.columns?.map(({ altered: _al, ...rest }) =>
            this.mergeUiColAndDbColMetas(
              rest,
              columnsFromDb?.find((c) => c.cn === rest.cn)
            )
          ),
        }
      : {};

    await this.xcTablesPopulate({
      tableNames: [{ tn, _tn: args._tn }],
      columns,
    });
    await this.reInitializeGraphqlEndpoint();
  }

  public async onTableDelete(tn: string, extras?: any): Promise<void> {
    await super.onTableDelete(tn, extras);
    this.log(`onTableDelete : '%s' `, tn);
    delete this.models[tn];
    await this.xcTablesRowDelete(tn, extras);
    delete this.resolvers[tn];
    delete this.schemas[tn];

    await this.reInitializeGraphqlEndpoint();
  }

  public async onViewDelete(viewName: string): Promise<void> {
    this.log(`onViewDelete : '%s' `, viewName);
    delete this.models[viewName];
    await this.xcTablesRowDelete(viewName);
    delete this.resolvers[viewName];
    delete this.schemas[viewName];
    await this.reInitializeGraphqlEndpoint();
  }

  // todo: m2m
  public async onTableRename(
    oldTableName: string,
    newTableName: string
  ): Promise<void> {
    this.log(`onTableRename : '%s' => '%s' `, oldTableName, newTableName);
    // await this.onTableDelete(oldTableName);
    // await this.onTableCreate(newTableName);
    await super.onTableRename(oldTableName, newTableName);
    await this.xcTableRename(oldTableName, newTableName);
  }

  public async loadResolvers(customResolver: any): Promise<any> {
    this.customResolver = customResolver;
    this.log(`Initializing graphql api`);

    const t = process.hrtime();

    await this.initDbDriver();

    // todo: change condition
    if (this.connectionConfig.meta.reset) {
      await this.xcMeta.metaReset(this.projectId, this.dbAlias);
    }

    if (!(await this.xcMeta.isMetaDataExists(this.projectId, this.dbAlias))) {
      await this.xcTablesPopulate();
    } else {
      await this.xcTablesRead();
    }

    await this.loadHooks();
    await this.loadFormViews();
    await this.initGraphqlRoute();
    await super.loadCommon();

    this.router.use(
      `/${this.connectionConfig?.meta?.api?.prefix || 'v1'}`,
      this.gqlRouter
    );

    const t1 = process.hrtime(t);
    const t2 = t1[0] + t1[1] / 1000000000;
    return {
      type: 'graphql',
      apiEndpoint: this.tablesCount
        ? `/nc/${this.projectId}/${
            this.connectionConfig?.meta?.api?.prefix || 'v1'
          }/graphql`
        : 'Empty database',
      client: this.connectionConfig.client,
      databaseName: (this.connectionConfig?.connection as any)?.database,
      resolversCount: this.resolversCount,
      apiCount: this.resolversCount,
      tablesCount: this.tablesCount,
      relationsCount: this.relationsCount,
      viewsCount: this.viewsCount,
      functionsCount: this.functionsCount,
      proceduresCount: this.proceduresCount,
      timeTaken: t2.toFixed(1),
    };
  }

  public async xcTablesRead(tables?: string[]): Promise<any> {
    this.log(`xcTablesRead : %o`, tables);
    // todo: load procedure and functions
    await this.loadXcAcl();

    const {
      metaArr,
      enabledModels,
      tableAndViewArr,
      functionArr,
      procedureArr,
    } = await this.readXcModelsAndGroupByType();

    const procedureResolver = new GqlProcedureResolver(
      this,
      functionArr,
      procedureArr,
      this.procedureOrFunctionAcls
    );

    this.log(`xcTablesRead : Generating schema for procedure and resolver`);
    this.schemas.___procedure = procedureResolver.getSchema();
    this.resolvers.___procedure = procedureResolver;
    const resolversArr = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_resolvers',
      {
        condition: {
          handler_type: 1,
        },
      }
    );
    const middlewaresArr = (
      await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_resolvers', {
        condition: {
          handler_type: 2,
        },
      })
    ).map((o) => {
      o.functions = JSON.parse(o.functions);
      return o;
    });

    const loaderFunctionsArr = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_loaders'
    );

    const loaderFunctionsObj = loaderFunctionsArr.reduce(
      (obj, { title, functions }) => {
        obj[title] = functions && JSON.parse(functions);
        return obj;
      },
      {}
    );

    this.tablesCount = metaArr.length;

    for (const meta of tableAndViewArr) {
      if (
        (tables && !tables.includes(meta.title)) ||
        !enabledModels.includes(meta.title)
      ) {
        continue;
      }

      const middlewareBody = middlewaresArr.find(
        ({ title }) => title === meta.title
      )?.functions?.[0];

      this.metas[meta.title] = JSON.parse(meta.meta);
      this.models[meta.title] = this.getBaseModel(this.metas[meta.title]);

      // tslint:disable-next-line:max-classes-per-file
      this.types[meta.title] = class extends XCType {};

      this.schemas[meta.title] = meta.schema;
      this.policies[meta.title] = resolversArr
        .filter(({ title }) => title === meta.title)
        .reduce((aclObj, { acl, resolver }) => {
          aclObj[resolver] = JSON.parse(acl);
          return aclObj;
        }, {});

      const functions = resolversArr
        .filter(({ title }) => title === meta.title)
        .reduce((fnObj, { functions, resolver }) => {
          fnObj[resolver] = JSON.parse(functions);
          return fnObj;
        }, {});

      this.log(
        `xcTablesRead : Creating resolvers for '%s' %s`,
        meta.title,
        meta.type
      );
      this.resolvers[meta.title] = new GqlResolver(
        this.app as Noco,
        this.models,
        meta.title,
        this.types[meta.title],
        this.acls,
        functions,
        middlewareBody
      );

      this.resolvers[meta.title].mapResolvers(this.customResolver);
    }
    const self = this;
    await Promise.all(
      Object.entries(this.metas).map(async ([tn, schema]) => {
        for (const hm of schema.hasMany) {
          if (!enabledModels.includes(hm.tn)) {
            continue;
          }

          if (!hm.enabled) {
            continue;
          }
          const colNameAlias = self.models[hm.rtn]?.columnToAlias[hm.rcn];

          const middlewareBody = middlewaresArr.find(
            ({ title }) => title === hm.tn
          )?.functions?.[0];
          const countPropName = `${hm._tn}Count`;
          const listPropName = `${hm._tn}List`;

          if (listPropName in this.types[tn].prototype) {
            continue;
          }

          const mw = new GqlMiddleware(
            this.acls,
            hm.tn,
            middlewareBody,
            this.models
          );
          /* has many relation list loader with middleware */
          this.addHmListResolverMethodToType(
            tn,
            hm,
            mw,
            loaderFunctionsObj,
            listPropName,
            colNameAlias
          );
          if (countPropName in this.types[tn].prototype) {
            continue;
          }
          {
            const mw = new GqlMiddleware(
              this.acls,
              hm.tn,
              middlewareBody,
              this.models
            );

            // create count loader with middleware
            this.addHmCountResolverMethodToType(
              hm,
              mw,
              tn,
              loaderFunctionsObj,
              countPropName,
              colNameAlias
            );
          }
        }
        for (const mm of schema.manyToMany || []) {
          if (!enabledModels.includes(mm.rtn)) {
            continue;
          }

          // todo: handle enable/disable
          // if (!mm.enabled) {
          //   continue;
          // }

          const middlewareBody = middlewaresArr.find(
            ({ title }) => title === mm.rtn
          )?.functions?.[0];
          // const countPropName = `${mm._rtn}Count`;
          const listPropName = `${mm._rtn}MMList`;

          if (listPropName in this.types[tn].prototype) {
            continue;
          }

          const mw = new GqlMiddleware(
            this.acls,
            mm.tn,
            middlewareBody,
            this.models
          );
          /* has many relation list loader with middleware */
          this.addMMListResolverMethodToType(
            tn,
            mm,
            mw,
            {},
            listPropName,
            this.metas[mm.tn].columns.find((c) => c.pk)._cn
          );
          // todo: count
          // if (countPropName in this.types[tn].prototype) {
          //   continue;
          // }
          // {
          //   const mw = new GqlMiddleware(this.acls, hm.tn, middlewareBody, this.models);
          //
          //   // create count loader with middleware
          //   this.addHmCountResolverMethodToType(hm, mw, tn, loaderFunctionsObj, countPropName, colNameAlias);
          // }
        }

        for (const bt of schema.belongsTo) {
          if (!enabledModels.includes(bt.rtn)) {
            continue;
          }

          if (!bt.enabled) {
            continue;
          }
          const colNameAlias = self.models[bt.tn]?.columnToAlias[bt.cn];
          const rcolNameAlias = self.models[bt.rtn]?.columnToAlias[bt.rcn];
          const middlewareBody = middlewaresArr.find(
            ({ title }) => title === bt.rtn
          )?.functions?.[0];
          const propName = `${bt._rtn}Read`;
          if (propName in this.types[tn].prototype) {
            continue;
          }

          // create read loader with middleware
          {
            const mw = new GqlMiddleware(
              this.acls,
              bt.rtn,
              middlewareBody,
              this.models
            );
            this.log(
              `xcTablesRead : Creating loader for '%s'`,
              `${tn}Bt${bt.rtn}`
            );
            this.adBtResolverMethodToType(
              propName,
              mw,
              tn,
              bt,
              rcolNameAlias,
              colNameAlias,
              loaderFunctionsObj[`${tn}Bt${bt.rtn}`]
            );
          }
        }
      })
    );
  }

  private addHmListResolverMethodToType(
    tn: string,
    hm,
    mw: GqlMiddleware,
    loaderFunctionsObj,
    listPropName: string,
    colNameAlias
  ) {
    {
      const self = this;
      this.log(
        `xcTablesRead : Creating loader for '%s'`,
        `${tn}Hm${hm.tn}List`
      );
      const listLoader = new DataLoader(
        BaseType.applyMiddlewareForLoader(
          [mw.middleware],
          this.generateLoaderFromStringBody(
            loaderFunctionsObj[`${tn}Hm${hm.tn}List`]
          ) ||
            (async (idsAndArg) => {
              const data = await this.models[tn].hasManyListGQL({
                child: hm.tn,
                ids: idsAndArg.map(({ id }) => id),
                ...(idsAndArg?.[0]?.args || {}),
              });
              return idsAndArg.map(({ id }) =>
                data[id] ? data[id].map((c) => new self.types[hm.tn](c)) : []
              );
            }),
          [mw.postLoaderMiddleware]
        )
      );

      /* defining HasMany list method within GQL Type class */
      Object.defineProperty(this.types[tn].prototype, `${listPropName}`, {
        async value(args: any, context: any, info: any): Promise<any> {
          return listLoader.load([
            { id: this[colNameAlias], args },
            args,
            context,
            info,
          ]);
        },
        configurable: true,
      });
    }
  }

  private addMMListResolverMethodToType(
    tn: string,
    mm,
    mw: GqlMiddleware,
    _loaderFunctionsObj,
    listPropName: string,
    colNameAlias
  ) {
    {
      const self = this;
      this.log(
        `xcTablesRead : Creating loader for '%s'`,
        `${tn}Mm${mm.rtn}List`
      );
      const listLoader = new DataLoader(
        BaseType.applyMiddlewareForLoader(
          [mw.middleware],
          async (parentIdsAndArg) => {
            return (
              await this.models[tn]._getGroupedManyToManyList({
                parentIds: parentIdsAndArg.map(({ id }) => id),
                child: mm.rtn,
                // todo: optimize - query only required fields
                rest: {
                  mfields1: '*',
                  ...Object.entries(parentIdsAndArg?.[0]?.args || {}).reduce(
                    (params, [key, val]) => ({
                      ...params,
                      [`m${key}1`]: val,
                    }),
                    {}
                  ),
                },
              })
            )?.map((child) => child.map((c) => new self.types[mm.rtn](c)));
          },
          [mw.postLoaderMiddleware]
        )
      );

      /* defining HasMany list method within GQL Type class */
      Object.defineProperty(this.types[tn].prototype, listPropName, {
        async value(args: any, context: any, info: any): Promise<any> {
          return listLoader.load([
            { id: this[colNameAlias], args },
            args,
            context,
            info,
          ]);
        },
        configurable: true,
      });
    }
  }

  private addHmCountResolverMethodToType(
    hm,
    mw,
    tn: string,
    loaderFunctionsObj,
    countPropName: string,
    colNameAlias
  ) {
    {
      this.log(
        `xcTablesRead : Creating loader for '%s'`,
        `${tn}Hm${hm.tn}Count`
      );
      const countLoader = new DataLoader(
        BaseType.applyMiddlewareForLoader(
          [mw.middleware],
          this.generateLoaderFromStringBody(
            loaderFunctionsObj[`${tn}Hm${hm.tn}Count`]
          ) ||
            (async (ids: string[]) => {
              const data = await this.models[tn].hasManyListCount({
                child: hm.tn,
                ids,
              });
              return data;
            }),
          [mw.postLoaderMiddleware]
        )
      );

      // defining HasMany count method within GQL Type class
      Object.defineProperty(this.types[tn].prototype, `${countPropName}`, {
        async value(args: any, context: any, info: any): Promise<any> {
          return countLoader.load([this[colNameAlias], args, context, info]);
        },
        configurable: true,
      });
    }
  }

  private adBtResolverMethodToType(
    propName: string,
    middleware: GqlMiddleware,
    tableName: string,
    belongsToRel,
    rcolNameAlias,
    colNameAlias,
    loaderFunc?: any
  ) {
    const self = this;
    const readLoader = new DataLoader(
      BaseType.applyMiddlewareForLoader(
        [middleware.middleware],
        this.generateLoaderFromStringBody(loaderFunc) ||
          (async (ids: string[]) => {
            const data = await self.models[belongsToRel.rtn].list({
              limit: ids.length,
              where: `(${belongsToRel.rcn},in,${ids.join(',')})`,
            });
            const gs = _.groupBy(data, rcolNameAlias);
            return ids.map(
              async (id: string) =>
                gs?.[id]?.[0] && new self.types[belongsToRel.rtn](gs[id][0])
            );
          }),
        [middleware.postLoaderMiddleware]
      )
    );

    // defining BelongsTo read method within GQL Type class
    Object.defineProperty(this.types[tableName].prototype, `${propName}`, {
      async value(args: any, context: any, info: any): Promise<any> {
        const colName = colNameAlias;
        return this[colName] !== null
          ? readLoader.load([this[colName], args, context, info])
          : null;
      },
      configurable: true,
    });
  }

  public async xcTablesPopulate(args?: XcTablesPopulateParams): Promise<any> {
    this.log(
      'xcTablesPopulate : names - %o , type - %s',
      args?.tableNames,
      args?.type
    );

    let order = await this.getOrderVal();

    let tables;
    /* Get all relations */
    /*    let [
      relations,
      // eslint-disable-next-line prefer-const
      missingRelations
    ] = await this.getRelationsAndMissingRelations();
    relations = relations.concat(missingRelations);*/
    const relations = await this.relationsSyncAndGet();

    // set table name alias
    relations.forEach((r) => {
      r._rtn =
        args?.tableNames?.find((t) => t.tn === r.rtn)?._tn ||
        this.getTableNameAlias(r.rtn);
      r._tn =
        args?.tableNames?.find((t) => t.tn === r.tn)?._tn ||
        this.getTableNameAlias(r.tn);
      r.enabled = true;
    });

    if (args?.tableNames?.length) {
      const relatedTableList = [];

      if (!args?.oldMetas)
        // extract tables which have relation with the tables in list
        for (const r of relations) {
          if (args.tableNames.some((t) => t.tn === r.tn)) {
            if (!relatedTableList.includes(r.rtn)) {
              relatedTableList.push(r.rtn);
              await this.onTableDelete(r.rtn);
            }
          } else if (args.tableNames.some((t) => t.tn === r.rtn)) {
            if (!relatedTableList.includes(r.tn)) {
              relatedTableList.push(r.tn);
              await this.onTableDelete(r.tn);
            }
          }
        }

      tables = args.tableNames
        .sort((a, b) => (a.tn || a._tn).localeCompare(b.tn || b._tn))
        .map(({ tn, _tn }) => ({
          tn,
          _tn,
          type: args.type,
          order: ++order,
        }));

      tables.push(...relatedTableList.map((t) => ({ tn: t })));
    } else {
      tables = (await this.sqlClient.tableList())?.data?.list
        ?.filter(({ tn }) => !IGNORE_TABLES.includes(tn))
        ?.map((t) => {
          t.order = ++order;
          return t;
        });

      // enable extra
      tables.push(
        ...(await this.sqlClient.viewList())?.data?.list
          ?.sort((a, b) =>
            (a.view_name || a.tn).localeCompare(b.view_name || b.tn)
          )
          ?.map((v) => {
            this.viewsCount++;
            v.type = 'view';
            v.tn = v.view_name;
            v.order = ++order;
            return v;
          })
          .filter((v) => {
            /* filter based on prefix */
            if (this.projectBuilder?.prefix) {
              return v.view_name.startsWith(this.projectBuilder?.prefix);
            }
            return true;
          })
      );
      // enable extra
      // let functions = [];
      // let procedures = [];
      // try {
      //   functions = (await this.sqlClient.functionList())?.data?.list?.fiter(f => !f.function_name.startsWith('_'))
      //   this.functionsCount = functions.length;
      //   this.resolversCount += this.functionsCount;
      // } catch (e) {
      // }
      // try {
      //   procedures = (await this.sqlClient.procedureList())?.data?.list?.fiter(p => !p.procedure_name.startsWith('_'));
      //   this.proceduresCount = procedures.length;
      //   this.resolversCount += this.proceduresCount;
      // } catch (e) {
      // }
      // const procedureResolver = new GqlProcedureResolver(this, functions, procedures, this.procedureOrFunctionAcls);
      // this.schemas.___procedure = procedureResolver.getSchema();
      // this.resolvers.___procedure = procedureResolver;
      // // do insertion parallelly
      // if (functions) {
      //   for (const functionObj of functions) {
      //     await this.generateAndSaveAcl(functionObj.function_name, 'function');
      //     this.log(`xcTablesPopulate : Inserting model metadata of '%s' function`, functionObj.function_name);
      //     await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_models', {
      //       title: functionObj.function_name,
      //       meta: JSON.stringify({...functionObj, type: 'function'}),
      //       type: 'function'
      //     })
      //   }
      // }
      // if (procedures) {
      //   for (const procedureObj of procedures) {
      //     await this.generateAndSaveAcl(procedureObj.procedure_name, 'procedure');
      //     this.log(`xcTablesPopulate : Inserting model metadata of '%s' procedure`, procedureObj.procedure_name);
      //     await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_models', {
      //       title: procedureObj.procedure_name,
      //       meta: JSON.stringify({...procedureObj, type: 'procedure'}),
      //       type: 'procedure'
      //     })
      //   }
      // }
    }

    /* filter based on prefix */
    if (this.projectBuilder?.prefix) {
      tables = tables.filter((t) => {
        // t._tn = t._tn || t.tn.replace(this.projectBuilder?.prefix, '');
        return t.tn.startsWith(this.projectBuilder?.prefix);
      });
    }

    this.tablesCount = tables.length;
    // await this.syncRelations();

    if (tables.length) {
      relations.forEach((rel) => (rel.enabled = true));
      const self = this;

      const tableResolvers = tables.map((table) => {
        return async () => {
          /* Filter relations for current table */
          const columns =
            args?.columns?.[table.tn] || (await this.getColumnList(table.tn));
          const hasMany =
            table.type === 'view'
              ? []
              : this.extractHasManyRelationsOfTable(relations, table.tn);
          const belongsTo =
            table.type === 'view'
              ? []
              : this.extractBelongsToRelationsOfTable(relations, table.tn);
          const ctx = this.generateContextForTable(
            table.tn,
            columns,
            relations,
            hasMany,
            belongsTo,
            table.type,
            table?._tn
          );
          // ctx._tn = table?._tn || ctx._tn;

          this.log(
            `xcTablesPopulate : Generating model metadata of '%s' %s`,
            table.tn,
            table.type
          );

          ctx.oldMeta = args?.oldMetas?.[table.tn];

          /**************** prepare table models and policies ****************/
          this.metas[table.tn] = ModelXcMetaFactory.create(
            this.connectionConfig,
            this.generateRendererArgs(ctx)
          ).getObject();

          this.models[table.tn] = this.getBaseModel(this.metas[table.tn]);
          await this.generateAndSaveAcl(table.tn, table.type);
          const policyGenerator = new ExpressXcTsPolicyGql(
            this.generateRendererArgs(ctx)
          );
          this.policies[table.tn] = policyGenerator.getObject();
          const functions = {};

          this.log(
            `xcTablesPopulate : Generating schema of '%s' %s`,
            table.tn,
            table.type
          );

          /**************** prepare GQL: schemas, types, resolvers ****************/
          // this.schemas[table.tn] = GqlXcSchemaFactory.create(this.connectionConfig, this.generateRendererArgs(ctx)).getString();

          // tslint:disable-next-line:max-classes-per-file
          this.types[table.tn] = class extends XCType {};
          this.resolvers[table.tn] = new GqlResolver(
            this.app as Noco,
            this.models,
            table.tn,
            this.types[table.tn],
            this.acls,
            functions,
            ''
          );

          if (
            !(await this.xcMeta.metaGet(
              this.projectId,
              this.dbAlias,
              'nc_models',
              { title: table.tn }
            ))
          ) {
            this.log(
              `xcTablesPopulate : Inserting model metadata of '%s' %s`,
              table.tn,
              table.type
            );

            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_models',
              {
                order: table.order || ++order,
                title: table.tn,
                type: table.type || 'table',
                meta: JSON.stringify(this.metas[table.tn]),
                // schema: this.schemas[table.tn],
                alias: this.metas[table.tn]._tn,
              }
            );
          } else if (args?.oldMetas?.[table.tn]?.id) {
            this.log(
              "xcTablesPopulate : Updating model metadata for '%s' - %s",
              table.tn,
              table.type
            );
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_models',
              {
                title: table.tn,
                alias: this.metas[table.tn]._tn,
                meta: JSON.stringify(this.metas[table.tn]),
                type: table.type || 'table',
              },
              args?.oldMetas?.[table.tn]?.id
            );
          }

          this.log(
            `xcTablesPopulate : Inserting resolver and middlewaare metadata of '%s' %s`,
            table.tn,
            table.type
          );
          if (
            !(await this.xcMeta.metaGet(
              this.projectId,
              this.dbAlias,
              'nc_resolvers',
              { title: table.tn }
            ))
          ) {
            const insertResolvers = Object.entries(this.policies[table.tn]).map(
              ([resolver, acl]) => {
                return async () => {
                  await this.xcMeta.metaInsert(
                    this.projectId,
                    this.dbAlias,
                    'nc_resolvers',
                    {
                      title: table.tn,
                      resolver,
                      acl: JSON.stringify(acl),
                    }
                  );
                };
              }
            );
            insertResolvers.push(async () => {
              await this.xcMeta.metaInsert(
                this.projectId,
                this.dbAlias,
                'nc_resolvers',
                {
                  title: table.tn,
                  handler_type: 2,
                }
              );
            });
            await NcHelp.executeOperations(
              insertResolvers,
              this.connectionConfig.client
            );
          }
        };
      });

      await NcHelp.executeOperations(
        tableResolvers,
        this.connectionConfig.client
      );

      await Promise.all(
        Object.entries(this.metas).map(async ([tn, schema]) => {
          for (const hm of schema.hasMany) {
            const colNameAlias = self.models[hm.rtn]?.columnToAlias[hm.rcn];

            const countPropName = `${hm._tn}Count`;
            const listPropName = `${hm._tn}List`;

            this.log(
              `xcTablesPopulate : Populating '%s' and '%s' loaders`,
              listPropName,
              countPropName
            );

            if (listPropName in this.types[tn].prototype) {
              continue;
            }

            /* has many relation list loader with middleware */
            const mw = new GqlMiddleware(this.acls, hm.tn, '', this.models);
            /* has many relation list loader with middleware */
            this.addHmListResolverMethodToType(
              tn,
              hm,
              mw,
              {},
              listPropName,
              colNameAlias
            );
            if (countPropName in this.types[tn].prototype) {
              continue;
            }
            {
              const mw = new GqlMiddleware(this.acls, hm.tn, null, this.models);

              // create count loader with middleware
              this.addHmCountResolverMethodToType(
                hm,
                mw,
                tn,
                {},
                countPropName,
                colNameAlias
              );
            }

            this.log(
              `xcTablesPopulate : Inserting loader metadata of '%s' and '%s' loaders`,
              listPropName,
              countPropName
            );

            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${tn}Hm${hm.tn}List`,
                parent: tn,
                child: hm.tn,
                relation: 'hm',
                resolver: 'list',
              }
            );

            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${tn}Hm${hm.tn}Count`,
                parent: tn,
                child: hm.tn,
                relation: 'hm',
                resolver: 'list',
              }
            );
          }

          for (const bt of schema.belongsTo) {
            const colNameAlias = self.models[bt.tn]?.columnToAlias[bt.cn];
            const propName = `${bt._rtn}Read`;

            if (propName in this.types[tn].prototype) {
              continue;
            }

            // create read loader with middleware
            {
              const mw = new GqlMiddleware(
                this.acls,
                bt.rtn,
                null,
                this.models
              );
              this.log(
                `xcTablesRead : Creating loader for '%s'`,
                `${tn}Bt${bt.rtn}`
              );
              this.adBtResolverMethodToType(
                propName,
                mw,
                tn,
                bt,
                colNameAlias,
                colNameAlias,
                null
              );
            }

            this.log(
              `xcTablesPopulate : Inserting loader metadata of '%s' loader`,
              propName
            );

            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${tn}Bt${bt.rtn}`,
                parent: bt.rtn,
                child: tn,
                relation: 'bt',
                resolver: 'Read',
              }
            );
          }
        })
      );

      await this.getManyToManyRelations();

      // generate schema of models
      for (const meta of Object.values(this.metas)) {
        /**************** prepare GQL: schemas, types, resolvers ****************/
        this.schemas[meta.tn] = GqlXcSchemaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs({
            ...this.generateContextForTable(
              meta.tn,
              meta.columns,
              relations,
              meta.hasMany,
              meta.belongsTo,
              meta.type,
              meta._tn
            ),
            manyToMany: meta.manyToMany,
          })
        ).getString();

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            schema: this.schemas[meta.tn],
          },
          {
            title: meta.tn,
          }
        );
      }

      // add property in type class for many to many relations
      await Promise.all(
        Object.entries(this.metas).map(async ([tn, meta]) => {
          if (!meta.manyToMany) {
            return;
          }
          for (const mm of meta.manyToMany) {
            const countPropName = `${mm._rtn}Count`;
            const listPropName = `${mm._rtn}MMList`;

            this.log(
              `xcTablesPopulate : Populating  '%s' and '%s' many to many loaders`,
              listPropName,
              countPropName
            );

            if (listPropName in this.types[tn].prototype) {
              continue;
            }

            /* has many relation list loader with middleware */
            const mw = new GqlMiddleware(this.acls, mm.rtn, '', this.models);
            /* has many relation list loader with middleware */
            this.addMMListResolverMethodToType(
              tn,
              mm,
              mw,
              {},
              listPropName,
              meta.columns.find((c) => c.pk)._cn
            );
            // if (countPropName in this.types[tn].prototype) {
            //   continue;
            // }
            // {
            //   const mw = new GqlMiddleware(this.acls, hm.tn, null, this.models);
            //
            //   // create count loader with middleware
            //   this.addHmCountResolverMethodToType(hm, mw, tn, {}, countPropName, colNameAlias);
            // }
            //
            // this.log(`xcTablesPopulate : Inserting loader metadata of '%s' and '%s' loaders`, listPropName, countPropName);
            //
            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${tn}Mm${mm.rtn}List`,
                parent: tn,
                child: mm.rtn,
                relation: 'mm',
                resolver: 'mmlist',
              }
            );

            // await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
            //   title: `${tn}Mm${hm.tn}Count`,
            //   parent: mm.tn,
            //   child: mm.rtn,
            //   relation: 'hm',
            //   resolver: 'list',
            // });
          }
        })
      );
    }
  }

  public setSchema(key: string, value: string): void {
    this.log(`setSchema : '%s'`, key);

    this.schemas[key] = value;
  }

  public setResolvers(key: string, value: any): void {
    this.log(`setResolvers : '%s'`, key);
    this.resolvers[key] = value;
  }

  // NOTE: xc-meta
  public async xcTablesRowDelete(tn: string, extras?: any): Promise<void> {
    this.log(`xcTablesRowDelete : Deleting metadata of '%s' table`, tn);
    await super.xcTablesRowDelete(tn, extras);

    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_resolvers', {
      title: tn,
    });
  }

  public async onHandlerCodeUpdate(tn: string): Promise<void> {
    this.log(`onHandlerCodeUpdate : '%s' table`, tn);
    await this.xcTablesRead([tn]);
    await this.reInitializeGraphqlEndpoint();
  }

  // NOTE: xc-meta
  public async xcTableRename(
    oldTablename: string,
    newTablename: string
  ): Promise<any> {
    this.log(`xcTableRename : '%s'  => '%s'`, oldTablename, newTablename);

    //todo: verify the update queries

    // const metaArr = await (this.sqlClient.knex as XKnex)('nc_models').select();
    const metaArr = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_models'
    );
    const enabledModels = metaArr.filter((m) => m.enabled).map((m) => m.title);
    /* Get all relations */
    const relations = await this.getXcRelationList();

    const relatedTableList = this.getRelationTableNames(
      relations,
      newTablename,
      enabledModels
    );
    {
      /* filter relation where this table is present */
      const tableRelations = this.filterRelationsForTable(
        relations,
        newTablename
      );
      const hasMany = this.extractHasManyRelationsOfTable(
        tableRelations,
        newTablename
      );
      const belongsTo = this.extractBelongsToRelationsOfTable(
        tableRelations,
        newTablename
      );
      const columns = await this.getColumnList(newTablename);
      const ctx = this.generateContextForTable(
        newTablename,
        columns,
        relations,
        hasMany,
        belongsTo
      );
      const enabledModelCtx = this.generateContextForTable(
        newTablename,
        columns,
        this.filterRelationsForTable(
          tableRelations,
          newTablename,
          enabledModels
        ),
        this.extractHasManyRelationsOfTable(
          hasMany,
          newTablename,
          enabledModels
        ),
        this.extractBelongsToRelationsOfTable(
          belongsTo,
          newTablename,
          enabledModels
        )
      );

      // todo: delete resolvers for relation tables

      this.log(
        `xcTableRename : Deleting model with old name '%s'`,
        oldTablename
      );
      // delete old model
      delete this.models[oldTablename];
      this.log(
        `xcTableRename : Generating new model meta for renamed table - '%s' => '%s'`,
        oldTablename,
        newTablename
      );
      /* create models from table */
      const meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();
      this.metas[newTablename] = meta;

      /**************** prepare GQL: schemas, types, resolvers ****************/
      if (enabledModels.includes(oldTablename)) {
        this.schemas[newTablename] = GqlXcSchemaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs(enabledModelCtx)
        ).getString();
      }

      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: oldTablename }
      );
      if (existingModel) {
        // todo: persisting old table_alias and columnAlias
        const oldMeta = JSON.parse(existingModel.meta);
        Object.assign(meta, {
          columns: oldMeta.columns,
        });
        this.log(
          `xcTableRename : Updating model meta - '%s' => '%s'`,
          oldTablename,
          newTablename
        );

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: newTablename,
            meta: JSON.stringify(meta),
            schema: this.schemas[newTablename],
            alias: meta._tn,
          },
          { title: oldTablename }
        );
      }

      // update resolvers name in db
      const newResolvers: any[] = Object.keys(
        new ExpressXcTsPolicyGql(
          this.generateRendererArgs(enabledModelCtx)
        ).getObject()
      );
      const oldResolvers: any[] = Object.keys(
        new ExpressXcTsPolicyGql(
          this.generateRendererArgs(
            this.generateContextForTable(oldTablename, [], [], [], [])
          )
        ).getObject()
      );

      let i = 0;

      this.log(
        `xcTableRename : Updating resolvers name and table name - '%s' => '%s'`,
        oldTablename,
        newTablename
      );
      for (const res of newResolvers) {
        const oldRes = oldResolvers[i++];
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_resolvers',
          {
            title: newTablename,
            resolver: res,
          },
          {
            title: oldTablename,
            resolver: oldRes,
            handler_type: 1,
          }
        );
      }
      // update resolvers in db
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_resolvers',
        {
          title: newTablename,
        },
        {
          title: oldTablename,
          handler_type: 2,
        }
      );

      /* handle relational routes  */
      for (const hm of meta.hasMany) {
        this.log(
          `xcTableRename : Updating HasMany relation '%s' => `,
          `${oldTablename}Hm${hm.tn}`,
          `${newTablename}Hm${hm.tn}`
        );

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_loaders',
          {
            title: `${newTablename}Hm${hm.tn}List`,
            parent: newTablename,
          },
          {
            title: `${oldTablename}Hm${hm.tn}List`,
            parent: oldTablename,
            child: hm.tn,
            relation: 'hm',
            resolver: 'list',
          }
        );
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_loaders',
          {
            title: `${newTablename}Hm${hm.tn}Count`,
            parent: newTablename,
          },
          {
            title: `${oldTablename}Hm${hm.tn}Count`,
            parent: oldTablename,
            child: hm.tn,
            relation: 'hm',
            resolver: 'list',
          }
        );
      }

      /* handle belongs to routes and controllers */
      for (const bt of meta.belongsTo) {
        this.log(
          `xcTableRename : Updating BelongsTo relation '%s' => '%s'`,
          `${oldTablename}Bt${bt.rtn}`,
          `${newTablename}Bt${bt.rtn}`
        );
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_loaders',
          {
            title: `${newTablename}Bt${bt.rtn}`,
            child: newTablename,
          },
          {
            title: `${oldTablename}Bt${bt.rtn}`,
            parent: bt.rtn,
            child: oldTablename,
            relation: 'bt',
            resolver: 'Read',
          }
        );
      }
    }
    {
      /* Reload relation tables : start */
      // reload routes and update meta  for relation tables
      for (const relationTable of relatedTableList) {
        const columns = await this.getColumnList(relationTable);
        const rHasMany = this.extractHasManyRelationsOfTable(
          relations,
          relationTable
        );
        const rBelongsTo = this.extractBelongsToRelationsOfTable(
          relations,
          relationTable
        );
        const rCtx = this.generateContextForTable(
          relationTable,
          columns,
          relations,
          rHasMany,
          rBelongsTo
        );
        const enabledModelCtx = this.generateContextForTable(
          relationTable,
          columns,
          this.filterRelationsForTable(relations, newTablename, enabledModels),
          this.extractHasManyRelationsOfTable(
            rHasMany,
            newTablename,
            enabledModels
          ),
          this.extractBelongsToRelationsOfTable(
            rBelongsTo,
            newTablename,
            enabledModels
          )
        );
        /* create models from table */
        const rMeta = ModelXcMetaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs(rCtx)
        ).getObject();
        this.schemas[relationTable] = GqlXcSchemaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs(enabledModelCtx)
        ).getString();
        // update existing model meta with new details(relation tables)
        const rExistingModel = await this.xcMeta.metaGet(
          this.projectId,
          this.dbAlias,
          'nc_models',
          { title: relationTable }
        );

        if (rExistingModel) {
          // todo: persisting old table_alias and columnAlias
          const oldMeta = JSON.parse(rExistingModel.meta);
          Object.assign(oldMeta, {
            hasMany: rMeta.hasMany,
            belongsTo: rMeta.belongsTo,
          });
          this.log(
            `xcTableRename : Updating related table model meta - '%s'`,
            relationTable
          );

          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_models',
            {
              meta: JSON.stringify(oldMeta),
              schema: this.schemas[relationTable],
            },
            { title: relationTable }
          );
          this.metas[relationTable] = oldMeta;
        }

        this.models[relationTable] = this.getBaseModel(
          this.metas[relationTable]
        );

        // update has many to routes
        for (const hmRelation of rHasMany) {
          if (hmRelation.tn === newTablename) {
            this.log(
              `xcTableRename : Updating HasMany relation '%s' => '%s'`,
              `${relationTable}Hm${oldTablename}`,
              `${relationTable}Hm${newTablename}`
            );

            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${relationTable}Hm${newTablename}List`,
                child: newTablename,
              },
              {
                title: `${relationTable}Hm${oldTablename}List`,
                parent: relationTable,
                child: oldTablename,
                relation: 'hm',
                resolver: 'list',
              }
            );
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${relationTable}Hm${newTablename}Count`,
                child: newTablename,
              },
              {
                title: `${relationTable}Hm${oldTablename}Count`,
                parent: relationTable,
                child: oldTablename,
                relation: 'hm',
                resolver: 'list',
              }
            );
          }
        }

        // update belongs to routes
        for (const btRelation of rBelongsTo) {
          if (btRelation.rtn === newTablename) {
            this.log(
              `xcTableRename : Updating BelongsTo relation '%s' => '%s'`,
              `${relationTable}Hm${oldTablename}`,
              `${relationTable}Hm${newTablename}`
            );

            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_loaders',
              {
                title: `${relationTable}Bt${newTablename}`,
                parent: newTablename,
              },
              {
                title: `${relationTable}Bt${oldTablename}`,
                parent: oldTablename,
                child: relationTable,
                relation: 'bt',
                resolver: 'Read',
              }
            );
          }
        }

        /* Reload relation tables : end */
      }
    }

    delete this.resolvers[oldTablename];
    delete this.schemas[oldTablename];

    // load routes and models from db
    await this.xcTablesRead([...relatedTableList, newTablename]);
    await this.reInitializeGraphqlEndpoint();
  }

  public async onTableAliasRename(
    oldTableAliasName: string,
    newTableAliasName: string
  ): Promise<void> {
    this.log(
      "onTableAliasRename : '%s' => '%s'",
      oldTableAliasName,
      newTableAliasName
    );
    if (oldTableAliasName === newTableAliasName) {
      return;
    }

    const {
      // meta,
      relatedTableList,
      tableName: t,
    } = await super.onTableAliasRename(oldTableAliasName, newTableAliasName);

    for (const table of [t, ...relatedTableList]) {
      const meta = this.getMeta(table);

      const ctx = this.generateContextForMeta(meta);
      ctx.manyToMany = meta.manyToMany;
      ctx.v = meta.v;
      this.schemas[table] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();

      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: this.schemas[table],
        },
        { title: table }
      );

      const newResolvers: any[] = Object.keys(
        new ExpressXcTsPolicyGql({ ctx }).getObject()
      );

      const oldResolvers: any[] = Object.keys(
        new ExpressXcTsPolicyGql(
          this.generateRendererArgs({ ...ctx, _tn: oldTableAliasName })
        ).getObject()
      );

      let i = 0;

      // this.log(
      //   `xcTableRename : Updating resolvers name and table name - '%s' => '%s'`,
      //   oldTablename,
      //   newTablename
      // );
      for (const res of newResolvers) {
        const oldRes = oldResolvers[i++];
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_resolvers',
          {
            resolver: res,
          },
          {
            title: table,
            resolver: oldRes,
            handler_type: 1,
          }
        );
      }
    }

    // load routes and models from db
    await this.xcTablesRead([...relatedTableList, t]);
    await this.reInitializeGraphqlEndpoint();

    // }
  }

  public async onRelationCreate(tnp: string, tnc: string, args): Promise<void> {
    await super.onRelationCreate(tnp, tnc, args);
    this.log(`onRelationCreate : Within relation create event handler`);
    // const self = this;
    const relations = await this.getXcRelationList();

    // set table name alias
    relations.forEach((r) => {
      r._rtn = this.getTableNameAlias(r.rtn);
      r._tn = this.getTableNameAlias(r.tn);
      r.enabled = true;
    });

    /* update parent table meta and resolvers */
    {
      const columns = this.metas[tnp]?.columns;
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnp);
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnp);
      const ctx = this.generateContextForTable(
        tnp,
        columns,
        relations,
        hasMany,
        belongsTo
      );
      ctx.manyToMany = this.metas?.[tnp]?.manyToMany;
      const meta = ModelXcMetaFactory.create(this.connectionConfig, {
        dir: '',
        ctx,
        filename: '',
      }).getObject();
      // this.metas[tnp] = meta;
      this.schemas[tnp] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();

      // update old model meta with new details
      this.log(
        `onRelationCreate : Generating and updating model meta for parent table '%s'`,
        tnp
      );
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnp }
      );
      let queryParams;
      try {
        queryParams = JSON.parse(existingModel.query_params);
      } catch (e) {
        /* */
      }
      if (existingModel) {
        // todo: persisting old table_alias and columnAlias
        // todo: get enable state of other relations
        const oldMeta = JSON.parse(existingModel.meta);
        meta.hasMany.forEach((hm) => {
          hm.enabled = true;
        });
        Object.assign(oldMeta, {
          hasMany: meta.hasMany,
        });

        /* Add new has many relation to virtual columns */
        oldMeta.v = oldMeta.v || [];
        oldMeta.v.push({
          hm: meta.hasMany.find((hm) => hm.rtn === tnp && hm.tn === tnc),
          _cn: `${this.getTableNameAlias(tnp)} => ${this.getTableNameAlias(
            tnc
          )}`,
        });
        if (queryParams?.showFields) {
          queryParams.showFields[
            `${this.getTableNameAlias(tnp)} => ${this.getTableNameAlias(tnc)}`
          ] = true;
        }

        this.models[tnp] = this.getBaseModel(oldMeta);

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnp,
            meta: JSON.stringify(oldMeta),
            schema: this.schemas[tnp],
            ...(queryParams
              ? { query_params: JSON.stringify(queryParams) }
              : {}),
          },
          { title: tnp }
        );
      }

      const countPropName = `${this.getTableNameAlias(tnc)}Count`;
      const listPropName = `${this.getTableNameAlias(tnc)}List`;

      this.log(
        `onRelationCreate : Generating and inserting '%s' and '%s' loaders`,
        countPropName,
        listPropName
      );

      const hm = hasMany.find((rel) => rel.tn === tnc);
      {
        /* has many relation list loader with middleware */
        const mw = new GqlMiddleware(this.acls, tnc, '', this.models);
        this.addHmListResolverMethodToType(
          tnp,
          hm,
          mw,
          {},
          listPropName,
          this.models[hm.rtn]?.columnToAlias[hm.rcn]
        );
      }
      /*      const listLoader = new DataLoader(
              BaseType.applyMiddlewareForLoader(
                [mw.middleware],
                async ids => {
                  const data = await this.models[tnp].hasManyListGQL({
                    ids,
                    child: tnc
                  })
                  return ids.map(id => data[id] ? data[id].map(c => new self.types[tnc](c)) : []);
                },
                [mw.postLoaderMiddleware]
              ));



            /!* defining HasMany list method within GQL Type class *!/
            Object.defineProperty(this.types[tnp].prototype, `${listPropName}`, {
              async value(args, context, info): Promise<any> {
                return listLoader.load([this[hm.rcn], args, context, info]);
              },
              configurable: true
            })*/

      // create count loader with middleware
      {
        const mw = new GqlMiddleware(this.acls, tnc, '', this.models);
        this.addHmCountResolverMethodToType(
          mw,
          hm,
          tnp,
          {},
          countPropName,
          this.models[hm.rtn]?.columnToAlias[hm.rcn]
        );

        /*const countLoader = new DataLoader(
          BaseType.applyMiddlewareForLoader(
            [mw.middleware],
            async ids => {
              const data = await this.models[tnp].hasManyListCount({
                ids,
                child: tnc
              })
              return data;
            },
            [mw.postLoaderMiddleware]
          ));

        // defining HasMany count method within GQL Type class
        Object.defineProperty(this.types[tnp].prototype, `${countPropName}`, {
          async value(args, context, info): Promise<any> {
            return countLoader.load([this[hm.rcn], args, context, info]);
          },
          configurable: true
        })*/
      }

      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
        title: `${tnp}Hm${tnc}List`,
        parent: tnp,
        child: tnc,
        relation: 'hm',
        resolver: 'list',
      });

      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
        title: `${tnp}Hm${tnc}Count`,
        parent: tnp,
        child: tnc,
        relation: 'hm',
        resolver: 'list',
      });
    }

    /* update child table meta and resolvers */
    {
      const columns = this.metas[tnc]?.columns;
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnc);
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnc);
      const ctx = this.generateContextForTable(
        tnc,
        columns,
        relations,
        hasMany,
        belongsTo
      );
      ctx.manyToMany = this.metas?.[tnc]?.manyToMany;
      const meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();
      // this.metas[tnc] = meta;
      this.schemas[tnc] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();

      this.log(
        `onRelationCreate : Generating and updating model meta for child table '%s'`,
        tnc
      );
      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnc }
      );
      let queryParams;
      try {
        queryParams = JSON.parse(existingModel.query_params);
      } catch (e) {
        /* */
      }

      if (existingModel) {
        // todo: persisting old table_alias and columnAlias
        const oldMeta = JSON.parse(existingModel.meta);
        Object.assign(oldMeta, {
          belongsTo: meta.belongsTo,
        });
        /* Add new belongs to relation to virtual columns */
        oldMeta.v = oldMeta.v || [];
        oldMeta.v.push({
          bt: meta.belongsTo.find((hm) => hm.rtn === tnp && hm.tn === tnc),
          _cn: `${this.getTableNameAlias(tnp)} <= ${this.getTableNameAlias(
            tnc
          )}`,
        });

        if (queryParams?.showFields) {
          queryParams.showFields[
            `${this.getTableNameAlias(tnp)} <= ${this.getTableNameAlias(tnc)}`
          ] = true;
        }
        this.models[tnc] = this.getBaseModel(oldMeta);
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnc,
            meta: JSON.stringify(oldMeta),
            schema: this.schemas[tnc],
            ...(queryParams
              ? { query_params: JSON.stringify(queryParams) }
              : {}),
          },
          { title: tnc }
        );
      }

      const propName = `${this.getTableNameAlias(tnp)}Read`;
      this.log(
        `onRelationCreate : Generating and inserting'%s' loader`,
        propName
      );

      const currentRelation = belongsTo.find((rel) => rel.rtn === tnp);

      // create read loader with middleware
      const mw = new GqlMiddleware(this.acls, tnp, '', this.models);
      this.adBtResolverMethodToType(
        propName,
        mw,
        tnc,
        currentRelation,
        this.models[currentRelation.rtn]?.columnToAlias[currentRelation.rcn],
        this.models[currentRelation.tn]?.columnToAlias[currentRelation?.cn]
      );
      /*const readLoader = new DataLoader(
        BaseType.applyMiddlewareForLoader(
          [mw.middleware],
          async ids => {
            const data = await self.models[tnp].list({
              where: `(${currentRelation.rcn},in,${ids.join(',')})`,
              limit: ids.length
            })
            const gs = _.groupBy(data, currentRelation.rcn);
            return ids.map(async id => gs?.[id]?.[0] && new self.types[currentRelation.rtn](gs[id][0]))
          },
          [mw.postLoaderMiddleware]
        ));

      // defining BelongsTo read method within GQL Type class
      Object.defineProperty(this.types[tnc].prototype, `${propName}`, {
        async value(args, context, info): Promise<any> {
          return readLoader.load([this[currentRelation.cn], args, context, info]);
        },
        configurable: true
      })*/

      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
        title: `${tnc}Bt${tnp}`,
        parent: tnp,
        child: tnc,
        relation: 'bt',
        resolver: 'Read',
      });
    }

    await this.reInitializeGraphqlEndpoint();
  }

  public async onPolicyUpdate(tn: string): Promise<void> {
    this.log(`onPolicyUpdate : Within policy update handler of '%s' table`, tn);

    await this.xcTablesRead([tn]);
    await this.reInitializeGraphqlEndpoint();
  }

  public async onRelationDelete(tnp: string, tnc: string, args): Promise<void> {
    await super.onRelationDelete(tnp, tnc, args);

    this.log(
      `onRelationDelete : Within relation delete handler of '%s' => '%s'`,
      tnp,
      tnc
    );

    const relations = await this.getXcRelationList();

    /* update parent table meta and resolvers */
    {
      const columns = this.metas[tnp]?.columns; //await this.getColumnList(tnp);
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnp);
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnp);
      const ctx = this.generateContextForTable(
        tnp,
        columns,
        relations,
        hasMany,
        belongsTo
      );
      const meta = ModelXcMetaFactory.create(this.connectionConfig, {
        dir: '',
        ctx,
        filename: '',
      }).getObject();

      this.schemas[tnp] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();

      this.log(
        `onRelationDelete : Generating and updating model meta for parent table '%s'`,
        tnp
      );
      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnp }
      );
      if (existingModel) {
        // todo: persisting old table_alias and columnAlias
        const oldMeta = JSON.parse(existingModel.meta);
        Object.assign(oldMeta, {
          hasMany: meta.hasMany,
          v: oldMeta.v.filter(
            ({ hm, lk }) =>
              (!hm || hm.rtn !== tnp || hm.tn !== tnc) &&
              !(lk && lk.type === 'hm' && lk.rtn === tnp && lk.tn === tnc)
          ),
        });
        // todo: backup schema
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnp,
            meta: JSON.stringify(oldMeta),
            schema: this.schemas[tnp],
          },
          { title: tnp }
        );
        this.models[tnp] = this.getBaseModel(oldMeta);
      }

      const countPropName = `${this.getTableNameAlias(tnc)}Count`;
      const listPropName = `${this.getTableNameAlias(tnc)}List`;

      this.log(
        `onRelationDelete : Deleting '%s' and '%s' loaders`,
        countPropName,
        listPropName
      );
      /* defining HasMany list method within GQL Type class */
      delete this.types[tnp].prototype[`${listPropName}`];

      // defining HasMany count method within GQL Type class
      delete this.types[tnp].prototype[`${countPropName}`];

      await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_loaders', {
        parent: tnp,
        child: tnc,
      });
    }

    /* update child table meta and resolvers */
    {
      const columns = await this.getColumnList(tnc);
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnc);
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnc);
      const ctx = this.generateContextForTable(
        tnc,
        columns,
        relations,
        hasMany,
        belongsTo
      );
      const meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();

      this.schemas[tnc] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();

      this.log(
        `onRelationDelete : Generating and updating model meta for child table '%s'`,
        tnc
      );
      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnc }
      );
      if (existingModel) {
        // todo: persisting old table_alias and columnAlias
        const oldMeta = JSON.parse(existingModel.meta);
        Object.assign(oldMeta, {
          belongsTo: meta.belongsTo,
          v: oldMeta.v.filter(
            ({ bt, lk }) =>
              (!bt || bt.rtn !== tnp || bt.tn !== tnc) &&
              !(lk && lk.type === 'bt' && lk.rtn === tnp && lk.tn === tnc)
          ),
        });
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnc,
            meta: JSON.stringify(oldMeta),
            schema: this.schemas[tnc],
          },
          { title: tnc }
        );
        this.models[tnc] = this.getBaseModel(oldMeta);
      }

      const propName = `${this.getTableNameAlias(tnp)}Read`;
      this.log(`onRelationDelete : Deleting '%s' loader`, propName);

      // defining BelongsTo read method within GQL Type class
      delete this.types[tnc].prototype[`${propName}`];

      await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_loaders', {
        parent: tnp,
        child: tnc,
      });
    }

    this.models[tnc] = this.getBaseModel(this.metas[tnc]);
    this.models[tnp] = this.getBaseModel(this.metas[tnp]);

    await this.reInitializeGraphqlEndpoint();
  }

  public async onTableUpdate(changeObj: any): Promise<void> {
    this.log(`onTableUpdate :  '%s'`, changeObj.tn);
    await super.onTableUpdate(changeObj, async ({ ctx }) => {
      const tn = changeObj.tn;
      const metaArr = await this.xcMeta.metaList(
        this.projectId,
        this.dbAlias,
        'nc_models'
      );
      const enabledModels = metaArr
        .filter((m) => m.enabled)
        .map((m) => m.title);

      if (!enabledModels.includes(changeObj.tn)) {
        return;
      }
      const enabledModelCtx = this.generateContextForTable(
        tn,
        ctx.columns,
        this.filterRelationsForTable(ctx.relations, tn, enabledModels),
        this.extractHasManyRelationsOfTable(ctx.hasMany, tn, enabledModels),
        this.extractBelongsToRelationsOfTable(ctx.belongsTo, tn, enabledModels)
      );

      const oldSchema = this.schemas[tn];
      this.log(
        `onTableUpdate :  Populating new schema for '%s' table`,
        changeObj.tn
      );
      this.schemas[tn] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(enabledModelCtx)
      ).getString();
      if (oldSchema !== this.schemas[tn]) {
        this.log(
          `onTableUpdate :  Updating and taking backup of schema - '%s' table`,
          changeObj.tn
        );

        // const oldModel = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
        //   title: tn
        // });

        // keep upto 5 schema backup on table update
        // let previousSchemas = [oldSchema]
        // if (oldModel.schema_previous) {
        //   previousSchemas = [...JSON.parse(oldModel.schema_previous), oldSchema].slice(-5);
        // }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            schema: this.schemas[tn],
            // schema_previous: JSON.stringify(previousSchemas)
          },
          {
            title: tn,
          }
        );
      }
    });
    await this.reInitializeGraphqlEndpoint();
  }

  public async onViewUpdate(viewName: string): Promise<void> {
    this.log(`onViewUpdate :  '%s'`, viewName);

    await super.onViewUpdate(viewName, async ({ ctx, meta }) => {
      const metaArr = await this.xcMeta.metaList(
        this.projectId,
        this.dbAlias,
        'nc_models'
      );
      const enabledModels = metaArr
        .filter((m) => m.enabled)
        .map((m) => m.title);

      if (!enabledModels.includes(viewName)) {
        return;
      }

      const enabledModelCtx = this.generateContextForTable(
        viewName,
        ctx.columns,
        [],
        [],
        [],
        'view'
      );

      const oldSchema = this.schemas[viewName];
      this.log(`onViewUpdate :  Populating new schema for '%s' view`, viewName);
      meta.schema = this.schemas[viewName] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(enabledModelCtx)
      ).getString();
      if (oldSchema !== this.schemas[viewName]) {
        this.log(
          `onViewUpdate :  Updating and taking backup of schema - '%s' view`,
          viewName
        );

        // const oldModel = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
        //   title: viewName
        // });

        // // keep upto 5 schema backup on table update
        // let previousSchemas = [oldSchema]
        // if (oldModel.schema_previous) {
        //   previousSchemas = [...JSON.parse(oldModel.schema_previous), oldSchema].slice(-5);
        // }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            schema: meta.schema,
            // schema_previous: JSON.stringify(previousSchemas)
          },
          {
            title: viewName,
          }
        );
      }
    });
    await this.reInitializeGraphqlEndpoint();
  }

  public async onGqlSchemaUpdate(tn: string, schema: string): Promise<void> {
    this.log(`onGqlSchemaUpdate :  '%s'`, tn);
    this.schemas[tn] = schema;
    await this.reInitializeGraphqlEndpoint();
  }

  public async onMiddlewareCodeUpdate(tn: string): Promise<void> {
    this.log(`onMiddlewareCodeUpdate :  '%s'`, tn);

    this.log(
      `onMiddlewareCodeUpdate :  Updating middleware code in meta table - '%s' table`,
      tn
    );

    const middleware = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_resolvers',
      {
        handler_type: 2,
        title: tn,
      }
    );

    let middlewareBody = null;
    if (middleware.functions) {
      try {
        middlewareBody = JSON.parse(middleware.functions)[0];
      } catch (e) {
        console.log(e.message);
      }
    }
    this.log(
      `onMiddlewareCodeUpdate :  Updating resolvers with new middleware - '%s' table`,
      tn
    );

    this.resolvers[tn].updateMiddlewareBody(middlewareBody);
    await this.reInitializeGraphqlEndpoint();

    // todo: update middleware for loaders
  }

  public async onToggleModels(enabledModels: string[]): Promise<void> {
    this.log(`onToggleModels : %o`, enabledModels);

    /* Get all relations */
    const relations = await this.getXcRelationList();
    const generateNewSchemas = enabledModels.map((tn) => {
      return async () => {
        /* Filter relations for current table */
        const columns = await this.getColumnList(tn);
        const hasMany = this.extractHasManyRelationsOfTable(
          relations,
          tn,
          enabledModels
        );
        const belongsTo = this.extractBelongsToRelationsOfTable(
          relations,
          tn,
          enabledModels
        );
        const ctx = this.generateContextForTable(
          tn,
          columns,
          [...hasMany, ...belongsTo],
          hasMany,
          belongsTo
        );

        this.log(`onToggleModels : Generating new schema for '%s'`, tn);
        const newSchemaa = GqlXcSchemaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs(ctx)
        ).getString();

        if (newSchemaa !== this.schemas[tn]) {
          // const oldModel = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
          //   title: tn
          // });

          // this.log(`onToggleModels : Updating and taking backup of schema for '%s'`, tn);
          // let previousSchemas = [this.schemas[tn]];
          // if (oldModel.schema_previous) {
          //   previousSchemas = [...JSON.parse(oldModel.schema_previous), [this.schemas[tn]]].slice(-5);
          // }
          this.schemas[tn] = newSchemaa;
          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_models',
            {
              schema: this.schemas[tn],
              // schema_previous: JSON.stringify(previousSchemas)
            },
            {
              title: tn,
            }
          );
        }
      };
    });

    await NcHelp.executeOperations(
      generateNewSchemas,
      this.connectionConfig.client
    );
    this.metas = {};
    this.schemas = {};
    this.resolvers = {};
    this.models = {};
    await this.xcTablesRead();
    await this.reInitializeGraphqlEndpoint();
  }

  public async onViewCreate(viewName: string): Promise<void> {
    this.log(`onViewCreate : '%s'`, viewName);
    await this.xcTablesPopulate({
      tableNames: [{ tn: viewName }],
      type: 'view',
    });
    await this.reInitializeGraphqlEndpoint();
  }

  public async onFunctionCreate(functionName: string): Promise<void> {
    this.log(`onFunctionCreate : '%s'`, functionName);

    const functions = (await this.sqlClient.functionList())?.data?.list;
    // do insertion parallelly
    const functionObj = functions.find((f) => f.function_name === functionName);
    if (functionObj) {
      this.log(
        `onFunctionCreate : Generating and inserting '%s' function meta and acl`,
        functionName
      );

      await this.generateAndSaveAcl(functionObj.function_name, 'function');
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_models', {
        title: functionObj.function_name,
        meta: JSON.stringify({ ...functionObj, type: 'function' }),
        type: 'function',
      });
    }
    this.generateAndSaveAcl(functionName, 'function');

    this.resolvers.___procedure.functionsSet(functions);
    this.schemas.___procedure = this.resolvers.___procedure.getSchema();
    await this.reInitializeGraphqlEndpoint();
  }

  public async onFunctionDelete(functionName: string): Promise<void> {
    this.log(`onFunctionDelete : '%s'`, functionName);

    this.log(`onFunctionCreate : Deleting '%s' function meta`, functionName);

    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: functionName,
      type: 'function',
    });

    this.resolvers.___procedure.functionDelete(functionName);
    this.schemas.___procedure = this.resolvers.___procedure.getSchema();

    await this.reInitializeGraphqlEndpoint();
  }

  public async onProcedureCreate(procedureName: string): Promise<void> {
    this.log(`onProcedureCreate : '%s'`, procedureName);

    const procedures = (await this.sqlClient.procedureList())?.data?.list;
    // do insertion parallelly
    const procedureObj = procedures.find(
      (f) => f.procedure_name === procedureName
    );
    if (procedureObj) {
      this.log(
        `onProcedureCreate :Generating and inserting '%s' procedure meta and acl`,
        procedureName
      );

      await this.generateAndSaveAcl(procedureObj.procedure_name, 'procedure');
      await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_models', {
        title: procedureObj.procedure_name,
        meta: JSON.stringify({ ...procedureObj, type: 'procedure' }),
        type: 'procedure',
      });
    }
    this.generateAndSaveAcl(procedureName, 'procedure');

    this.resolvers.___procedure.proceduresSet(procedures);
    this.schemas.___procedure = this.resolvers.___procedure.getSchema();
    await this.reInitializeGraphqlEndpoint();
  }

  public async onProcedureDelete(procedureName: string): Promise<void> {
    this.log(`onProcedureDelete : '%s'`, procedureName);

    this.log(`onProcedureDelete : Deleting '%s' function meta`, procedureName);
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: procedureName,
      type: 'procedure',
    });

    this.resolvers.___procedure.procedureDelete(procedureName);
    this.schemas.___procedure = this.resolvers.___procedure.getSchema();

    await this.reInitializeGraphqlEndpoint();
  }

  async reInitializeGraphqlEndpoint(): Promise<void> {
    this.log(
      `reInitializeGraphqlEndpoint : Reinitializing graphql router endpoint`
    );

    await this.initGraphqlRoute();

    const grIndex = this.gqlRouter.stack.findIndex((r) => {
      return r?.regexp?.test('/graphql/');
    });
    this.gqlRouter.stack.splice(grIndex, 1);
  }

  private async initGraphqlRoute(): Promise<void> {
    this.log(`initGraphqlRoute : Initializing graphql router endpoint`);
    try {
      const { mergeResolvers, mergeTypeDefs } = await import(
        '@graphql-tools/merge'
      );
      const { graphqlHTTP } = await import('express-graphql');
      const { buildSchema } = await import('graphql');
      const { default: depthLimit } = await import('graphql-depth-limit');

      this.log(`initGraphqlRoute : Merging resolvers`);
      const rootValue = mergeResolvers([
        {
          nocodb_health() {
            return 'Coming soon';
          },
          m2mNotChildren: m2mNotChildren({ models: this.models }),
          m2mNotChildrenCount: m2mNotChildrenCount({ models: this.models }),
          JSON: GraphQLJSON,
        },
        ...Object.values(this.resolvers).map((r) =>
          r.mapResolvers(this.customResolver)
        ),
      ]);

      this.log(`initGraphqlRoute : Building graphql schema`);
      const schemaStr = mergeTypeDefs(
        [
          ...Object.values(this.schemas).filter(Boolean),
          ` ${this.customResolver?.schema || ''} \n ${commonSchema}`,
          // ...this.typesWithFormulaProps
        ],
        {
          commentDescriptions: true,
          forceSchemaDefinition: true,
          reverseDirectives: true,
          throwOnConflict: true,
          useSchemaDefinition: true,
        }
      );
      const schema = buildSchema(schemaStr);

      this.log(
        `initGraphqlRoute : Initializing graphql endpoint - '%s'`,
        '/graphql'
      );
      this.gqlRouter.use('/graphql', (req, res, next) => {
        graphqlHTTP({
          context: { req, res, next },
          graphiql: {
            headerEditorEnabled: true,
          },
          rootValue,
          schema,
          validationRules: [
            depthLimit(
              this.connectionConfig?.meta?.api?.graphqlDepthLimit ?? 10
            ),
          ],
          customExecuteFn: async (args) => {
            const data = await execute(args);
            return data;
          },
        })(req, res);
      });

      this.resolversCount = Object.keys(rootValue).length;
    } catch (e) {
      console.log(e);
    }
  }

  private generateLoaderFromStringBody(fnBody: string[]): any {
    this.log(`generateLoaderFromStringBody : `);
    // @ts-ignore
    const _ = require('lodash');
    if (!(fnBody && Array.isArray(fnBody) && fnBody.length)) {
      return;
    }
    // @ts-ignore
    const handler = (ids) => {
      return [];
    };

    try {
      const js = `
      handler = (${fnBody}).bind(this)
      `;
      // tslint:disable-next-line:no-eval
      eval(js);
    } catch (e) {
      console.log('Error in transpilation', e);
    }

    return handler;
  }

  private log(str, ...args): void {
    log(`${this.dbAlias} : ${str}`, ...args);
  }

  public async onManyToManyRelationCreate(
    parent: string,
    child: string,
    args?: any
  ): Promise<Set<any>> {
    const res = await super.onManyToManyRelationCreate(parent, child, args);
    for (const tn of [parent, child]) {
      const meta = this.metas[tn];
      const { columns, hasMany, belongsTo, manyToMany } = meta;
      const ctx = this.generateContextForTable(
        tn,
        columns,
        [...hasMany, ...belongsTo],
        hasMany,
        belongsTo
      );
      ctx.manyToMany = manyToMany;
      this.schemas[tn] = GqlXcSchemaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getString();
      // todo: update schema history
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: this.schemas[tn],
        },
        {
          title: tn,
        }
      );
    }
    {
      const listPropName = `${this.metas[child]._tn}MMList`;
      this.log(
        `onRelationCreate : Generating and inserting '%s'  loaders`,
        listPropName
      );
      /* has many relation list loader with middleware */
      const mw = new GqlMiddleware(this.acls, parent, '', this.models);
      this.addMMListResolverMethodToType(
        parent,
        { rtn: child },
        mw,
        {},
        listPropName,
        this.metas[parent].columns.find((c) => c.pk)._cn
      );
    }

    {
      const listPropName = `${this.metas[parent]._tn}MMList`;
      this.log(
        `onRelationCreate : Generating and inserting '%s'  loaders`,
        listPropName
      );
      /* has many relation list loader with middleware */
      const mw = new GqlMiddleware(this.acls, child, '', this.models);
      this.addMMListResolverMethodToType(
        child,
        { rtn: parent },
        mw,
        {},
        listPropName,
        this.metas[child].columns.find((c) => c.pk)._cn
      );
    }

    await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
      title: `${parent}Mm${child}List`,
      parent,
      child,
      relation: 'mm',
      resolver: 'list',
    });
    await this.xcMeta.metaInsert(this.projectId, this.dbAlias, 'nc_loaders', {
      title: `${child}Mm${parent}List`,
      parent: child,
      child: parent,
      relation: 'mm',
      resolver: 'list',
    });

    await this.reInitializeGraphqlEndpoint();
    return res;
  }

  public async onManyToManyRelationDelete(
    parent: string,
    child: string,
    args?: any
  ) {
    await super.onManyToManyRelationDelete(parent, child, args);

    for (const tn of [parent, child]) {
      const meta = this.metas[tn];
      const { columns, hasMany, belongsTo, manyToMany } = meta;
      const ctx = this.generateContextForTable(
        tn,
        columns,
        [...hasMany, ...belongsTo],
        hasMany,
        belongsTo
      );
      this.schemas[tn] = GqlXcSchemaFactory.create(this.connectionConfig, {
        ...this.generateRendererArgs(ctx),
        manyToMany,
      }).getString();
      // todo: update schema history
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: this.schemas[tn],
        },
        {
          title: tn,
        }
      );
    }

    await this.reInitializeGraphqlEndpoint();
  }

  protected async ncUpAddNestedResolverArgs(_ctx: any): Promise<any> {
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
    // add virtual columns for relations
    for (const metaObj of models) {
      const meta = JSON.parse(metaObj.meta);
      const ctx = this.generateContextForTable(
        meta.tn,
        meta.columns,
        [],
        meta.hasMany,
        meta.belongsTo,
        meta.type,
        meta._tn
      );

      /* generate gql schema of the table */
      const schema = GqlXcSchemaFactory.create(this.connectionConfig, {
        dir: '',
        ctx: {
          ...ctx,
          manyToMany: meta.manyToMany,
        },
        filename: '',
      }).getString();

      /* update schema in metadb */
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema,
        },
        {
          title: meta.tn,
          type: 'table',
        }
      );
    }
  }

  protected async ncUpManyToMany(ctx: any): Promise<any> {
    const metas = await super.ncUpManyToMany(ctx);

    if (!metas) {
      return;
    }
    for (const meta of metas) {
      const ctx = this.generateContextForTable(
        meta.tn,
        meta.columns,
        [],
        meta.hasMany,
        meta.belongsTo,
        meta.type,
        meta._tn
      );

      /* generate gql schema of the table */
      const schema = GqlXcSchemaFactory.create(this.connectionConfig, {
        dir: '',
        ctx: {
          ...ctx,
          manyToMany: meta.manyToMany,
        },
        filename: '',
      }).getString();

      /* update schema in metadb */
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema,
        },
        {
          title: meta.tn,
          type: 'table',
        }
      );

      // todo : add loaders

      if (meta.manyToMany) {
        for (const mm of meta.manyToMany) {
          await this.xcMeta.metaInsert(
            this.projectId,
            this.dbAlias,
            'nc_loaders',
            {
              title: `${mm.tn}Mm${mm.rtn}List`,
              parent: mm.tn,
              child: mm.rtn,
              relation: 'mm',
              resolver: 'mmlist',
            }
          );
        }
      }
    }
  }

  /*  // todo: dump it in db
    // extending types for formula column
    private get typesWithFormulaProps(): string[] {
      const schemas = [];

      for (const meta of Object.values(this.metas)) {
        const props = [];
        for (const v of meta.v) {
          if (!v.formula) continue
          props.push(`${v._cn}: JSON`)
        }
        if (props.length) {
          schemas.push(`type ${meta._tn} {\n${props.join('\n')}\n}`)
        }
      }
      return schemas;
    }*/

  async onMetaUpdate(tn: string): Promise<void> {
    await super.onMetaUpdate(tn);
    const meta = this.metas[tn];

    const ctx = this.generateContextForTable(
      tn,
      meta.columns,
      [...meta.belongsTo, meta.hasMany],
      meta.hasMany,
      meta.belongsTo
    );

    const oldSchema = this.schemas[tn];
    // this.log(`onTableUpdate :  Populating new schema for '%s' table`, changeObj.tn);
    // meta.schema =
    this.schemas[tn] = GqlXcSchemaFactory.create(
      this.connectionConfig,
      this.generateRendererArgs({
        ...meta,
        ...ctx,
      })
    ).getString();
    if (oldSchema !== this.schemas[tn]) {
      // this.log(`onTableUpdate :  Updating and taking backup of schema - '%s' table`, tn);

      // const oldModel = await this.xcMeta.metaGet(this.projectId, this.dbAlias, 'nc_models', {
      //   title: tn
      // });

      // // keep upto 5 schema backup on table update
      // let previousSchemas = [oldSchema]
      // if (oldModel.schema_previous) {
      //   previousSchemas = [...JSON.parse(oldModel.schema_previous), oldSchema].slice(-5);
      // }

      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: this.schemas[tn],
          // schema_previous: JSON.stringify(previousSchemas)
        },
        {
          title: tn,
          type: 'table',
        }
      );
    }

    return this.reInitializeGraphqlEndpoint();
  }
}
