import { Router } from 'express';
import { GqlApiBuilder } from './gql/GqlApiBuilder';
import { RestApiBuilder } from './rest/RestApiBuilder';
import type Noco from '~/Noco';
import type { NcConfig } from '~/interface/config';
import { SqlClientFactory } from '~/db/sql-client/lib/SqlClientFactory';

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

  constructor(app: Noco, appConfig: NcConfig, base: any) {
    this.app = app;
    this.appConfig = appConfig;

    if (base) {
      this.id = base.id;
      this.title = base.title;
      this.description = base.description;
      this._config = { ...this.appConfig, ...JSON.parse(base.config) };
      this.router = Router();
    }
  }

  public async init(_isFirstTime?: boolean) {
    try {
      // await this.addAuthHookToMiddleware();

      this.startTime = Date.now();
      const allRoutesInfo: any[] = [];
      // await this.app.ncMeta.baseStatusUpdate(this.id, 'starting');
      // await this.syncMigration();
      await this._createApiBuilder();
      // this.initApiInfoRoute();

      /* Create REST APIs / GraphQL Resolvers */
      for (const meta of this.apiBuilders) {
        let routeInfo;
        if (meta instanceof RestApiBuilder) {
          console.log(
            `Creating REST APIs ${meta.getDbType()} - > ${meta.getDbName()}`,
          );
          routeInfo = await (meta as RestApiBuilder).init();
        } else if (meta instanceof GqlApiBuilder) {
          console.log(
            `Creating GraphQL APIs ${meta.getDbType()} - > ${meta.getDbName()}`,
          );
          routeInfo = await (meta as GqlApiBuilder).init();
        }
        allRoutesInfo.push(routeInfo);
        // this.progress(routeInfo, allRoutesInfo, isFirstTime);
      }

      // this.app.baseRouter.use(`/nc/${this.id}`, this.router);
      // await this.app.ncMeta.baseStatusUpdate(this.id, 'started');
    } catch (e) {
      console.log(e);
      throw e;
      // await this.app.ncMeta.baseStatusUpdate(this.id, 'stopped');
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
            this.app.ncMeta,
          ),
        );
        connectionConfigs.push(connectionConfig);
        i++;
      } else if (db.meta?.allSchemas) {
        /* get all schemas and create APIs for all of them */
        const sqlClient = await SqlClientFactory.create({
          ...db,
          connection: { ...db.connection, database: undefined },
        });

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
              this.app.ncMeta,
            ),
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
        ...connectionConfigs,
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

  public get prefix(): string {
    return this.config?.prefix;
  }

  public get config(): any {
    return this._config;
  }

  public updateConfig(config: string) {
    this._config = { ...this.appConfig, ...JSON.parse(config) };
  }
}
