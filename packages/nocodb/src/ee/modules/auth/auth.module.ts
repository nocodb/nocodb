import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GoogleStrategyProvider } from '~/strategies/google.strategy/google.strategy';
import { GlobalModule } from '~/modules/global/global.module';
import { UsersService } from '~/services/users/users.service';
import { AuthController } from '~/controllers/auth/auth.controller';
import { OpenidStrategyProvider } from '~/strategies/openid.strategy/openid.strategy';
import { MetasModule } from '~/modules/metas/metas.module';
import { WorkspacesModule } from '~/modules/workspaces/workspaces.module';
import { CognitoStrategyProvider } from '~/strategies/cognito.strategy/cognito.strategy';
import { SamlStrategyProvider } from '~/strategies/saml.strategy/saml.strategy';
import { ShortLivedTokenStrategyProvider } from '~/strategies/short-lived-token.strategy/short-lived-token.strategy';

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
  providers: [
    UsersService,
    GoogleStrategyProvider,
    OpenidStrategyProvider,
    CognitoStrategyProvider,
    SamlStrategyProvider,
    ShortLivedTokenStrategyProvider,
  ],
  exports: [UsersService],
})
export class AuthModule {}
