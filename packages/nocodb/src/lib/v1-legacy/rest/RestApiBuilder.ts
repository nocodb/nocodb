import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

import autoBind from 'auto-bind';
import debug from 'debug';
import * as ejs from 'ejs';
import { Router } from 'express';
import { glob } from 'glob';
import mkdirp from 'mkdirp';

import { URL } from 'url';
import { DbConfig, NcConfig } from '../../../interface/config';
import ModelXcMetaFactory from '../../db/sql-mgr/code/models/xc/ModelXcMetaFactory';
import SwaggerXc from '../../db/sql-mgr/code/routers/xc-ts/SwaggerXc';
import SwaggerXcBt from '../../db/sql-mgr/code/routers/xc-ts/SwaggerXcBt';
import SwaggerXcHm from '../../db/sql-mgr/code/routers/xc-ts/SwaggerXcHm';
import ExpressXcTsRoutes from '../../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutes';
import ExpressXcTsRoutesBt from '../../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutesBt';
import ExpressXcTsRoutesHm from '../../db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutesHm';
import NcHelp from '../../utils/NcHelp';
import NcProjectBuilder from '../NcProjectBuilder';
import Noco from '../../Noco';
import BaseApiBuilder, {
  IGNORE_TABLES,
  NcMetaData,
  XcTablesPopulateParams,
} from '../../utils/common/BaseApiBuilder';
import NcMetaIO from '../../meta/NcMetaIO';

import { RestCtrl } from './RestCtrl';
import { RestCtrlBelongsTo } from './RestCtrlBelongsTo';
import { RestCtrlCustom } from './RestCtrlCustom';
import { RestCtrlHasMany } from './RestCtrlHasMany';
import { RestCtrlProcedure } from './RestCtrlProcedure';
import Column from '../../models/Column';
// import NocoTypeGenerator from '../v1-legacy-resolver/NocoTypeGenerator';
// import NocoResolverGenerator from '../v1-legacy-resolver/NocoResolverGenerator';
// import { RestCtrlv2 } from './RestCtrlv2';
// import registerRestCtrl from './registerRestCtrl';
import { MetaTable } from '../../utils/globals';
// import { BaseModelSqlv2 } from '../../sql-data-mapper/lib/sql/BaseModelSqlv2';

const log = debug('nc:api:rest');
const NC_CUSTOM_ROUTE_KEY = '__xc_custom';

const globAsync = promisify(glob);
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);

export class RestApiBuilder extends BaseApiBuilder<Noco> {
  public readonly type = 'rest';
  private controllers: {
    [key: string]:
      | RestCtrlBelongsTo
      | RestCtrl
      | RestCtrlHasMany
      | RestCtrlCustom;
  };

  protected nocoTypes: any;
  protected nocoRootResolvers: any;
  private procedureCtrl: RestCtrlProcedure;
  private routers: { [key: string]: Router };
  private apiCount = 0;
  private customRoutes: any;

  constructor(
    app: Noco,
    projectBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig,
    xcMeta?: NcMetaIO
  ) {
    super(app, projectBuilder, config, connectionConfig);
    autoBind(this);
    this.controllers = {};
    this.routers = {};
    this.hooks = {};
    this.xcMeta = xcMeta;
  }

  public async init(): Promise<void> {
    await super.init();
    // return await this.loadRoutes(null);
  }

  public async loadRoutes(customRoutes: any): Promise<any> {
    this.customRoutes = customRoutes;

    this.log('loadRoutes');
    const t = process.hrtime();

    await this.initDbDriver();

    // todo: change condition
    if (this.connectionConfig.meta.reset) {
      await this.xcMeta.metaReset(this.projectId, this.dbAlias);
      this.log('loadRoutes : Metadata reset completed');
    }

    if (!(await this.xcMeta.isMetaDataExists(this.projectId, this.dbAlias))) {
      await this.xcTablesPopulate({});
      this.log('loadRoutes : Populated metadata from database');
    } else {
      // NOTE: xc-meta
      await this.xcTablesRead();
      this.log('loadRoutes : App initialized from metadata');
    }

    await this.loadHooks();
    await this.loadFormViews();
    await super.loadCommon();

    const t1 = process.hrtime(t);
    const t2 = t1[0] + t1[1] / 1000000000;

    return {
      type: 'rest',
      apiCount: this.apiCount,
      dbType: this.connectionConfig.client,
      apiEndpoint: `/nc/${this.projectId}/${this.dbAlias}/swagger`,
      tablesCount: this.tablesCount,
      relationsCount: this.relationsCount,
      viewsCount: this.viewsCount,
      functionsCount: this.functionsCount,
      proceduresCount: this.proceduresCount,
      client: this.connectionConfig.client,
      databaseName: (this.connectionConfig?.connection as any)?.database,
      timeTaken: t2.toFixed(1),
    };
  }

  public async xcTablesRead(tables?: string[]): Promise<any> {
    this.log('xcTablesRead : %o', tables);
    const swagger = [];
    const { enabledModels, tableAndViewArr, functionArr, procedureArr } =
      await this.readXcModelsAndGroupByType();

    const router = (this.routers.___procedure = Router());
    this.procedureCtrl = new RestCtrlProcedure(
      this,
      functionArr,
      procedureArr,
      this.procedureOrFunctionAcls
    );
    this.procedureCtrl.mapRoutes(router, this.customRoutes);
    swagger.push(this.procedureCtrl.getSwaggerObj());
    this.router.use('/api/' + this.routeVersionLetter, router);
    // this.nocoTypes = await NocoTypeGenerator.generate(
    //   Object.values(this.models2),
    //   {
    //     ncMeta: this.xcMeta,
    //     baseModels2: this.baseModels2
    //   }
    // );
    //
    // this.nocoRootResolvers = await NocoResolverGenerator.generate(
    //   Object.values(this.models2),
    //   {
    //     ncMeta: this.xcMeta,
    //     types: this.nocoTypes,
    //     baseModels2: this.baseModels2
    //   }
    // );

    const routesArr = (
      await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_routes', {
        condition: {
          handler_type: 1,
        },
        xcCondition: {
          _not: {
            is_custom: true,
          },
        },
      })
    )
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        ...it,
        acl: JSON.parse(it.acl),
        functions: it.functions && JSON.parse(it.functions),
        handler: JSON.parse(it.handler),
      }));

    const middlewaresArr = (
      await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_routes', {
        condition: { handler_type: 2 },
        xcCondition: {
          _not: {
            is_custom: true,
          },
        },
      })
    )
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        ...it,
        functions: it.functions && JSON.parse(it.functions),
      }));

    const customRoutes = (
      await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_routes', {
        condition: {
          is_custom: true,
        },
      })
    )
      .sort((a, b) => a.order - b.order)
      .map((it) => ({
        ...it,
        functions: it.functions && JSON.parse(it.functions),
      }));

    const relationRoutes = [];

    await this.loadXcAcl();

    for (const meta of tableAndViewArr) {
      this.log(
        "xcTablesRead : Adding routes for '%s' - %s",
        meta.title,
        meta.type
      );
      const middlewareBody = middlewaresArr.find(
        ({ title }) => title === meta.title
      )?.functions?.[0];

      if (
        !enabledModels.includes(meta.title) ||
        (tables && !tables.includes(meta.title))
      ) {
        continue;
      }

      const metaObj = JSON.parse(meta.meta);

      this.metas[meta.title] = metaObj;
      this.models[meta.title] = this.getBaseModel(metaObj);
      try {
        this.log(
          "xcTablesRead : Parsing swagger doc of '%s' %s",
          meta.title,
          meta.type
        );
        swagger.push(JSON.parse(meta.schema));
      } catch (e) {
        console.log(
          "Failed swagger doc parsing of '" + meta.title + "' " + meta.type
        );
      }
      const routes = routesArr.filter(({ title }) => title === meta.title);
      const router = (this.routers[meta.title] = Router());
      const rootPath = routes?.[0]?.path?.match(/\/api\/[^/]+\/[^/]+/)?.[0];
      if (!rootPath) {
        continue;
      }
      this.router.use(encodeURI(rootPath), router);

      this.apiCount += routes.length;
      this.controllers[meta.title] = new RestCtrl(
        this.app,
        this.models,
        meta.title,
        routes,
        rootPath,
        this.acls,
        middlewareBody
        // this.baseModels2
      );

      // new RestCtrlv2({
      //   app: this.app,
      //   models: this.models,
      //   table: meta.title,
      //   rootResolver: this.nocoRootResolvers,
      //   // baseModels2: this.baseModels2
      //   // baseModel2: this.baseModels2
      //   // this.app,
      //   // this.models,
      //   // meta.title,
      //   // routes,
      //   // rootPath,
      //   // this.acls,
      //   // middlewareBody,
      //   // this.baseModels2
      // }).mapRoutes(router);

      this.controllers[meta.title].mapRoutes(router, this.customRoutes);

      relationRoutes.push(async () => {
        for (const hm of metaObj.hasMany) {
          if (!enabledModels.includes(hm.tn) || !hm.enabled) {
            continue;
          }

          const name = `${meta.title}Hm${hm.tn}`;
          const hmRoutes = routesArr.filter(({ title }) => title === name);
          const hmMiddlewareBody = middlewaresArr.find(
            ({ title }) => title === name
          )?.functions?.[0];

          this.apiCount += hmRoutes.length;
          this.controllers[name] = new RestCtrlHasMany(
            this.app,
            this.models,
            meta.title,
            hm.tn,
            hmRoutes,
            rootPath,
            this.acls,
            hmMiddlewareBody
          );
          this.controllers[name].mapRoutes(router, this.customRoutes);
        }
        for (const bt of metaObj.belongsTo) {
          this.relationsCount++;
          if (!enabledModels.includes(bt.rtn) || !bt.enabled) {
            continue;
          }

          const name = `${meta.title}Bt${bt.rtn}`;

          this.log("xcTablesRead : Adding routes for '%s' - relation", name);

          const btRoutes = routesArr.filter(({ title }) => title === name);
          const btMiddlewareBody = middlewaresArr.find(
            ({ title }) => title === name
          )?.functions?.[0];

          this.apiCount += btRoutes.length;
          this.controllers[name] = new RestCtrlBelongsTo(
            this.app,
            this.models,
            bt.rtn,
            bt.tn,
            btRoutes,
            rootPath,
            this.acls,
            btMiddlewareBody
          );
          this.controllers[name].mapRoutes(router, this.customRoutes);
        }
      });
    }

    await Promise.all(relationRoutes.map(async (f) => f()));

    if (customRoutes.length) {
      const customRouter = (this.routers[NC_CUSTOM_ROUTE_KEY] = Router());
      this.router.use(customRouter);
      this.controllers[NC_CUSTOM_ROUTE_KEY] = new RestCtrlCustom(
        this.app,
        this.models,
        customRoutes
      );
      this.controllers[NC_CUSTOM_ROUTE_KEY].mapRoutes(
        customRouter,
        this.customRoutes
      );
    }

    const swaggerDoc = {
      tags: [],
      paths: {},
      definitions: {},
    };

    swagger.forEach((swaggerJson) => {
      if (swaggerJson) {
        swaggerDoc.tags.push(...swaggerJson.tags);
        Object.assign(swaggerDoc.paths, swaggerJson.paths);
        Object.assign(swaggerDoc.definitions, swaggerJson.definitions);
      }
    });

    if (tables?.length) {
      await this.swaggerUpdate({
        addApis: swaggerDoc,
      });
    } else {
      /* generate swagger docs */
      await this.generateSwaggerJson(swaggerDoc);
    }

    // registerRestCtrl({
    //   router: this.router,
    //   dbAlias: this.dbAlias,
    //   baseId: this.projectId,
    //   dbDriver: this.dbDriver
    // });

    // const minRouter = new RestCtrlMin(this.app,this.models,this.acls);
    // minRouter.mapRoutes(this.router)
  }

  public async xcTablesPopulate(args?: XcTablesPopulateParams): Promise<any> {
    this.log(
      `xcTablesPopulate : tables - %o , type - %s`,
      args?.tableNames,
      args?.type
    );
    let tables;
    const swaggerRefs: { [table: string]: any[] } = {};
    // @ts-ignore
    let order = await this.getOrderVal();

    /*    /!* Get all relations *!/
    let [
      relations,
      // eslint-disable-next-line prefer-const
      missingRelations
    ] = await this.getRelationsAndMissingRelations();
    relations = relations.concat(missingRelations);*/
    const virtualColumnsInsert = [];

    /* Get all relations */
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

    this.relationsCount = relations.length;

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

      tables = args.tableNames.map(({ tn, _tn }) => ({
        tn,
        type: args.type,
        order: ++order,
        _tn,
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
      /*      tables.push(...(await this.sqlClient.viewList())?.data?.list?.map(v => {
              this.viewsCount++;
              v.type = 'view';
              v.tn = v.view_name;
              return v;
            }).filter(v => {
              /!* filter based on prefix *!/
              if (this.projectBuilder?.prefix) {
                return v.view_name.startsWith(this.projectBuilder?.prefix)
              }
              return true;
            }));*/

      // enable extra
      await this.populteProcedureAndFunctionRoutes();
    }

    /* filter based on prefix */
    if (this.projectBuilder?.prefix) {
      tables = tables.filter((t) => {
        t._tn = t._tn || t.tn.replace(this.projectBuilder?.prefix, '');
        return t?.tn?.startsWith(this.projectBuilder?.prefix);
      });
    }

    this.tablesCount = tables.length;

    const relationRoutes: Array<() => Promise<void>> = [];

    relations.forEach((r) => {
      r._tn = this.getTableNameAlias(r.tn);
      r._rtn = this.getTableNameAlias(r.rtn);
    });

    // await this.syncRelations();

    const tableRoutes = tables.map((table) => {
      return async () => {
        swaggerRefs[table.tn] = [];
        this.log(
          "xcTablesPopulate : Generating metadata for '%s' - %s",
          table.tn,
          table.type
        );

        /* filter relation where this table is present */
        const tableRelations = relations.filter(
          (r) => r.tn === table.tn || r.rtn === table.tn
        );

        const columns =
          args?.columns?.[table.tn] ||
          (await this.sqlClient.columnList({ tn: table.tn }))?.data?.list;

        const hasMany =
          table.type === 'view'
            ? []
            : JSON.parse(
                JSON.stringify(tableRelations.filter((r) => r.rtn === table.tn))
              );
        const belongsTo =
          table.type === 'view'
            ? []
            : JSON.parse(
                JSON.stringify(tableRelations.filter((r) => r.tn === table.tn))
              );

        const ctx = this.generateContextForTable(
          table.tn,
          columns,
          table.type === 'view' ? [] : relations,
          hasMany,
          belongsTo,
          table.type,
          args.tableNames?.find((t) => t.tn === table.tn)?._tn
        );

        ctx.oldMeta = args?.oldMetas?.[table.tn];

        // ctx._tn = args.tableNames?.find(t => t.tn === table.tn)?._tn || ctx._tn;

        /* create models from table metadata */
        const meta = ModelXcMetaFactory.create(this.connectionConfig, {
          dir: '',
          ctx,
          filename: '',
        }).getObject();

        /* create nc_models and its rows if it doesn't exists  */
        if (
          !(await this.xcMeta.metaGet(
            this.projectId,
            this.dbAlias,
            'nc_models',
            { title: table.tn }
          ))
        ) {
          this.log(
            "xcTablesPopulate : Inserting model metadata for '%s' - %s",
            table.tn,
            table.type
          );
          await this.xcMeta.metaInsert(
            this.projectId,
            this.dbAlias,
            'nc_models',
            {
              order: table.order || ++order,
              view_order: 1,
              title: table.tn,
              alias: meta._tn,
              meta: JSON.stringify(meta),
              type: table.type || 'table',
            }
          );

          const { id: modelId } = await this.xcMeta.metaInsert2(
            this.projectId,
            this.dbAlias,
            MetaTable.MODELS,
            {
              tn: table.tn,
              _tn: meta._tn,
              type: table.type || 'table',
            }
          );
          for (const column of meta.columns) {
            await Column.insert({
              project_id: this.projectId,
              db_alias: this.dbAlias,
              fk_model_id: modelId,
              ...column,
            });
          }
          // this.models2[table.tn] = await Model.getByIdOrName({
          //   tn: table.tn,
          //   project_id: this.projectId,
          //   base_id: this.getDbAlias()
          // });
          // virtualColumnsInsert.push(async () => {
          //   for (const column of meta.v) {
          //     const rel = column.hm || column.bt || column.mm;
          //
          //     const rel_column_id = (
          //       await this.models2?.[rel.tn]?.getColumns()
          //     )?.find(c => c.cn === rel.cn)?.id;
          //     const ref_rel_column_id = (
          //       await this.models2?.[rel.rtn]?.getColumns()
          //     )?.find(c => c.cn === rel.rcn)?.id;
          //
          //     let fk_mm_model_id;
          //     let fk_mm_child_column_id;
          //     let fk_mm_parent_column_id;
          //
          //     if (column.mm) {
          //       fk_mm_model_id = this.models2?.[rel.vtn]?.id;
          //       fk_mm_child_column_id = (
          //         await this.models2?.[rel.vtn]?.getColumns()
          //       )?.find(c => c.cn === rel.vcn)?.id;
          //       fk_mm_parent_column_id = (
          //         await this.models2?.[rel.vtn]?.getColumns()
          //       )?.find(c => c.cn === rel.vrcn)?.id;
          //     }
          //     try {
          //       await Column.insert({
          //         project_id: this.projectId,
          //         db_alias: this.dbAlias,
          //         fk_model_id: modelId,
          //         cn: column.cn,
          //         _cn: column._cn,
          //         uidt: column.uidt,
          //         type: column.hm ? 'hm' : column.mm ? 'mm' : 'bt',
          //         // column_id,
          //         fk_child_column_id: rel_column_id,
          //         fk_parent_column_id: ref_rel_column_id,
          //         fk_index_name: rel.fkn,
          //         ur: rel.ur,
          //         dr: rel.dr,
          //         fk_mm_model_id,
          //         fk_mm_child_column_id,
          //         fk_mm_parent_column_id
          //       });
          //     } catch (e) {
          //       console.log(e);
          //     }
          //     // todo: insert virtual columns
          //     // insert in nc_columns_v2 & nc_col_relations
          //     // const { id: column_id } =
          //     // await this.xcMeta.metaInsert2(
          //     //   this.projectId,
          //     //   this.dbAlias,
          //     //   'nc_columns_v2',
          //     //   {
          //     //     model_id: modelId,
          //     //     cn: column.cn,
          //     //     _cn: column._cn,
          //     //     uidt: column.uidt
          //     //   }
          //     // );
          //
          //     // await this.xcMeta.metaInsert2(
          //     //   this.projectId,
          //     //   this.dbAlias,
          //     //   'nc_col_relations',
          //     //   {
          //     //     type: column.hm ? 'hm' : 'bt',
          //     //     column_id,
          //     //     rel_column_id,
          //     //     ref_rel_column_id,
          //     //     fkn: rel.fkn,
          //     //     ur: rel.ur,
          //     //     dr: rel.dr
          //     //   }
          //     // );
          //   }
          // });
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
              alias: meta._tn,
              meta: JSON.stringify(meta),
              type: table.type || 'table',
            },
            args?.oldMetas?.[table.tn]?.id
          );
        }
        /* create routes for table */
        const routes = new ExpressXcTsRoutes({
          dir: '',
          ctx,
          filename: '',
        }).getObjectWithoutFunctions();

        this.log(
          "xcTablesPopulate : Generating swagger apis for '%s' - %s",
          table.tn,
          table.type
        );
        /* create swagger json for table */
        swaggerRefs[table.tn].push(
          await new SwaggerXc({
            dir: '',
            ctx: {
              ...ctx,
              v: meta.v,
            },
            filename: '',
          }).getObject()
        );

        await this.generateAndSaveAcl(table.tn, table.type);

        /* create nc_routes and its rows if it doesn't exists  */
        if (
          !(await this.xcMeta.metaGet(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            { title: table.tn }
          ))
        ) {
          const routesInsertion = routes.map((route, i) => {
            return async () => {
              await this.xcMeta.metaInsert(
                this.projectId,
                this.dbAlias,
                'nc_routes',
                {
                  acl: JSON.stringify(route.acl),
                  handler: JSON.stringify(route.handler),
                  order: i,
                  path: route.path,
                  tn: table.tn,
                  title: table.tn,
                  type: route.type,
                }
              );
            };
          });

          routesInsertion.push(async () => {
            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                tn: table.tn,
                title: table.tn,
                handler_type: 2,
              }
            );
          });

          this.log(
            "xcTablesPopulate : Inserting routes and middleware metadata for '%s' - %s",
            table.tn,
            table.type
          );
          await NcHelp.executeOperations(
            routesInsertion,
            this.connectionConfig.client
          );
        }

        this.metas[table.tn] = meta;
        /* create database model */
        this.models[table.tn] = this.getBaseModel(meta);

        this.apiCount += routes.length;

        const router = (this.routers[table.tn] = Router());
        const rootPath = `/api/${ctx.routeVersionLetter}/${ctx._tn}`;

        /* create table controllers and map the routes */
        this.controllers[table.tn] = new RestCtrl(
          this.app,
          this.models,
          table.tn,
          routes,
          rootPath,
          this.acls,
          null
          // this.baseModels2
        );
        this.controllers[table.tn].mapRoutes(router, this.customRoutes);
        this.router.use(encodeURI(rootPath), router);

        /* handle relational routes  */
        relationRoutes.push(async () => {
          for (const hm of meta.hasMany) {
            const hmCtx = this.generateContextForHasMany(ctx, hm.tn);
            const hmRoutes = new ExpressXcTsRoutesHm(
              this.generateRendererArgs(hmCtx)
            ).getObjectWithoutFunctions();

            /* create swagger json for hasmany  */
            swaggerRefs[table.tn].push(
              await new SwaggerXcHm(
                this.generateRendererArgs(
                  this.generateContextForHasMany(hmCtx, hm.tn)
                )
              ).getObject()
            );

            const name = `${table.tn}Hm${hm.tn}`;

            /* handle has many relational routes  */
            const hmRoutesInsertion = hmRoutes.map((route, i) => {
              return async () => {
                await this.xcMeta.metaInsert(
                  this.projectId,
                  this.dbAlias,
                  'nc_routes',
                  {
                    title: name,
                    tn: table.tn,
                    order: i,
                    path: route.path,
                    type: route.type,
                    handler: JSON.stringify(route.handler),
                    acl: JSON.stringify(route.acl),
                    relation_type: 'hasMany',
                    tnc: hm.tn,
                  }
                );
              };
            });

            this.apiCount += hmRoutes.length;

            hmRoutesInsertion.push(async () => {
              await this.xcMeta.metaInsert(
                this.projectId,
                this.dbAlias,
                'nc_routes',
                {
                  tn: table.tn,
                  title: name,
                  handler_type: 2,
                  relation_type: 'hasMany',
                  tnc: hm.tn,
                }
              );
            });

            await NcHelp.executeOperations(
              hmRoutesInsertion,
              this.connectionConfig.client
            );

            if (!hm.enabled) {
              continue;
            }
            /* create and map has many routes */
            this.controllers[name] = new RestCtrlHasMany(
              this.app,
              this.models,
              table.tn,
              hm.tn,
              hmRoutes,
              rootPath,
              this.acls
            );
            this.controllers[name].mapRoutes(router, this.customRoutes);
          }

          /* handle belongs tou routes and controllers */
          for (const bt of meta.belongsTo) {
            const btCtx = this.generateContextForBelongsTo(ctx, bt.rtn);
            const btRoutes = new ExpressXcTsRoutesBt(
              this.generateRendererArgs(btCtx)
            ).getObjectWithoutFunctions();

            /* create swagger json for hasmany  */
            swaggerRefs[table.tn].push(
              await new SwaggerXcBt(
                this.generateRendererArgs(
                  this.generateContextForBelongsTo(btCtx, bt.rtn)
                )
              ).getObject()
            );

            const name = `${table.tn}Bt${bt.rtn}`;
            this.apiCount += btRoutes.length;

            const btRoutesInsertion = btRoutes.map((route, i) => {
              return async () => {
                await this.xcMeta.metaInsert(
                  this.projectId,
                  this.dbAlias,
                  'nc_routes',
                  {
                    tn: table.tn,
                    title: name,
                    order: i,
                    path: route.path,
                    type: route.type,
                    handler: JSON.stringify(route.handler),
                    acl: JSON.stringify(route.acl),
                    relation_type: 'belongsTo',
                    tnp: bt.rtn,
                  }
                );
              };
            });

            btRoutesInsertion.push(async () => {
              await this.xcMeta.metaInsert(
                this.projectId,
                this.dbAlias,
                'nc_routes',
                {
                  tn: table.tn,
                  title: name,
                  handler_type: 2,
                  relation_type: 'belongsTo',
                  tnp: bt.rtn,
                }
              );
            });

            await NcHelp.executeOperations(
              btRoutesInsertion,
              this.connectionConfig.client
            );

            if (!bt.enabled) {
              continue;
            }

            /* create and map belongs to routes */
            this.controllers[name] = new RestCtrlBelongsTo(
              this.app,
              this.models,
              bt.rtn,
              bt.tn,
              btRoutes,
              rootPath,
              this.acls
            );
            this.controllers[name].mapRoutes(router, this.customRoutes);
          }
        });
      };
    });

    /* handle xc_tables update in parallel */
    await NcHelp.executeOperations(tableRoutes, this.connectionConfig.client);
    await NcHelp.executeOperations(
      relationRoutes,
      this.connectionConfig.client
    );

    const swaggerDoc = {
      tags: [],
      paths: {},
      definitions: {},
    };

    this.log('xcTablesPopulate : Merging and saving all the swagger objects');

    for (const [table, swagger] of [
      ...Object.entries(swaggerRefs),
      [
        null,
        [
          this.procedureCtrl?.getSwaggerObj() || {
            tags: [],
            path: {},
          },
        ],
      ],
    ]) {
      if (table) {
        await this.mergeAndUpdateSwagger(table as string, swagger);
      }

      swagger.forEach((swaggerJson) => {
        swaggerDoc.tags.push(...[swaggerJson.tags || []]);
        Object.assign(swaggerDoc.paths, swaggerJson.paths || {});
        Object.assign(swaggerDoc.definitions, swaggerJson.definitions || {});
      });
    }

    if (args.tableNames && args.tableNames.length) {
      await this.swaggerUpdate({
        addApis: swaggerDoc,
      });
    } else {
      /* generate swagger docs */
      await this.generateSwaggerJson(swaggerDoc);
    }

    await this.getManyToManyRelations();
    await NcHelp.executeOperations(
      virtualColumnsInsert,
      this.connectionConfig.client
    );

    // this.baseModels2 = (
    //   await Model.list({ project_id: this.projectId, db_alias: this.dbAlias })
    // ).reduce((models, m) => {
    //   return {
    //     ...models,
    //     [m.title]: new BaseModelSqlv2({
    //       model: m,
    //       dbDriver: this.dbDriver,
    //       baseModels: this.baseModels2
    //     })
    //   };
    // }, {});

    // this.nocoTypes = await NocoTypeGenerator.generate(
    //   Object.values(this.models2),
    //   {
    //     ncMeta: this.xcMeta,
    //     baseModels2: this.baseModels2
    //   }
    // );
    //
    // this.nocoRootResolvers = await NocoResolverGenerator.generate(
    //   Object.values(this.models2),
    //   {
    //     ncMeta: this.xcMeta,
    //     types: this.nocoTypes,
    //     baseModels2: this.baseModels2
    //   }
    // );

    // registerRestCtrl({
    //   router: this.router,
    //   dbAlias: this.dbAlias,
    //   baseId: this.projectId,
    //   dbDriver: this.dbDriver
    // });
  }

  // NOTE: xc-meta
  public async xcTablesRowDelete(tn: string, extras?: any): Promise<void> {
    await super.xcTablesRowDelete(tn, extras);
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_routes', {
      tn,
    });
  }

  public async onTableCreate(
    tn: string,
    args?: { _tn?: string; columns?: any; oldMeta?: NcMetaData }
  ): Promise<void> {
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
      oldMetas: {
        [tn]: args.oldMeta,
      },
    });
  }

  public async onTableDelete(tn: string, extras?: any): Promise<void> {
    await super.onTableDelete(tn, extras);
    this.log("onTableDelete : '%s'", tn);
    try {
      const ctrlIndex = this.router.stack.findIndex((r) => {
        return r.handle === this.routers[tn];
      });
      if (ctrlIndex > -1) {
        this.router.stack.splice(ctrlIndex, 1);
      }
      delete this.models[tn];

      await this.xcTablesRowDelete(tn, extras);

      delete this.routers[tn];
      await this.swaggerUpdate({
        deleteTags: [tn],
      });
    } catch (e) {
      console.log(e);
    }
  }

  public async onViewDelete(viewName: string): Promise<void> {
    this.log("onViewDelete : '%s'", viewName);
    try {
      const ctrlIndex = this.router.stack.findIndex((r) => {
        return r.handle === this.routers[viewName];
      });
      if (ctrlIndex > -1) {
        this.router.stack.splice(ctrlIndex, 1);
      }
      delete this.models[viewName];

      await this.xcTablesRowDelete(viewName);

      delete this.routers[viewName];

      await this.swaggerUpdate({
        deleteTags: [viewName],
      });
    } catch (e) {
      console.log(e);
    }
  }

  public async onHandlerCodeUpdate(tn: string): Promise<void> {
    this.log("onHandlerCodeUpdate : '%s'", tn);
    const index = this.router.stack.findIndex(
      (r) => r.handle === this.routers[tn]
    );
    if (index > -1) {
      this.router.stack.splice(index, 1);
    }
    await this.xcTablesRead([tn]);
  }

  public async onTableRename(
    oldTableName: string,
    newTableName: string
  ): Promise<void> {
    this.log("onTableRename : '%s' => '%s'", oldTableName, newTableName);
    await super.onTableRename(oldTableName, newTableName);
    await this.xcTableRename(oldTableName, newTableName);
    // await this.onTableDelete(oldTableName);
    // await this.xcTablesPopulate({tableNames: [newTableName]});
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
      tableName,
    } = await super.onTableAliasRename(oldTableAliasName, newTableAliasName);

    for (const table of [tableName, ...relatedTableList]) {
      const meta = this.getMeta(table);
      this.models[table] = this.getBaseModel(meta);
      const ctx = this.generateContextForMeta(meta);

      const newSwagger = [];
      newSwagger.push(new SwaggerXc({ ctx }).getObject());

      // update routes
      const routes = new ExpressXcTsRoutes({
        dir: '',
        ctx,
        filename: '',
      }).getObjectWithoutFunctions();

      const routesUpdate = routes.map((route, i) => {
        return async () => {
          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              path: route.path,
            },
            {
              tn: table,
              title: table,
              type: route.type,
              order: i,
            }
          );
        };
      });
      await NcHelp.executeOperations(
        routesUpdate,
        this.connectionConfig.client
      );

      /* handle relational routes  */
      for (const hm of meta.hasMany) {
        const rendererArgs = this.generateRendererArgs(
          this.generateContextForHasMany(ctx, hm.tn)
        );
        const hmRoutes = new ExpressXcTsRoutesHm(
          rendererArgs
        ).getObjectWithoutFunctions();
        newSwagger.push(new SwaggerXcHm(rendererArgs).getObject());

        const routeName = `${table}Hm${hm.tn}`;
        // const name = `${ctx.tn}Hm${hm.tn}`;

        /* handle has many relational routes  */
        const hmRoutesInsertion = hmRoutes.map((route, i) => {
          return async () => {
            // this.log(
            //   "xcTableAliasRename : Updating table name and route path in 'nc_routes' metatable - '%s' => '%s' (HasMany relation)",
            //   oldTableAliasName,
            //   newTableAliasName
            // );
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
              },
              {
                title: routeName,
                handler: JSON.stringify(route.handler),
                tn: table,
                type: route.type,
                relation_type: 'hasMany',
                order: i,
                tnc: hm.tn,
                handler_type: 1,
              }
            );
          };
        });

        await NcHelp.executeOperations(
          hmRoutesInsertion,
          this.connectionConfig.client
        );
      }

      /* handle belongs to routes and controllers */
      for (const bt of meta.belongsTo) {
        const rendererArgs1 = this.generateRendererArgs(
          this.generateContextForBelongsTo(
            {
              ...ctx,
              tn: bt.tn,
            },
            bt.rtn
          )
        );
        const btRoutes = new ExpressXcTsRoutesBt(
          rendererArgs1
        ).getObjectWithoutFunctions();
        newSwagger.push(new SwaggerXcBt(rendererArgs1).getObject());

        const routeName = `${table}Bt${bt.rtn}`;

        const btRoutesInsertion = btRoutes.map((route, i) => {
          return async () => {
            // this.log(
            //   "xcTableRename : Updating table name and route path in 'nc_routes' metatable - '%s' => '%s' (BelongsTo relation)",
            //   oldTablename,
            //   newTablename
            // );

            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
                // tn: newTablename,
              },
              {
                tn: table,
                title: routeName,
                order: i,
                type: route.type,
                handler: JSON.stringify(route.handler),
                relation_type: 'belongsTo',
                tnp: bt.rtn,
                handler_type: 1,
              }
            );
          };
        });

        await NcHelp.executeOperations(
          btRoutesInsertion,
          this.connectionConfig.client
        );
      }

      this.mergeAndUpdateSwagger(table, newSwagger);
    }

    // update metas
    //     - relations
    //     - virtual columns
    // update swagger docs
    // update routes

    // load routes and models from db
    await this.xcTablesRead([...relatedTableList, tableName]);
    await this.onSwaggerDocUpdate(tableName);
  }

  // NOTE: xc-meta
  public async xcTableRename(
    oldTablename: string,
    newTablename: string
  ): Promise<any> {
    this.log("xcTableRename : '%s' => '%s' ", oldTablename, newTablename);

    const tables = [];
    const newSwagger = [];

    /* Get all relations */
    const relations = await this.getRelationList();
    const relatedTableList = this.getRelationTableNames(
      relations,
      newTablename
    );
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

    newSwagger.push(
      await new SwaggerXc({ dir: '', ctx, filename: '' }).getObject()
    );
    this.deleteRoutesForTables([oldTablename, ...relatedTableList]);

    // delete old model
    delete this.models[oldTablename];

    this.tablesCount = tables.length;
    let meta = this.metas[oldTablename];
    if (oldTablename !== newTablename) {
      // const rootPath = `/api/${ctx.routeVersionLetter}/${ctx._tn}`

      /* create models from table */
      meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();

      // update old model meta with new details
      // const existingModel = await this.sqlClient.knex('nc_models').where('title', oldTablename).first();
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
          "Updating table name in 'nc_models' metatable - '%s' => '%s'",
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
            alias: meta._tn,
          },
          { title: oldTablename }
        );
      }
      this.metas[newTablename] = meta;

      this.models[newTablename] = this.getBaseModel(meta);
    }

    // update tn in nc_acl
    this.log(
      "xcTableRename : Updating table name in 'nc_acl' metatable - '%s' => '%s'",
      oldTablename,
      newTablename
    );
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_acl',
      {
        tn: newTablename,
      },
      {
        tn: oldTablename,
      }
    );

    /* create routes from table */
    const routes = new ExpressXcTsRoutes({
      dir: '',
      ctx,
      filename: '',
    }).getObjectWithoutFunctions();

    const routesUpdate = routes.map((route, i) => {
      return async () => {
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_routes',
          {
            path: route.path,
            tn: newTablename,
            title: newTablename,
          },
          {
            handler: JSON.stringify(route.handler),
            tn: oldTablename,
            title: oldTablename,
            type: route.type,
            order: i,
          }
        );
      };
    });

    this.log(
      "xcTableRename : Updating table name and route path in 'nc_routes' metatable - '%s' => '%s'",
      oldTablename,
      newTablename
    );
    await NcHelp.executeOperations(routesUpdate, this.connectionConfig.client);

    /* handle relational routes  */
    routesUpdate.push(async () => {
      for (const hm of meta.hasMany) {
        const rendererArgs = this.generateRendererArgs(
          this.generateContextForHasMany(ctx, hm.tn)
        );
        const hmRoutes = new ExpressXcTsRoutesHm(
          rendererArgs
        ).getObjectWithoutFunctions();
        newSwagger.push(new SwaggerXcHm(rendererArgs).getObject());

        const oldName = `${oldTablename}Hm${hm.tn}`;
        const name = `${ctx.tn}Hm${hm.tn}`;

        /* handle has many relational routes  */
        const hmRoutesInsertion = hmRoutes.map((route, i) => {
          return async () => {
            this.log(
              "xcTableRename : Updating table name and route path in 'nc_routes' metatable - '%s' => '%s' (HasMany relation)",
              oldTablename,
              newTablename
            );
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
                tn: newTablename,
                title: name,
              },
              {
                title: oldName,
                handler: JSON.stringify(route.handler),
                tn: oldTablename,
                type: route.type,
                relation_type: 'hasMany',
                order: i,
                tnc: hm.tn,
                handler_type: 1,
              }
            );
          };
        });

        hmRoutesInsertion.push(async () => {
          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              tn: newTablename,
              title: name,
            },
            {
              tn: oldTablename,
              title: oldName,
              handler_type: 2,
            }
          );
        });

        await NcHelp.executeOperations(
          hmRoutesInsertion,
          this.connectionConfig.client
        );
      }

      /* handle belongs to routes and controllers */
      for (const bt of meta.belongsTo) {
        const rendererArgs1 = this.generateRendererArgs(
          this.generateContextForBelongsTo(
            {
              ...ctx,
              tn: bt.tn,
            },
            bt.rtn
          )
        );
        const btRoutes = new ExpressXcTsRoutesBt(
          rendererArgs1
        ).getObjectWithoutFunctions();
        newSwagger.push(new SwaggerXcBt(rendererArgs1).getObject());

        const oldName = `${oldTablename}Bt${bt.rtn}`;
        const name = `${newTablename}Bt${bt.rtn}`;

        const btRoutesInsertion = btRoutes.map((route, i) => {
          return async () => {
            this.log(
              "xcTableRename : Updating table name and route path in 'nc_routes' metatable - '%s' => '%s' (BelongsTo relation)",
              oldTablename,
              newTablename
            );

            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
                tn: newTablename,
                title: name,
              },
              {
                tn: oldTablename,
                title: oldName,
                order: i,
                type: route.type,
                handler: JSON.stringify(route.handler),
                relation_type: 'belongsTo',
                tnp: bt.rtn,
                handler_type: 1,
              }
            );
          };
        });

        btRoutesInsertion.push(async () => {
          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              tn: newTablename,
              title: name,
            },
            {
              tn: oldTablename,
              title: oldName,
              handler_type: 2,
              relation_type: 'belongsTo',
              tnp: bt.rtn,
            }
          );
        });

        await NcHelp.executeOperations(
          btRoutesInsertion,
          this.connectionConfig.client
        );
      }
    });

    await NcHelp.executeOperations(routesUpdate, this.connectionConfig.client);

    await this.mergeAndUpdateSwagger(newTablename, newSwagger);

    /* Reload relation tables : start */
    // reload routes and update meta  for relation tables
    for (const relationTable of relatedTableList) {
      const newRelatedTableSwagger = [];
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
        [],
        relations,
        rHasMany,
        rBelongsTo
      );
      newRelatedTableSwagger.push(new SwaggerXc({ ctx: rCtx }).getObject());
      if (oldTablename !== newTablename) {
        /* create models from table */
        const rMeta = ModelXcMetaFactory.create(
          this.connectionConfig,
          this.generateRendererArgs(rCtx)
        ).getObject();

        // update existing model meta with new details(relation tables)
        const rExistingModel = await this.xcMeta.metaGet(
          this.projectId,
          this.dbAlias,
          'nc_models',
          { title: relationTable }
        );

        if (rExistingModel) {
          this.log(
            "xcTableRename : Updating meta for relation table '%s' on behalf of table rename  - '%s' => '%s' (BelongsTo relation)",
            relationTable,
            oldTablename,
            newTablename
          );

          // todo: persisting old table_alias and columnAlias
          const oldMeta = JSON.parse(rExistingModel.meta);
          Object.assign(oldMeta, {
            hasMany: rMeta.hasMany,
            belongsTo: rMeta.belongsTo,
          });
          // await this.sqlClient.knex('nc_models').update({
          //   meta: JSON.stringify(oldMeta)
          // }).where('title', relationTable)

          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_models',
            {
              meta: JSON.stringify(oldMeta),
            },
            { title: relationTable }
          );

          this.metas[relationTable] = oldMeta;
        }
      }
      this.models[relationTable] = this.getBaseModel(this.metas[relationTable]);

      // update has many to routes
      for (const hmRelation of rHasMany) {
        newRelatedTableSwagger.push(
          new SwaggerXcHm({
            ctx: this.generateContextForHasMany(rCtx, hmRelation.tn),
          }).getObject()
        );

        if (hmRelation.tn === newTablename) {
          const oldHmRoutes: any[] = new ExpressXcTsRoutesHm(
            this.generateRendererArgs(
              this.generateContextForHasMany(rCtx, oldTablename)
            )
          ).getObjectWithoutFunctions();
          const hmRoutes: any[] = new ExpressXcTsRoutesHm(
            this.generateRendererArgs(
              this.generateContextForHasMany(rCtx, newTablename)
            )
          ).getObjectWithoutFunctions();

          for (const [i, newHmRoute] of Object.entries(hmRoutes)) {
            const oldHmRoute: any = oldHmRoutes[i];
            this.log(
              `xcTableRename : Updating routes for ${relationTable}Hm${newTablename} on behalf of '%table rename'  - '%s' => '%s' (HasMany relation)`,
              relationTable,
              oldTablename,
              newTablename
            );

            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                title: `${relationTable}Hm${newTablename}`,
                path: newHmRoute.path,
                tnc: newTablename,
              },
              {
                path: oldHmRoute.path,
                type: oldHmRoute.type,
                tnc: oldTablename,
              }
            );
          }

          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              title: `${relationTable}Hm${newTablename}`,
            },
            {
              title: `${relationTable}Hm${oldTablename}`,
            }
          );
        }
      }

      // update belongs to routes
      for (const btRelation of rBelongsTo) {
        newRelatedTableSwagger.push(
          new SwaggerXcBt({
            ctx: this.generateContextForBelongsTo(rCtx, btRelation.rtn),
          }).getObject()
        );
        if (btRelation.rtn === newTablename) {
          const newBtRoutes: any[] = new ExpressXcTsRoutesBt(
            this.generateRendererArgs(
              this.generateContextForBelongsTo(rCtx, newTablename)
            )
          ).getObjectWithoutFunctions();
          const oldBtRoutes: any[] = new ExpressXcTsRoutesBt(
            this.generateRendererArgs(
              this.generateContextForBelongsTo(rCtx, oldTablename)
            )
          ).getObjectWithoutFunctions();

          for (const [i, newBtRoute] of Object.entries(newBtRoutes)) {
            const oldBtRoute: any = oldBtRoutes[i];
            this.log(
              `xcTableRename : Updating routes for ${relationTable}Bt${oldTablename} on behalf of '%table rename'  - '%s' => '%s' (BelongsTo relation)`,
              relationTable,
              oldTablename,
              newTablename
            );
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                title: `${relationTable}Bt${newTablename}`,
                path: newBtRoute.path,
                tnp: newTablename,
              },
              {
                title: `${relationTable}Bt${oldTablename}`,
                type: oldBtRoute.type,
                tnp: oldTablename,
              }
            );
          }

          await this.xcMeta.metaUpdate(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              title: `${relationTable}Bt${newTablename}`,
            },
            {
              title: `${relationTable}Bt${oldTablename}`,
            }
          );
        }
      }

      /* Reload relation tables : end */
      await this.mergeAndUpdateSwagger(
        relationTable as string,
        newRelatedTableSwagger
      );
    }

    // load routes and models from db
    await this.xcTablesRead([...relatedTableList, newTablename]);
    await this.onSwaggerDocUpdate(newTablename);
  }

  // NOTE: xc-meta
  public async onRelationCreate(tnp: string, tnc: string, args): Promise<void> {
    await super.onRelationCreate(tnp, tnc, args);
    // const newRelatedTableSwagger = [];
    this.log("onRelationCreate : '%s' ==> '%s'", tnp, tnc);

    this.deleteRoutesForTables([tnp, tnc]);
    const relations = await this.getXcRelationList();
    {
      const swaggerArr = [];
      const columns = this.metas[tnp]?.columns;
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnp);
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnp);

      // set table name alias
      hasMany.forEach((r) => {
        r._rtn = this.getTableNameAlias(r.rtn);
        r._tn = this.getTableNameAlias(r.tn);
      });

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

      // update old model meta with new details
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

      // swaggerArr.push(JSON.parse(existingModel.schema));
      if (existingModel) {
        this.log(
          `onRelationCreate : Updating model metadata for parent table '%s'`,
          tnp
        );
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

        swaggerArr.push(
          new SwaggerXc({ ctx: { ...ctx, v: oldMeta.v } }).getObject()
        );

        if (queryParams?.showFields) {
          queryParams.showFields[
            `${this.getTableNameAlias(tnp)} => ${this.getTableNameAlias(tnc)}`
          ] = true;
        }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            meta: JSON.stringify(oldMeta),
            ...(queryParams
              ? { query_params: JSON.stringify(queryParams) }
              : {}),
          },
          { title: tnp }
        );
      }

      const rendererArgs = this.generateRendererArgs(
        this.generateContextForHasMany(ctx, tnc)
      );
      const hmRoutes: any[] = new ExpressXcTsRoutesHm(
        rendererArgs
      ).getObjectWithoutFunctions();
      swaggerArr.push(new SwaggerXcHm(rendererArgs).getObject());

      const name = `${tnp}Hm${tnc}`;

      /* handle has many relational routes  */
      const hmRoutesInsertion = hmRoutes.map((route, i) => {
        return async () => {
          await this.xcMeta.metaInsert(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              title: name,
              tn: tnp,
              order: i,
              path: route.path,
              type: route.type,
              handler: JSON.stringify(route.handler),
              acl: JSON.stringify(route.acl),
              relation_type: 'hasMany',
              tnc: tnc,
            }
          );
        };
      });

      hmRoutesInsertion.push(async () => {
        await this.xcMeta.metaInsert(
          this.projectId,
          this.dbAlias,
          'nc_routes',
          {
            tn: tnp,
            title: name,
            handler_type: 2,
            relation_type: 'hasMany',
            tnc: tnc,
          }
        );
      });

      this.log(
        `onRelationCreate : Creating and inserting routes metadata of  %s relation`,
        name
      );
      await NcHelp.executeOperations(
        hmRoutesInsertion,
        this.connectionConfig.client
      );
      await this.mergeAndUpdateSwagger(tnp, swaggerArr);
    }
    {
      const swaggerArr = [];
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
      const meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();

      // set table name alias
      belongsTo.forEach((r) => {
        r._rtn = this.getTableNameAlias(r.rtn);
        r._tn = this.getTableNameAlias(r.tn);
      });

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

      // swaggerArr.push(JSON.parse(existingModel.schema))
      if (existingModel) {
        meta.belongsTo.forEach((hm) => {
          hm.enabled = true;
        });
        this.log(
          `onRelationCreate : Updating model metadata for child table '%s'`,
          tnc
        );
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

        swaggerArr.push(
          new SwaggerXc({ ctx: { ...ctx, v: oldMeta.v } }).getObject()
        );

        if (queryParams?.showFields) {
          queryParams.showFields[
            `${this.getTableNameAlias(tnp)} <= ${this.getTableNameAlias(tnc)}`
          ] = true;
        }

        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            meta: JSON.stringify(oldMeta),
            ...(queryParams
              ? { query_params: JSON.stringify(queryParams) }
              : {}),
          },
          { title: tnc }
        );
      }

      const rendererArgs = this.generateRendererArgs(
        this.generateContextForBelongsTo(ctx, tnp)
      );
      const btRoutes = new ExpressXcTsRoutesBt(
        rendererArgs
      ).getObjectWithoutFunctions();
      swaggerArr.push(new SwaggerXcBt(rendererArgs).getObject());

      const name = `${tnc}Bt${tnp}`;

      const btRoutesInsertion = btRoutes.map((route, i) => {
        return async () => {
          await this.xcMeta.metaInsert(
            this.projectId,
            this.dbAlias,
            'nc_routes',
            {
              tn: tnc,
              title: name,
              order: i,
              path: route.path,
              type: route.type,
              handler: JSON.stringify(route.handler),
              acl: JSON.stringify(route.acl),
              relation_type: 'belongsTo',
              tnp: tnp,
            }
          );
        };
      });
      btRoutesInsertion.push(async () => {
        await this.xcMeta.metaInsert(
          this.projectId,
          this.dbAlias,
          'nc_routes',
          {
            tn: tnc,
            title: name,
            handler_type: 2,
            relation_type: 'belongsTo',
            tnp: tnp,
          }
        );
      });

      this.log(
        `onRelationCreate : Creating and inserting routes metadata of  %s relation`,
        name
      );
      await NcHelp.executeOperations(
        btRoutesInsertion,
        this.connectionConfig.client
      );

      await this.mergeAndUpdateSwagger(tnc, swaggerArr);
    }

    await this.xcTablesRead([tnp, tnc]);
    await this.onSwaggerDocUpdate(tnp);
  }

  public async onRelationDelete(
    tnp: string,
    tnc: string,
    args: any
  ): Promise<void> {
    await super.onRelationDelete(tnp, tnc, args);

    this.log("Within relation delete event - '%s' ==> '%s'", tnp, tnc);
    this.deleteRoutesForTables([tnp, tnc]);

    const relations = await this.getXcRelationList();

    {
      const hasMany = this.extractHasManyRelationsOfTable(relations, tnp);
      const ctx = this.generateContextForTable(tnp, [], relations, hasMany, []);
      const meta = ModelXcMetaFactory.create(this.connectionConfig, {
        dir: '',
        ctx,
        filename: '',
      }).getObject();

      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnp }
      );
      const tagName = `${tnp}HasMany${tnc}`;
      const swaggerObj = this.deleteTagFromSwaggerObj(
        existingModel.schema,
        tagName
      );

      if (existingModel) {
        this.log(`Updating model metadata for parent table '%s'`, tnp);

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

        // todo: delete from query_params
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnp,
            meta: JSON.stringify(oldMeta),
            schema: JSON.stringify(swaggerObj),
          },
          { title: tnp }
        );
      }

      const name = `${tnp}Hm${tnc}`;

      this.log(
        `Deleting routes metadata of  %s relation`,
        name
      ); /* handle has many relational routes  */
      await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_routes', {
        title: name,
      });
    }

    {
      const belongsTo = this.extractBelongsToRelationsOfTable(relations, tnc);
      const ctx = this.generateContextForTable(
        tnc,
        [],
        relations,
        [],
        belongsTo
      );
      const meta = ModelXcMetaFactory.create(
        this.connectionConfig,
        this.generateRendererArgs(ctx)
      ).getObject();

      // update old model meta with new details
      const existingModel = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        { title: tnc }
      );
      const tagName = `${tnc}BelongsTo${tnp}`;
      const swaggerObj = this.deleteTagFromSwaggerObj(
        existingModel.schema,
        tagName
      );

      if (existingModel) {
        this.log(`Updating model metadata for child table '%s'`, tnc);
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
        // todo: delete from query_params
        await this.xcMeta.metaUpdate(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: tnc,
            meta: JSON.stringify(oldMeta),
            schema: JSON.stringify(swaggerObj),
          },
          { title: tnc }
        );
      }
      const name = `${tnc}Bt${tnp}`;

      this.log(`Deleting routes metadata of  %s relation`, name);
      await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_routes', {
        title: name,
      });
    }

    await this.xcTablesRead([tnp, tnc]);
    await this.onSwaggerDocUpdate(tnp);
  }

  public async onPolicyUpdate(tn: string): Promise<void> {
    this.log(`onPolicyUpdate : %s`, tn);
    this.deleteRoutesForTables([tn]);
    await this.xcTablesRead([tn]);
  }

  // NOTE: xc-meta
  public async onMiddlewareCodeUpdate(tn: string): Promise<void> {
    this.log(`onMiddlewareCodeUpdate : %s`, tn);
    const routes = await this.xcMeta.metaList(
      this.projectId,
      this.dbAlias,
      'nc_routes',
      {
        condition: {
          tn: tn,
          handler_type: 2,
        },
      }
    );

    const router = this.routers[tn];
    router.stack.splice(0, router.stack.length);
    for (const route of routes) {
      let middlewareBody = null;
      if (route.functions) {
        try {
          middlewareBody = JSON.parse(route.functions)[0];
        } catch (e) {
          console.log(e.message);
        }
      }

      this.log(
        `onMiddlewareCodeUpdate : Reloading routes with new middleware body for %s table`,
        tn
      );
      this.controllers[route.title]
        .updateMiddleware(middlewareBody)
        .remapRouters(router);
    }
  }

  public async onToggleModels(enabledModels: string[]): Promise<void> {
    this.log(`onToggleModels : %o`, enabledModels);
    for (const handler of Object.values(this.routers)) {
      const index = this.router.stack.findIndex((r) => r.handle === handler);
      if (index > -1) {
        this.router.stack.splice(index, 1);
      }
    }
    await this.xcTablesRead();
  }

  public async onToggleModelRelation(relationInModels: any): Promise<void> {
    this.log(`onToggleModelRelation :`);
    // filter out model names which toggled
    const modelNames: string[] = [
      ...new Set(
        relationInModels.map((rel) => {
          return rel.relationType === 'hm' ? rel.rtn : rel.tn;
        })
      ),
    ] as string[];

    for (const modelName of modelNames) {
      const index = this.router.stack.findIndex(
        (r) => r.handle === this.routers[modelName]
      );
      if (index > -1) {
        this.router.stack.splice(index, 1);
      }
    }
    await this.xcTablesRead(modelNames);
  }

  public async onViewCreate(viewName: string, args?: any): Promise<void> {
    this.log(`onViewCreate : '%s'`, viewName);
    await this.xcTablesPopulate({
      tableNames: [{ tn: viewName, _tn: args._tn }],
      type: 'view',
    });
  }

  public async onFunctionCreate(functionName: string): Promise<void> {
    this.log(`onFunctionCreate : '%s'`, functionName);
    const functions = (await this.sqlClient.functionList())?.data?.list;
    this.routers.___procedure.stack.splice(
      0,
      this.routers.___procedure.stack.length
    );
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

    this.log(`onFunctionCreate : Update function and procedure routes`);
    this.procedureCtrl.functionsSet(functions);
    this.procedureCtrl.mapRoutes(this.routers.___procedure, this.customRoutes);
    await this.swaggerUpdate({
      addApis: { paths: this.procedureCtrl.getSwaggerObj().paths },
    });
  }

  // NOTE: xc-meta
  public async onFunctionDelete(functionName: string): Promise<void> {
    this.log(`onFunctionDelete : '%s'`, functionName);
    this.log(`onFunctionDelete : Delete meta of '%s' function`, functionName);
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: functionName,
      type: 'function',
    });
    this.log(`onFunctionDelete : Update function and procedure routes`);
    this.procedureCtrl.functionDelete(functionName);
    this.routers.___procedure.stack.splice(
      0,
      this.routers.___procedure.stack.length
    );
    this.procedureCtrl.mapRoutes(this.routers.___procedure, this.customRoutes);
    await this.swaggerUpdate({
      addApis: this.procedureCtrl.getSwaggerObj(),
      deleteTags: ['Procedures', 'Functions'],
    });
  }

  // NOTE: xc-meta
  public async onProcedureCreate(procedureName: string): Promise<void> {
    this.log(`onProcedureCreate : '%s'`, procedureName);
    const procedures = (await this.sqlClient.procedureList())?.data?.list;
    this.routers.___procedure.stack.splice(
      0,
      this.routers.___procedure.stack.length
    );
    // do insertion parallelly
    const procedureObj = procedures.find(
      (f) => f.procedure_name === procedureName
    );
    if (procedureObj) {
      this.log(
        `onProcedureCreate : Generating and inserting '%s' procedure meta and acl`,
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
    this.log(`onProcedureCreate : Update function and procedure routes`);
    this.procedureCtrl.proceduresSet(procedures);
    this.procedureCtrl.mapRoutes(this.routers.___procedure, this.customRoutes);
    await this.swaggerUpdate({
      addApis: { paths: this.procedureCtrl.getSwaggerObj().paths },
    });
  }

  // NOTE: xc-meta
  public async onProcedureDelete(procedureName: string): Promise<void> {
    this.log(`onProcedureDelete : '%s'`, procedureName);
    this.log(`onProcedureDelete : Delete meta of '%s' function`, procedureName);
    await this.xcMeta.metaDelete(this.projectId, this.dbAlias, 'nc_models', {
      title: procedureName,
      type: 'procedure',
    });
    this.log(`onProcedureDelete : Update function and procedure routes`);
    this.procedureCtrl.procedureDelete(procedureName);
    this.routers.___procedure.stack.splice(
      0,
      this.routers.___procedure.stack.length
    );
    this.procedureCtrl.mapRoutes(this.routers.___procedure, this.customRoutes);
    await this.swaggerUpdate({
      addApis: this.procedureCtrl.getSwaggerObj(),
      deleteTags: ['Procedures', 'Functions'],
    });
  }

  public async onSwaggerDocUpdate(tn: any): Promise<void> {
    this.log(`onSwaggerDocUpdate : '%s'`, tn);
    const swaggerDocs = (
      await this.xcMeta.metaList(this.projectId, this.dbAlias, 'nc_models')
    )
      .filter((m) => m.schema)
      .map((m) => JSON.parse(m.schema));
    swaggerDocs.push(this.procedureCtrl.getSwaggerObj());

    const swaggerDoc = {
      tags: [],
      paths: {},
      definitions: {},
    };

    swaggerDocs.forEach((swaggerJson) => {
      swaggerDoc.tags.push(...(swaggerJson.tags || []));
      Object.assign(swaggerDoc.paths, swaggerJson.paths || {});
      Object.assign(swaggerDoc.definitions, swaggerJson.definitions || {});
    });

    /* generate swagger docs */
    await this.generateSwaggerJson(swaggerDoc);
  }

  public async onTableUpdate(changeObj: any): Promise<void> {
    this.log(`onTableUpdate : '%s'`, changeObj.tn);
    await super.onTableUpdate(changeObj, async ({ ctx }) => {
      // todo: take backup
      const swaggerDoc = await new SwaggerXc({
        dir: '',
        ctx,
        filename: '',
      }).getObject();
      const meta = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          title: changeObj.tn,
          type: 'table',
        }
      );
      const oldSwaggerDoc = JSON.parse(meta.schema);

      // // keep upto 5 schema backup on table update
      // let previousSchemas = [oldSwaggerDoc]
      // if (meta.schema_previous) {
      //   previousSchemas = [...JSON.parse(meta.schema_previous), oldSwaggerDoc].slice(-5);
      // }

      oldSwaggerDoc.definitions = swaggerDoc.definitions;
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: JSON.stringify(oldSwaggerDoc),
          // schema_previous: JSON.stringify(previousSchemas)
        },
        {
          title: changeObj.tn,
          type: 'table',
        }
      );

      await this.onSwaggerDocUpdate(changeObj.tn);
    });
  }

  // NOTE: xc-meta
  // @ts-ignore
  private async populteProcedureAndFunctionRoutes(_args?: {
    functions?: string[];
    procedures?: string[];
  }) {
    this.log('populteProcedureAndFunctionRoutes');
    const router = (this.routers.___procedure = Router());

    const functions = [];
    const procedures = [];
    // enable extra
    // try {
    //     functions = (await this.sqlClient.functionList())?.data?.list;
    //     this.functionsCount = functions.length;
    //     this.apiCount += this.functionsCount;
    // } catch (e) {
    // }
    // try {
    //     procedures = (await this.sqlClient.procedureList())?.data?.list;
    //     this.proceduresCount = procedures.length;
    //     this.apiCount += this.proceduresCount;
    // } catch (e) {
    // }
    this.procedureCtrl = new RestCtrlProcedure(
      this,
      functions,
      procedures,
      this.procedureOrFunctionAcls
    );
    this.procedureCtrl.mapRoutes(router, this.customRoutes);
    this.router.use(`/api/${this.routeVersionLetter}`, router);

    // do insertion parallelly
    if (functions) {
      for (const functionObj of functions) {
        this.log(
          "populteProcedureAndFunctionRoutes : Inserting metadata and acl for '%s' - function",
          functionObj.function_name
        );
        await this.generateAndSaveAcl(functionObj.function_name, 'function');
        await this.xcMeta.metaInsert(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: functionObj.function_name,
            meta: JSON.stringify({ ...functionObj, type: 'function' }),
            type: 'function',
          }
        );
      }
    }
    if (procedures) {
      for (const procedureObj of procedures) {
        this.log(
          "populteProcedureAndFunctionRoutes : Inserting metadata and acl for '%s' - procedure",
          procedureObj.procedure_name
        );
        await this.generateAndSaveAcl(procedureObj.procedure_name, 'procedure');
        await this.xcMeta.metaInsert(
          this.projectId,
          this.dbAlias,
          'nc_models',
          {
            title: procedureObj.procedure_name,
            meta: JSON.stringify({ ...procedureObj, type: 'procedure' }),
            type: 'procedure',
          }
        );
      }
    }
  }

  private async generateSwaggerJson(swaggerDoc) {
    if (!this.config.try) {
      this.log('generateSwaggerJson : Generating swagger.json');
      const swaggerFilePath = path.join(
        this.app.getToolDir(),
        'nc',
        this.projectId,
        this.getDbAlias(),
        'swagger'
      );
      await mkdirp(swaggerFilePath);
      await writeFileAsync(
        path.join(swaggerFilePath, 'swagger.json'),
        JSON.stringify(swaggerDoc)
      );
    }

    this.router.get(`/${this.getDbAlias()}/swagger`, async (_req, res) => {
      res.send(
        ejs.render((await import('./ui/auth/swagger')).default, {
          ncPublicUrl: process.env.NC_PUBLIC_URL || '',
          baseUrl: `/`,
          dbAlias: this.getDbAlias(),
          projectId: this.projectId,
        })
      );
    });

    this.router.get(`/${this.getDbAlias()}/swagger.json`, async (req, res) => {
      // todo: optimize
      let swaggerBaseDocument: any = JSON.parse(
        JSON.stringify(await import('./ui/auth/swagger-base.xc.json'))
      );

      if (
        this.config?.auth?.jwt?.dbAlias !== this.connectionConfig.meta.dbAlias
      ) {
        swaggerBaseDocument = {
          ...swaggerBaseDocument,
          tags: [],
          definitions: {},
          paths: {},
        };
      }

      const host = process.env.NC_PUBLIC_URL
        ? new URL(process.env.NC_PUBLIC_URL)?.host
        : req.get('host');
      const scheme = process.env.NC_PUBLIC_URL
        ? new URL(process.env.NC_PUBLIC_URL)?.protocol.slice(0, -1)
        : req.protocol;
      swaggerBaseDocument.host = host;
      swaggerBaseDocument.schemes = [
        scheme,
        scheme === 'http' ? 'https' : 'http',
      ];
      await globAsync(
          path.join(
            this.app.getToolDir(),
            'nc',
            this.projectId,
            this.getDbAlias(),
            'swagger',
            'swagger.json'
          )
        )
        .forEach(async (jsonFile) => {
          const swaggerJson = JSON.parse(await readFileAsync(jsonFile, 'utf8'));
          swaggerBaseDocument.tags.push(...swaggerJson.tags);
          Object.assign(swaggerBaseDocument.paths, swaggerJson.paths);
          Object.assign(
            swaggerBaseDocument.definitions,
            swaggerJson.definitions
          );
        });
      res.json(swaggerBaseDocument);
    });
  }

  private deleteTagFromSwaggerObj(
    swaggerObjOrString: any | string,
    tagName: string
  ): any {
    let swaggerObj = swaggerObjOrString;
    if (typeof swaggerObj === 'string') {
      swaggerObj = JSON.parse(swaggerObj);
    }
    swaggerObj.tags = swaggerObj.tags.filter((t) => t.name !== tagName);
    for (const routePath of Object.keys(swaggerObj.paths)) {
      if (
        (Object.values(swaggerObj.paths[routePath])[0] as any).tags.includes(
          tagName
        )
      ) {
        delete swaggerObj.paths[routePath];
      }
    }
    return swaggerObj;
  }

  private deleteRoutesForTables(tableNames: any[]): void {
    this.log(`deleteRoutesForTables : %o`, tableNames);
    // delete routes and models for table and it's relation tables
    for (const table of tableNames) {
      const ctrlIndex = this.router.stack.findIndex((r) => {
        return r.handle === this.routers[table];
      });
      if (ctrlIndex > -1) {
        this.router.stack.splice(ctrlIndex, 1);
      }

      delete this.routers[table];
    }
  }

  // @ts-ignore
  private async swaggerUpdate(args: {
    deleteApis?: any;
    addApis?: any;
    deleteTags?: string[];
  }) {
    this.log(`swaggerUpdate :`);

    if (!args.deleteApis && !args.addApis && !args.deleteTags) {
      return;
    }

    /* load swagger JSON */
    const swaggerFilePath = path.join(
      this.app.getToolDir(),
      'nc',
      this.projectId,
      this.getDbAlias(),
      'swagger'
    );
    const swaggerJson = JSON.parse(
      await readFileAsync(path.join(swaggerFilePath, 'swagger.json'), 'utf8')
    );

    /* remove tags, paths and keys */
    if (args.deleteApis) {
      this.log(`swaggerUpdate : deleting swagger apis`);

      const { tags, paths, definitions } = args.deleteApis;

      if (tags) {
        swaggerJson.tags = swaggerJson.tags.filter(({ name }) =>
          tags.find((t) => t.name === name)
        );
      }
      if (paths) {
        Object.keys(paths).forEach((path) => delete swaggerJson.tags[path]);
      }
      if (definitions) {
        Object.keys(definitions).forEach(
          (def) => delete swaggerJson.definitions[def]
        );
      }
    }

    /* add tags, paths and defnitions */
    if (args.addApis) {
      this.log(`swaggerUpdate : adding swagger apis`);
      const { tags, paths, definitions } = args.addApis;
      if (tags) {
        swaggerJson.tags.push(...tags);
      }
      if (paths) {
        Object.assign(swaggerJson.paths, paths);
      }
      if (definitions) {
        Object.assign(swaggerJson.definitions, definitions);
      }
    }

    /* remove tags, paths & defnitions */
    if (args.deleteTags) {
      this.log(`swaggerUpdate : deleting swagger tags : %o`, args.deleteTags);
      for (const tag of args.deleteTags) {
        swaggerJson.tags = swaggerJson.tags.filter((t) => t.name !== tag);

        Object.keys(swaggerJson.paths).forEach((p) => {
          if (
            swaggerJson.paths?.[p]?.[
              Object.keys(swaggerJson.paths[p])[0]
            ]?.tags?.includes(tag)
          ) {
            delete swaggerJson.paths[p];
          }
        });

        if (swaggerJson.definitions) {
          if (swaggerJson.definitions[tag]) {
            delete swaggerJson.definitions[tag];
          }
          if (swaggerJson.definitions[`${tag}Nested`]) {
            delete swaggerJson.definitions[`${tag}Nested`];
          }
        }
      }
    }

    await writeFileAsync(
      path.join(swaggerFilePath, 'swagger.json'),
      JSON.stringify(swaggerJson)
    );
  }

  private log(str, ...args) {
    log(`${this.dbAlias} : ${str}`, ...args);
  }

  private mergeAndUpdateSwagger(tn: string, swaggerDefs: any[]) {
    this.log(`mergeAndUpdateSwagger : '%s'`, tn);
    const swaggerDoc = {
      tags: [],
      paths: {},
      definitions: {},
    };

    this.log(
      `mergeAndUpdateSwagger : Merging all the swagger docs object of '%s' table`,
      tn
    );
    swaggerDefs.forEach((swaggerJson) => {
      swaggerDoc.tags.push(...swaggerJson.tags);
      Object.assign(swaggerDoc.paths, swaggerJson.paths);
      Object.assign(swaggerDoc.definitions, swaggerJson.definitions);
    });

    this.log(
      `mergeAndUpdateSwagger : Saving swagger JSON to metatable - '%s' table`,
      tn
    );
    this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        schema: JSON.stringify(swaggerDoc),
      },
      {
        title: tn,
      }
    );
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

      /* create routes for table */
      const routes = new ExpressXcTsRoutes({
        dir: '',
        ctx,
        filename: '',
      }).getObjectWithoutFunctions();

      /* create nc_routes, add new routes or update order */
      const routesInsertion = routes.map((route, i) => {
        return async () => {
          if (
            !(await this.xcMeta.metaGet(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
                tn: meta.tn,
                title: meta.tn,
                type: route.type,
              }
            ))
          ) {
            await this.xcMeta.metaInsert(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                acl: JSON.stringify(route.acl),
                handler: JSON.stringify(route.handler),
                order: i,
                path: route.path,
                tn: meta.tn,
                title: meta.tn,
                type: route.type,
              }
            );
          } else {
            await this.xcMeta.metaUpdate(
              this.projectId,
              this.dbAlias,
              'nc_routes',
              {
                order: i,
              },
              {
                path: route.path,
                tn: meta.tn,
                title: meta.tn,
                type: route.type,
              }
            );
          }
        };
      });

      await NcHelp.executeOperations(
        routesInsertion,
        this.connectionConfig.client
      );
    }

    // add new routes
  }

  public async onMetaUpdate(tn: string) {
    await super.onMetaUpdate(tn);
    const ctx = this.generateContextForTable(
      tn,
      this.metas[tn].columns,
      [...this.metas[tn].belongsTo, ...this.metas[tn].hasMany],
      this.metas[tn].hasMany,
      this.metas[tn].belongsTo
    );

    const swaggerDoc = await new SwaggerXc({
      dir: '',
      ctx: {
        ...ctx,
        v: this.metas[tn].v,
      },
      filename: '',
    }).getObject();
    const meta = await this.xcMeta.metaGet(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        title: tn,
        type: 'table',
      }
    );
    const oldSwaggerDoc = JSON.parse(meta.schema);

    // // keep upto 5 schema backup on table update
    // let previousSchemas = [oldSwaggerDoc]
    // if (meta.schema_previous) {
    //   previousSchemas = [...JSON.parse(meta.schema_previous), oldSwaggerDoc].slice(-5);
    // }

    oldSwaggerDoc.definitions = swaggerDoc.definitions;
    await this.xcMeta.metaUpdate(
      this.projectId,
      this.dbAlias,
      'nc_models',
      {
        schema: JSON.stringify(oldSwaggerDoc),
        // schema_previous: JSON.stringify(previousSchemas)
      },
      {
        title: tn,
        type: 'table',
      }
    );

    await this.onSwaggerDocUpdate(tn);
  }

  protected async getManyToManyRelations(args = {}): Promise<Set<any>> {
    const metas: Set<any> = await super.getManyToManyRelations(args);

    for (const metaObj of metas) {
      const ctx = this.generateContextForTable(
        metaObj.tn,
        metaObj.columns,
        [...metaObj.belongsTo, ...metaObj.hasMany],
        metaObj.hasMany,
        metaObj.belongsTo
      );

      const swaggerDoc = await new SwaggerXc({
        dir: '',
        ctx: {
          ...ctx,
          v: metaObj.v,
        },
        filename: '',
      }).getObject();

      const meta = await this.xcMeta.metaGet(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          title: metaObj.tn,
          type: 'table',
        }
      );
      const oldSwaggerDoc = JSON.parse(meta.schema);

      // // keep upto 5 schema backup on table update
      // let previousSchemas = [oldSwaggerDoc]
      // if (meta.schema_previous) {
      //   previousSchemas = [...JSON.parse(meta.schema_previous), oldSwaggerDoc].slice(-5);
      // }

      oldSwaggerDoc.definitions = swaggerDoc.definitions;
      await this.xcMeta.metaUpdate(
        this.projectId,
        this.dbAlias,
        'nc_models',
        {
          schema: JSON.stringify(oldSwaggerDoc),
          // schema_previous: JSON.stringify(previousSchemas)
        },
        {
          title: metaObj.tn,
          type: 'table',
        }
      );
    }

    return metas;
  }
}
