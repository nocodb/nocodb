import { authModuleMetadata } from 'src/modules/auth/auth.module';
import { Module } from '@nestjs/common';
import type { MiddlewareConsumer } from '@nestjs/common';

/* Auth */
import { AuthController } from '~/modules/auth/auth.controller';
import { AuthTokenStrategy as AuthTokenStrategyCE } from 'src/strategies/authtoken.strategy/authtoken.strategy';
import { AuthTokenStrategy } from '~/strategies/authtoken.strategy/authtoken.strategy';
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
    // Replace CE AuthTokenStrategy with EE version that handles fine-grained tokens
    ...authModuleMetadata.providers.filter((p) => p !== AuthTokenStrategyCE),
    AuthTokenStrategy,
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
