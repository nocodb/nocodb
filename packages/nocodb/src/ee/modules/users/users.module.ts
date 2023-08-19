import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { UsersController } from '~/controllers/users/users.controller';
import { OpenidStrategyProvider } from '~/strategies/openid.strategy/openid.strategy';
import { ProjectsService } from '~/services/projects.service';
import { TablesService } from '~/services/tables.service';
import { MetaDiffsService } from '~/services/meta-diffs.service';
import { ColumnsService } from '~/services/columns.service';
import { MetasModule } from '~/modules/metas/metas.module';

@Module({
  imports: [GlobalModule, PassportModule, MetasModule],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [UsersController] : []),
  ],
  providers: [
    UsersService,
    GoogleStrategyProvider,
    OpenidStrategyProvider,
    ProjectsService,
    TablesService,
    MetaDiffsService,
    ColumnsService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
