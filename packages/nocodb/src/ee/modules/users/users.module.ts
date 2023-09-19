import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { UsersController } from '~/controllers/users/users.controller';
import { MetasModule } from '~/modules/metas/metas.module';
import { WorkspacesModule } from '~/modules/workspaces/workspaces.module';

@Module({
  imports: [
    forwardRef(() => GlobalModule),
    PassportModule,
    forwardRef(() => MetasModule),
    WorkspacesModule,
  ],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [UsersController] : []),
  ],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
