import { Module, RequestMethod } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ExtractJwt } from 'passport-jwt';
import { Connection } from './connection/connection';
import { GlobalExceptionFilter } from './filters/global-exception/global-exception.filter';
import { GlobalMiddleware } from './middlewares/global/global.middleware';
import { AuthModule } from './modules/auth/auth.module';
import { ExtractProjectIdMiddleware } from './middlewares/extract-project-id/extract-project-id.middleware';
import { UsersModule } from './modules/users/users.module';
import { MetaService } from './meta/meta.service';
import { UsersService } from './modules/users/users.service';
import { UtilsModule } from './modules/utils/utils.module';
import { ProjectsModule } from './modules/projects/projects.module';
import Noco from './Noco';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TablesModule } from './modules/tables/tables.module';
import { ViewsModule } from './modules/views/views.module';
import { FiltersModule } from './modules/filters/filters.module';
import { SortsModule } from './modules/sorts/sorts.module';
import { ColumnsModule } from './modules/columns/columns.module';
import { ViewColumnsModule } from './modules/view-columns/view-columns.module';
import { BasesModule } from './modules/bases/bases.module';
import { HooksModule } from './modules/hooks/hooks.module';
import { SharedBasesModule } from './modules/shared-bases/shared-bases.module';
import { FormsModule } from './modules/forms/forms.module';
import { GridsModule } from './modules/grids/grids.module';
import { KanbansModule } from './modules/kanbans/kanbans.module';
import { GalleriesModule } from './modules/galleries/galleries.module';
import { FormColumnsModule } from './modules/form-columns/form-columns.module';
import { GridColumnsModule } from './modules/grid-columns/grid-columns.module';
import { MapsModule } from './modules/maps/maps.module';
import { ProjectUsersModule } from './modules/project-users/project-users.module';
import { ModelVisibilitiesModule } from './modules/model-visibilities/model-visibilities.module';
import { HookFiltersModule } from './modules/hook-filters/hook-filters.module';
import { ApiTokensModule } from './modules/api-tokens/api-tokens.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { OrgLcenseModule } from './modules/org-lcense/org-lcense.module';
import { OrgTokensModule } from './modules/org-tokens/org-tokens.module';
import { OrgUsersModule } from './modules/org-users/org-users.module';
import { MetaDiffsModule } from './modules/meta-diffs/meta-diffs.module';
import { AuditsModule } from './modules/audits/audits.module';
import { DatasModule } from './modules/datas/datas.module';
import { ApiDocsModule } from './modules/api-docs/api-docs.module';
import { PublicMetasModule } from './modules/public-metas/public-metas.module';
import { PublicDatasModule } from './modules/public-datas/public-datas.module';
import { PublicDatasExportModule } from './modules/public-datas-export/public-datas-export.module';
import { SyncModule } from './modules/sync/sync.module';
import { ImportModule } from './modules/import/import.module';
import { CachesModule } from './modules/caches/caches.module';
import { TestModule } from './modules/test/test.module';
import { PluginsModule } from './modules/plugins/plugins.module';
import { GlobalModule } from './modules/global/global.module';
import NcConfigFactory from './utils/NcConfigFactory'
import NcUpgrader from './version-upgrader/NcUpgrader';
import type {
  MiddlewareConsumer,
  OnApplicationBootstrap,
  Provider,
} from '@nestjs/common';

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (usersService: UsersService) => {
    const config = await NcConfigFactory.make()

    const options = {
      // ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromHeader('xc-auth'),
      // expiresIn: '10h',
      passReqToCallback: true,
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
    };

    return new JwtStrategy(options, usersService);
  },
  inject: [UsersService],
};

@Module({
  imports: [
    GlobalModule,
    // AuthModule,
    UsersModule,
    UtilsModule,
    ProjectsModule,
    TablesModule,
    ViewsModule,
    FiltersModule,
    SortsModule,
    ColumnsModule,
    ViewColumnsModule,
    BasesModule,
    HooksModule,
    SharedBasesModule,
    FormsModule,
    GridsModule,
    KanbansModule,
    GalleriesModule,
    FormColumnsModule,
    GridColumnsModule,
    MapsModule,
    ProjectUsersModule,
    ModelVisibilitiesModule,
    HookFiltersModule,
    ApiTokensModule,
    AttachmentsModule,
    OrgLcenseModule,
    OrgTokensModule,
    OrgUsersModule,
    MetaDiffsModule,
    AuditsModule,
    DatasModule,
    ApiDocsModule,
    PublicMetasModule,
    PublicDatasModule,
    PublicDatasExportModule,
    SyncModule,
    ImportModule,
    CachesModule,
    TestModule,
    PluginsModule,
  ],
  controllers: [],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    JwtStrategyProvider,
    ExtractProjectIdMiddleware,
  ],
})
export class AppModule implements OnApplicationBootstrap {
  constructor(
    private readonly connection: Connection,
    private readonly metaService: MetaService,
  ) {}

  // Global Middleware
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(GlobalMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  // app init
  async onApplicationBootstrap(): Promise<void> {
    await this.connection.init();
    await this.metaService.init();

    // todo: remove
    // temporary hack
    Noco._ncMeta = this.metaService;
    Noco.config = this.connection.config;

    // run upgrader
    await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });
  }
}
