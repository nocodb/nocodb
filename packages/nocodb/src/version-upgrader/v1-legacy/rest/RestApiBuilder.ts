import autoBind from 'auto-bind';
import BaseApiBuilder from '../BaseApiBuilder';
import type NcProjectBuilder from '../NcProjectBuilder';
import type { Router } from 'express';
import type { DbConfig, NcConfig } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type Noco from '~/Noco';
import NcHelp from '~/utils/NcHelp';
import ExpressXcTsRoutes from '~/db/sql-mgr/code/routes/xc-ts/ExpressXcTsRoutes';
import SwaggerXc from '~/db/sql-mgr/code/routers/xc-ts/SwaggerXc';

export class RestApiBuilder extends BaseApiBuilder<Noco> {
  public readonly type = 'rest';

  protected nocoTypes: any;
  protected nocoRootResolvers: any;
  private routers: { [key: string]: Router };

  constructor(
    app: Noco,
    baseBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig,
    xcMeta?: MetaService,
  ) {
    super(app, baseBuilder, config, connectionConfig);
    autoBind(this);
    this.routers = {};
    this.hooks = {};
    this.xcMeta = xcMeta;
  }

  public async init(): Promise<void> {
    await super.init();
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
        meta._tn,
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
              this.baseId,
              this.dbAlias,
              'nc_routes',
              {
                path: route.path,
                tn: meta.tn,
                title: meta.tn,
                type: route.type,
              },
            ))
          ) {
            await this.xcMeta.metaInsert(
              this.baseId,
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
              },
            );
          } else {
            await this.xcMeta.metaUpdate(
              this.baseId,
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
              },
            );
          }
        };
      });

      await NcHelp.executeOperations(
        routesInsertion,
        this.connectionConfig.client,
      );
    }

    // add new routes
  }

  protected async getManyToManyRelations(args = {}): Promise<Set<any>> {
    const metas: Set<any> = await super.getManyToManyRelations(args);

    for (const metaObj of metas) {
      const ctx = this.generateContextForTable(
        metaObj.tn,
        metaObj.columns,
        [...metaObj.belongsTo, ...metaObj.hasMany],
        metaObj.hasMany,
        metaObj.belongsTo,
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
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          title: metaObj.tn,
          type: 'table',
        },
      );
      const oldSwaggerDoc = JSON.parse(meta.schema);

      // // keep upto 5 schema backup on table update
      // let previousSchemas = [oldSwaggerDoc]
      // if (meta.schema_previous) {
      //   previousSchemas = [...JSON.parse(meta.schema_previous), oldSwaggerDoc].slice(-5);
      // }

      oldSwaggerDoc.definitions = swaggerDoc.definitions;
      await this.xcMeta.metaUpdate(
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          schema: JSON.stringify(oldSwaggerDoc),
          // schema_previous: JSON.stringify(previousSchemas)
        },
        {
          title: metaObj.tn,
          type: 'table',
        },
      );
    }

    return metas;
  }
}
