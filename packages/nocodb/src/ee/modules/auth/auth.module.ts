import { authModuleMetadata } from 'src/modules/auth/auth.module';
import { Module } from '@nestjs/common';
import type { MiddlewareConsumer } from '@nestjs/common';

/* Auth */
import { AuthController } from '~/modules/auth/auth.controller';
import { OpenidStrategyProvider } from '~/strategies/openid.strategy/openid.strategy';
import { CognitoStrategyProvider } from '~/strategies/cognito.strategy/cognito.strategy';
import { SamlStrategyProvider } from '~/strategies/saml.strategy/saml.strategy';
import { ShortLivedTokenStrategyProvider } from '~/strategies/short-lived-token.strategy/short-lived-token.strategy';
import { SSOAuthController } from '~/modules/auth/sso-auth.controller';
import { SSOPassportMiddleware } from '~/middlewares/sso-paasport/sso-passport.middleware';

export const authModuleEeMetadata = {
  imports: [...authModuleMetadata.imports],
  controllers: [
    ...(process.env.NC_WORKER_CONTAINER !== 'true'
      ? [...authModuleMetadata.controllers, AuthController, SSOAuthController]
      : []),
  ],
  providers: [
    ...authModuleMetadata.providers,
    OpenidStrategyProvider,
    CognitoStrategyProvider,
    SamlStrategyProvider,
    ShortLivedTokenStrategyProvider,
  ],
  exports: [...authModuleMetadata.exports],
};

@Module(authModuleEeMetadata)
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SSOPassportMiddleware).forRoutes(SSOAuthController);
  }
}
