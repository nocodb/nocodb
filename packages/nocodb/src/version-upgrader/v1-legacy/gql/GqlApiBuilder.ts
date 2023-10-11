import { Router } from 'express';
import BaseApiBuilder from '../BaseApiBuilder';
import type NcProjectBuilder from '../NcProjectBuilder';
import type XcMetaMgr from '~/interface/XcMetaMgr';
import type { DbConfig, NcConfig } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type Noco from '~/Noco';
import GqlXcSchemaFactory from '~/db/sql-mgr/code/gql-schema/xc-ts/GqlXcSchemaFactory';

export class GqlApiBuilder extends BaseApiBuilder<Noco> implements XcMetaMgr {
  public readonly type = 'gql';

  private readonly gqlRouter: Router;

  constructor(
    app: Noco,
    baseBuilder: NcProjectBuilder,
    config: NcConfig,
    connectionConfig: DbConfig,
    xcMeta?: MetaService,
  ) {
    super(app, baseBuilder, config, connectionConfig);
    this.config = config;
    this.connectionConfig = connectionConfig;
    this.gqlRouter = Router();
    this.xcMeta = xcMeta;
  }

  public async init(): Promise<void> {
    await super.init();
  }

  protected async ncUpAddNestedResolverArgs(_ctx: any): Promise<any> {
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
        meta._tn,
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
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          schema,
        },
        {
          title: meta.tn,
          type: 'table',
        },
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
        meta._tn,
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
        this.baseId,
        this.dbAlias,
        'nc_models',
        {
          schema,
        },
        {
          title: meta.tn,
          type: 'table',
        },
      );

      // todo : add loaders

      if (meta.manyToMany) {
        for (const mm of meta.manyToMany) {
          await this.xcMeta.metaInsert(
            this.baseId,
            this.dbAlias,
            'nc_loaders',
            {
              title: `${mm.tn}Mm${mm.rtn}List`,
              parent: mm.tn,
              child: mm.rtn,
              relation: 'mm',
              resolver: 'mmlist',
            },
          );
        }
      }
    }
  }
}
