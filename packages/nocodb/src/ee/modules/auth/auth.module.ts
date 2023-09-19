import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { AuthController } from '~/controllers/auth/auth.controller';
import { OpenidStrategyProvider } from '~/strategies/openid.strategy/openid.strategy';
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
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [AuthController] : []),
  ],
  providers: [UsersService, GoogleStrategyProvider, OpenidStrategyProvider],
  exports: [UsersService],
})
export class AuthModule {}
