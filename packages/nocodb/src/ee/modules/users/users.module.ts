import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { UsersController } from '~/controllers/users/users.controller';
import { OpenidStrategyProvider } from '~/strategies/openid.strategy/openid.strategy';
import { WorkspacesService } from '~/ee/modules/workspaces/workspaces.service';
import { ProjectsService } from '~/services/projects.service';
import { TablesService } from '~/services/tables.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { ColumnsService } from '~/services/columns.service';
@Module({
  imports: [GlobalModule, PassportModule],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [UsersController] : []),
  ],
  providers: [
    UsersService,
    GoogleStrategyProvider,
    OpenidStrategyProvider,
    WorkspacesService,
    ProjectsService,
    TablesService,
    MetaDiffsService,
    ColumnsService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
