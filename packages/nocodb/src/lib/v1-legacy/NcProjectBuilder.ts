import fs from 'fs';
import path from 'path';

import axios from 'axios';
import { Router } from 'express';

import { NcConfig } from '../../interface/config';
import SqlClientFactory from '../db/sql-client/lib/SqlClientFactory';
import Migrator from '../db/sql-migrator/lib/KnexMigrator';

import Noco from '../Noco';
import { Tele } from 'nc-help';
import { GqlApiBuilder } from './gql/GqlApiBuilder';
import { XCEeError } from '../meta/NcMetaMgr';
import { RestApiBuilder } from './rest/RestApiBuilder';
import NcConnectionMgr from '../utils/common/NcConnectionMgr';

export default class NcProjectBuilder {
  public readonly id: string;
  public readonly title: string;
  public readonly description: string;
  public readonly router: Router;
  public readonly apiBuilders: Array<RestApiBuilder | GqlApiBuilder> = [];
  private _config: any;

  protected startTime;
  protected app: Noco;
  protected appConfig: NcConfig;
  protected apiInfInfoList: any[] = [];
  protected aggregatedApiInfo: any;
  protected authHook: any;

  constructor(app: Noco, appConfig: NcConfig, project: any) {
    this.app = app;
    this.appConfig = appConfig;

    if (project) {
      this.id = project.id;
      this.title = project.title;
      this.description = project.description;
      this._config = { ...this.appConfig, ...JSON.parse(project.config) };
      this.router = Router();
    }
  }

  public async init(_isFirstTime?: boolean) {
    try {
      // await this.addAuthHookToMiddleware();

      this.startTime = Date.now();
      const allRoutesInfo: any[] = [];
      // await this.app.ncMeta.projectStatusUpdate(this.id, 'starting');
      await this.syncMigration();
      await this._createApiBuilder();
      // this.initApiInfoRoute();

      /* Create REST APIs / GraphQL Resolvers */
      for (const meta of this.apiBuilders) {
        let routeInfo;
        if (meta instanceof RestApiBuilder) {
          console.log(
            `Creating REST APIs ${meta.getDbType()} - > ${meta.getDbName()}`
          );
          routeInfo = await (meta as RestApiBuilder).init();
        } else if (meta instanceof GqlApiBuilder) {
          console.log(
            `Creating GraphQL APIs ${meta.getDbType()} - > ${meta.getDbName()}`
          );
          routeInfo = await (meta as GqlApiBuilder).init();
        }
        allRoutesInfo.push(routeInfo);
        // this.progress(routeInfo, allRoutesInfo, isFirstTime);
      }

      // this.app.projectRouter.use(`/nc/${this.id}`, this.router);
      // await this.app.ncMeta.projectStatusUpdate(this.id, 'started');
    } catch (e) {
      console.log(e);
      throw e;
      // await this.app.ncMeta.projectStatusUpdate(this.id, 'stopped');
    }
  }

  public async handleRunTimeChanges(data: any): Promise<any> {
    const curBuilder = this.apiBuilders.find((builder) => {
      return (
        (data.req?.dbAlias || data.req?.args?.dbAlias) === builder.getDbAlias()
      );
    });

    switch (data?.req?.api) {
      case 'xcAuthHookSet':
        this.authHook = await this.app.ncMeta.metaGet(
          this.id,
          'db',
          'nc_hooks',
          {
            type: 'AUTH_MIDDLEWARE',
          }
        );
        break;
      case 'xcM2MRelationCreate':
        await curBuilder.onManyToManyRelationCreate(
          data.req.args.parentTable,
          data.req.args.childTable,
          data.req.args
        );
        break;

      case 'relationCreate':
        await curBuilder.onRelationCreate(
          data.req.args.parentTable,
          data.req.args.childTable,
          data.req.args
        );

        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'RELATION',
          op_sub_type: 'CREATED',
          user: data.user.email,
          description: `created relation between tables ${data.req.args.childTable} and ${data.req.args.parentTable} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(
          `Added new relation between : ${data.req.args.parentTable} ==> ${data.req.args.childTable}`
        );
        break;

      case 'relationDelete':
        await curBuilder.onRelationDelete(
          data.req.args.parentTable,
          data.req.args.childTable,
          data.req.args
        );
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'RELATION',
          op_sub_type: 'DELETED',
          user: data.user.email,
          description: `deleted relation between tables ${data.req.args.childTable} and ${data.req.args.parentTable} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(
          `Deleted relation between : ${data.req.args.parentTable} ==> ${data.req.args.childTable}`
        );
        break;

      case 'xcVirtualRelationCreate':
        await curBuilder.onVirtualRelationCreate(
          data.req.args.parentTable,
          data.req.args.childTable
        );
        await curBuilder.onRelationCreate(
          data.req.args.parentTable,
          data.req.args.childTable,
          {
            ...data.req.args,
            virtual: true,
          }
        );
        console.log(
          `Added new relation between : ${data.req.args.parentTable} ==> ${data.req.args.childTable}`
        );
        break;
      case 'xcVirtualRelationDelete':
        await curBuilder.onRelationDelete(
          data.req.args.parentTable,
          data.req.args.childTable,
          {
            ...data.req.args,
            virtual: true,
          }
        );
        console.log(
          `Added new relation between : ${data.req.args.parentTable} ==> ${data.req.args.childTable}`
        );
        break;

      case 'xcRelationColumnDelete':
        if (data.req.args?.type === 'mm') {
          await curBuilder.onManyToManyRelationDelete(
            data.req.args.parentTable,
            data.req.args.childTable
          );
        }

        break;

      case 'xcVirtualTableUpdate':
        await curBuilder.onVirtualTableUpdate(data.req.args);
        break;
      case 'xcVirtualTableRename':
        await curBuilder.onVirtualTableRename(data.req.args);
        break;
      case 'xcVirtualTableCreate':
        await curBuilder.loadFormViews();
        break;

      case 'tableCreate':
        await curBuilder.onTableCreate(data.req.args.tn, data.req.args);

        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'TABLE',
          op_sub_type: 'CREATED',
          user: data.user.email,
          description: `created table ${data.req.args.tn} with alias ${data.req.args._tn}  `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Added new routes for table : ${data.req.args.tn}`);
        break;

      case 'viewCreate':
        await curBuilder.onViewCreate(data.req.args.view_name, data.req.args);
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'VIEW',
          op_sub_type: 'CREATED',
          user: data.user.email,
          description: `created view ${data.req.args.view_name} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Added new routes for table : ${data.req.args.tn}`);
        break;

      case 'viewUpdate':
        await curBuilder.onViewUpdate(data.req.args.view_name);
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'VIEW',
          op_sub_type: 'UPDATED',
          user: data.user.email,
          description: `updated view ${data.req.args.view_name} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Added new routes for table : ${data.req.args.tn}`);
        break;

      case 'tableDelete':
        await curBuilder.onTableDelete(data.req.args.tn);
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'TABLE',
          op_sub_type: 'DELETED',
          user: data.user.email,
          description: `deleted table ${data.req.args.tn} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Deleted routes for table : ${data.req.args.tn}`);
        break;

      case 'tableRename':
        await curBuilder.onTableRename(data.req.args.tn_old, data.req.args.tn);

        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'TABLE',
          op_sub_type: 'RENAMED',
          user: data.user.email,
          description: `renamed table ${data.req.args.tn_old} to  ${data.req.args.tn}  `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Updated routes for table : ${data.req.args.tn}`);
        break;

      case 'ncTableAliasRename':
        await curBuilder.onTableAliasRename(
          data.req.args.tn_old,
          data.req.args.tn
        );

        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'TABLE',
          op_sub_type: 'RENAMED',
          user: data.user.email,
          description: `renamed table alias  ${data.req.args.tn_old} to  ${data.req.args.tn}  `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Updated routes for table : ${data.req.args.tn}`);
        break;

      case 'xcRoutesHandlerUpdate':
      case 'xcResolverHandlerUpdate':
      case 'xcRpcHandlerUpdate':
        // todo: implement separate function
        await curBuilder.onHandlerCodeUpdate(data.req.args.tn);
        console.log(`Updated routes handler for table : ${data.req.tn}`);
        break;

      case 'xcRoutesMiddlewareUpdate':
      case 'xcResolverMiddlewareUpdate':
        // todo: implement separate function
        await curBuilder.onMiddlewareCodeUpdate(data.req.args.tn);
        console.log(`Updated routes handler for table : ${data.req.args.tn}`);
        break;

      case 'xcModelSet':
        await curBuilder.onMetaUpdate(data.req.args.tn);
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;
      case 'xcUpdateVirtualKeyAlias':
        await curBuilder.onVirtualColumnAliasUpdate(data.req.args);
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'xcModelSchemaSet':
        await curBuilder.onGqlSchemaUpdate(
          data.req.args.tn,
          data.req.args.schema
        );
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'tableXcHooksSet':
      case 'tableXcHooksDelete':
        await curBuilder.onHooksUpdate(data.req.args.tn);
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'xcModelSwaggerDocSet':
        await (curBuilder as RestApiBuilder).onSwaggerDocUpdate(
          data.req.args.tn
        );
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'tableUpdate':
        await curBuilder.onTableUpdate(data.req.args);
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'TABLE',
          op_sub_type: 'UPDATED',
          user: data.user.email,
          description: `updated table ${data.req.args.tn} with alias ${data.req.args._tn} `,
          ip: data.ctx.req.clientIp,
        });
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'procedureCreate':
        await curBuilder.onProcedureCreate(data.req.args.procedure_name);
        break;

      case 'functionUpdate':
        await curBuilder.onFunctionDelete(data.req.args.function_name);
        await curBuilder.onFunctionCreate(data.req.args.function_name);
        break;

      case 'procedureUpdate':
        await curBuilder.onProcedureDelete(data.req.args.procedure_name);
        await curBuilder.onProcedureCreate(data.req.args.procedure_name);
        break;

      case 'procedureDelete':
        await curBuilder.onProcedureDelete(data.req.args.procedure_name);
        break;

      case 'functionCreate':
        await curBuilder.onFunctionCreate(data.req.args.function_name);
        break;

      case 'functionDelete':
        await curBuilder.onFunctionDelete(data.req.args.function_name);
        break;

      case 'xcRoutesPolicyUpdate':
      case 'xcResolverPolicyUpdate':
        await curBuilder.onPolicyUpdate(data.req.args.tn);
        console.log(`Updated validations for table : ${data.req.args.tn}`);
        break;

      case 'xcModelsEnable':
        await curBuilder.onToggleModels(data.req.args);
        break;

      case 'xcTableModelsEnable':
        await curBuilder.onToggleModels(data.req.args);
        break;

      case 'xcViewModelsEnable':
        await curBuilder.onToggleModels(data.req.args);
        break;

      case 'xcProcedureModelsEnable':
        await curBuilder.onToggleModels(data.req.args);
        break;

      case 'xcFunctionModelsEnable':
        await curBuilder.onToggleModels(data.req.args);
        break;

      case 'xcRelationsSet':
        XCEeError.throw();
        break;

      case 'xcCronSave':
        await curBuilder.restartCron(data.req.args);
        break;

      case 'cronDelete':
        await curBuilder.removeCron(data.req.args);
        break;

        // todo: optimize
        if (Array.isArray(data.req.args.tableNames)) {
          for (const procedure of data.req.args.tableNames) {
            await curBuilder.onProcedureCreate(procedure);
          }
        }
      case 'xcMetaDiffSync':
        await curBuilder.xcMetaDiffSync();
        break;
      case 'tableMetaCreate':
        XCEeError.throw();
        break;

      case 'viewMetaCreate':
        XCEeError.throw();
        break;

      case 'tableMetaDelete':
        XCEeError.throw();
        break;

      case 'viewMetaDelete':
        XCEeError.throw();
        break;
      case 'viewDelete':
        await curBuilder.onViewDelete(data.req.args.view_name);
        this.app.ncMeta.audit(this.id, curBuilder.getDbAlias(), 'nc_audit', {
          op_type: 'VIEW',
          op_sub_type: 'DELETED',
          user: data.user.email,
          description: `deleted view ${data.req.args.view_name} `,
          ip: data.ctx.req.clientIp,
        });
        break;

      case 'tableMetaRecreate':
        XCEeError.throw();
        break;

      case 'viewMetaRecreate':
        XCEeError.throw();
        break;

      case 'procedureMetaCreate':
        XCEeError.throw();
        break;

      case 'functionMetaRecreate':
        XCEeError.throw();
        break;

      case 'xcAclSave':
        await curBuilder.onAclUpdate(data.req.args.tn || data.req.args.name);
        break;

      case 'xcAclAggregatedSave':
        for (const builder of this.apiBuilders) {
          await builder.loadXcAcl();
        }
        break;

      case 'procedureMetaDelete':
        await curBuilder.onProcedureDelete(data.req.args.procedure_name);
        break;

      case 'procedureMetaRecreate':
        await curBuilder.onProcedureDelete(data.req.args.tn);
        await curBuilder.onProcedureCreate(data.req.args.tn);
        break;

      case 'functionMetaCreate':
        // todo: optimize
        if (Array.isArray(data.req.args.tableNames)) {
          for (const functionName of data.req.args.tableNames) {
            await curBuilder.onFunctionCreate(functionName);
          }
        }
        break;

      case 'functionMetaDelete':
        await curBuilder.onFunctionDelete(data.req.args.procedure_name);
        break;

      case 'projectStop':
        this.router.stack.splice(0, this.router.stack.length);
        this.apiBuilders.splice(0, this.apiBuilders.length);
        await this.app.ncMeta.projectStatusUpdate(this.id, 'stopped');
        NcProjectBuilder.triggerGarbageCollect();
        this.app.ncMeta.audit(this.id, null, 'nc_audit', {
          op_type: 'PROJECT',
          op_sub_type: 'STOPPED',
          user: data.user.email,
          description: `stopped project ${this.title}(${this.id}) `,
          ip: data?.ctx?.req?.clientIp,
        });
        break;

      case 'projectStart':
        await this.init();
        this.app.ncMeta.audit(this.id, null, 'nc_audit', {
          op_type: 'PROJECT',
          op_sub_type: 'STARTED',
          user: data.user.email,
          description: `started project ${this.title}(${this.id}) `,
          ip: data?.ctx?.req?.clientIp,
        });
        break;

      case 'projectDelete':
        this.router.stack.splice(0, this.router.stack.length);
        this.apiBuilders.splice(0, this.apiBuilders.length);
        await this.app.ncMeta.projectDeleteById(this.id);
        await this.app.ncMeta
          .knex('nc_projects_users')
          .where({ project_id: this.id })
          .del();
        for (const db of this.config?.envs?.[this.appConfig?.workingEnv]?.db ||
          []) {
          const dbAlias = db?.meta?.dbAlias;
          const apiType = db?.meta?.api?.type;
          await this.app.ncMeta.metaReset(this.id, dbAlias, apiType);
        }
        NcProjectBuilder.triggerGarbageCollect();
        this.app.ncMeta.audit(this.id, null, 'nc_audit', {
          op_type: 'PROJECT',
          op_sub_type: 'DELETED',
          user: data.user.email,
          description: `deleted project ${this.title}(${this.id}) `,
          ip: data?.ctx?.req?.clientIp,
        });
        break;

      case 'xcMetaTablesImportLocalFsToDb':
      case 'xcMetaTablesImportZipToLocalFsAndDb':
      case 'projectRestart':
        await this.reInit();
        this.app.ncMeta.audit(this.id, null, 'nc_audit', {
          op_type: 'PROJECT',
          op_sub_type: 'RESTARTED',
          user: data.user.email,
          description: `restarted project ${this.title}(${this.id}) `,
          ip: data?.ctx?.req?.clientIp,
        });
        break;

      default:
        console.log('DB OPS', data.req.api);
    }

    // export metadata to filesystem after meta changes
    switch (data?.req?.api) {
      case 'procedureCreate':
      case 'functionUpdate':
      case 'procedureUpdate':
      case 'procedureDelete':
      case 'functionCreate':
      case 'functionDelete':
      case 'relationCreate':
      case 'relationDelete':
      case 'tableCreate':
      case 'tableDelete':
      case 'tableRename':
      case 'xcRoutesHandlerUpdate':
      case 'xcResolverHandlerUpdate':
      case 'xcRoutesMiddlewareUpdate':
      case 'xcResolverMiddlewareUpdate':
      case 'xcModelSet':
      case 'xcModelSchemaSet':
      case 'tableXcHooksSet':
      case 'projectCreateByWeb':
      case 'projectUpdateByWeb':
      case 'projectChangeEnv':
      case 'tableUpdate':
      case 'xcRoutesPolicyUpdate':
      case 'xcResolverPolicyUpdate':
      case 'xcModelsEnable':
      case 'xcTableModelsEnable':
      case 'xcViewModelsEnable':
      case 'xcProcedureModelsEnable':
      case 'xcFunctionModelsEnable':
      case 'functionMetaCreate':
        if (!this.config.try) {
        }
        break;
    }
  }

  protected async _createApiBuilder() {
    this.apiBuilders.splice(0, this.apiBuilders.length);
    let i = 0;

    const connectionConfigs = [];

    /* for each db create an api builder */
    for (const db of this.config?.envs?.[this.appConfig?.workingEnv]?.db ||
      []) {
      let Builder;
      switch (db.meta.api.type) {
        case 'graphql':
          Builder = GqlApiBuilder;
          break;

        case 'rest':
          Builder = RestApiBuilder;
          break;
      }

      if ((db?.connection as any)?.database) {
        const connectionConfig = {
          ...db,
          meta: {
            ...db.meta,
            api: {
              ...db.meta.api,
              prefix: db.meta.api.prefix || this.genVer(i),
            },
          },
        };

        this.apiBuilders.push(
          new Builder(
            this.app,
            this,
            this.config,
            connectionConfig,
            this.app.ncMeta
          )
        );
        connectionConfigs.push(connectionConfig);
        i++;
      } else if (db.meta?.allSchemas) {
        /* get all schemas and create APIs for all of them */
        const sqlClient = SqlClientFactory.create({
          ...db,
          connection: { ...db.connection, database: undefined },
        });

        // @ts-ignore
        const schemaList = (await sqlClient.schemaList({}))?.data?.list;
        for (const schema of schemaList) {
          const connectionConfig = {
            ...db,
            connection: { ...db.connection, database: schema.schema_name },
            meta: {
              ...db.meta,
              dbAlias: i ? db.meta.dbAlias + i : db.meta.dbAlias,
              api: {
                ...db.meta.api,
                prefix: db.meta.api.prefix || this.genVer(i),
              },
            },
          };

          this.apiBuilders.push(
            new Builder(
              this.app,
              this,
              this.config,
              connectionConfig,
              this.app.ncMeta
            )
          );
          connectionConfigs.push(connectionConfig);

          i++;
        }

        sqlClient.knex.destroy();
      }
    }
    if (this.config?.envs?.[this.appConfig.workingEnv]?.db) {
      this.config.envs[this.appConfig.workingEnv].db.splice(
        0,
        this.config.envs[this.appConfig.workingEnv].db.length,
        ...connectionConfigs
      );
    }
  }

  protected genVer(i): string {
    const l = 'vwxyzabcdefghijklmnopqrstu';
    return (
      i
        .toString(26)
        .split('')
        .map((v) => l[parseInt(v, 26)])
        .join('') + '1'
    );
  }

  protected async syncMigration(): Promise<void> {
    if (
      this.appConfig?.toolDir
      // && !('NC_MIGRATIONS_DISABLED' in process.env)
    ) {
      const dbs = this.config?.envs?.[this.appConfig.workingEnv]?.db;

      if (!dbs || !dbs.length) {
        return;
      }

      for (const connectionConfig of dbs) {
        try {
          const sqlClient = NcConnectionMgr.getSqlClient({
            dbAlias: connectionConfig?.meta?.dbAlias,
            env: this.config.env,
            config: this.config,
            projectId: this.id,
          });
          /* create sql-migrator */
          const migrator = new Migrator({
            project_id: this.id,
            config: this.config,
            metaDb: this.app?.ncMeta?.knex,
          });

          /* if sql-migrator folder doesn't exist for project - call migratior init */
          const migrationFolder = path.join(
            this.app.getToolDir(),
            'nc',
            this.id,
            connectionConfig.meta.dbAlias,
            'migrations'
          );
          if (!fs.existsSync(migrationFolder)) {
            await migrator.init({
              folder: this.app.getToolDir(),
              env: this.appConfig.workingEnv,
              dbAlias: connectionConfig.meta.dbAlias,
            });
          }

          /* sql-migrator : sync & up */
          await migrator.sync({
            folder: this.app.getToolDir(),
            env: this.appConfig.workingEnv,
            dbAlias: connectionConfig.meta.dbAlias,
            sqlClient,
          });

          await migrator.migrationsUp({
            folder: this.app.getToolDir(),
            env: this.appConfig.workingEnv,
            dbAlias: connectionConfig.meta.dbAlias,
            migrationSteps: 99999,
            sqlContentMigrate: 1,
            sqlClient,
          });
        } catch (e) {
          console.log(e);
          // throw e;
        }
      }
    } else {
    }
  }

  protected static triggerGarbageCollect() {
    try {
      if (global.gc) {
        global.gc();
      }
    } catch (e) {
      console.log('`node --expose-gc index.js`');
      process.exit();
    }
  }

  protected initApiInfoRoute(): void {
    this.router.get(`/projectApiInfo`, (req: any, res): any => {
      // auth to admin
      if (this.config.auth) {
        if (this.config.auth.jwt) {
          if (
            !(
              req.session.passport.user.roles.owner ||
              req.session.passport.user.roles.creator ||
              req.session.passport.user.roles.editor ||
              req.session.passport.user.roles.commenter ||
              req.session.passport.user.roles.viewer
            )
          ) {
            return res.status(401).json({
              msg: 'Unauthorized access : xc-auth does not have admin permission',
            });
          }
        } else if (this.config.auth.masterKey) {
          if (
            req.headers['xc-master-key'] !== this.config.auth.masterKey.secret
          ) {
            return res.status(401).json({
              msg: 'Unauthorized access : xc-admin header missing or not matching',
            });
          }
        }
      }

      const info: any = {};

      for (const builder of this.apiBuilders) {
        info[builder.getDbAlias()] = {
          swaggerUrl: `/nc/${this.id}/${builder.getDbAlias()}/swagger`,
          apiUrl: `/nc/${this.id}//api/${builder.apiPrefix}`,
          gqlApiUrl: `/nc/${this.id}/${builder.apiPrefix}/graphql`,
          grpcApiUrl: ``,
          apiType: builder.apiType,
          database: builder.getDbName(),
        };
      }

      const result = {
        info,
        aggregatedInfo: {
          list: this.apiInfInfoList,
          aggregated: this.aggregatedApiInfo,
        },
      };

      res.json(result);
    });
  }

  protected async progress(info, allInfo, isFirstTime?) {
    const aggregatedInfo = allInfo
      .reduce(
        (arrSum, infoObj) => [
          '',
          arrSum[1] + +infoObj.tablesCount,

          arrSum[2] + (infoObj.type === 'graphql' ? 1 : 0),
          arrSum[3] + +(infoObj.type === 'rest' ? 1 : 0),

          arrSum[4] + (+infoObj.apiCount || +infoObj.resolversCount || 0),
          // arrSum[3] + +info.timeTaken
          (Date.now() - this.startTime) / 1000,
        ],
        [0, 0, 0, 0, 0, 0]
      )
      .map((v, i) =>
        i === 5 ? v.toFixed(1) + 's' : i === 2 ? v.toLocaleString() : v
      );

    this.apiInfInfoList.push(info);
    this.aggregatedApiInfo = aggregatedInfo;
    if (isFirstTime) {
      Tele.emit('evt_api_created', info);
    }
  }

  protected async addAuthHookToMiddleware(): Promise<any> {
    this.authHook = await this.app.ncMeta.metaGet(this.id, 'db', 'nc_hooks', {
      type: 'AUTH_MIDDLEWARE',
    });

    this.router.use(async (req: any, _res, next) => {
      if (this.authHook && this.authHook.url) {
        try {
          const result = await axios.post(
            this.authHook.url,
            {},
            {
              headers: req.headers,
            }
          );
          req.locals = req.locals || {};
          req.locals = { user: result.data };
        } catch (e) {
          console.log(e);
        }
      }
      next();
    });
  }

  public get prefix(): string {
    return this.config?.prefix;
  }

  public get config(): any {
    return this._config;
  }

  public updateConfig(config: string) {
    this._config = { ...this.appConfig, ...JSON.parse(config) };
  }

  public async reInit() {
    this.router.stack.splice(0, this.router.stack.length);
    this.apiBuilders.splice(0, this.apiBuilders.length);
    await this.app.ncMeta.projectStatusUpdate(this.id, 'stopped');
    const dbs = this.config?.envs?.[this.appConfig.workingEnv]?.db;

    if (!dbs || !dbs.length) {
      return;
    }

    for (const connectionConfig of dbs) {
      NcConnectionMgr.delete({
        dbAlias: connectionConfig?.meta?.dbAlias,
        env: this.config.env,
        projectId: this.id,
      });
    }
    NcProjectBuilder.triggerGarbageCollect();
    await this.init();
  }
}
