import { MiddlewareConsumer, Module, RequestMethod } from '@nestjs/common'
import { Connection } from './connection/connection';
import { AuthModule } from './modules/auth/auth.module';
import { ExtractProjectIdMiddleware } from './middlewares/extract-project-id/extract-project-id.middleware';
import { UsersModule } from './modules/users/users.module';
import { MetaService } from './meta/meta.service';
import { LocalStrategy } from './strategies/local.strategy';
import { UtilsModule } from './modules/utils/utils.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthGuard } from '@nestjs/passport';
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

@Module({
  imports: [AuthModule, UsersModule, UtilsModule, ProjectsModule, TablesModule, ViewsModule, FiltersModule, SortsModule, ColumnsModule, ViewColumnsModule, BasesModule, HooksModule, SharedBasesModule, FormsModule, GridsModule, KanbansModule, GalleriesModule, FormColumnsModule, GridColumnsModule, MapsModule, ProjectUsersModule, ModelVisibilitiesModule, HookFiltersModule, ApiTokensModule, AttachmentsModule],
  controllers: [],
  providers: [Connection, MetaService, JwtStrategy, ExtractProjectIdMiddleware],
  exports: [Connection, MetaService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(ExtractProjectIdMiddleware)
      .forRoutes({ path: '*',  method: RequestMethod.ALL})
  }
}
