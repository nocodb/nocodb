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

@Module({
  imports: [AuthModule, UsersModule, UtilsModule, ProjectsModule, TablesModule, ViewsModule, FiltersModule, SortsModule, ColumnsModule],
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
