import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { EventEmitterModule } from '../event-emitter/event-emitter.module';
import { InitMetaServiceProvider } from './init-meta-service.provider';
import type { Provider } from '@nestjs/common';
import { SocketGateway } from '~/gateways/socket.gateway';
import { GlobalGuard } from '~/guards/global/global.guard';
import { MetaService } from '~/meta/meta.service';
import Noco from '~/Noco';
import { AppHooksService } from '~/services/app-hooks/app-hooks.service';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import { UsersService } from '~/services/users/users.service';
import { TelemetryService } from '~/services/telemetry.service';
import { AppHooksListenerService } from '~/services/app-hooks-listener.service';

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (usersService: UsersService, metaService: MetaService) => {
    const config = metaService.config;

    await Noco.initJwt();

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
  inject: [UsersService, MetaService],
};

export const globalModuleMetadata ={
  imports: [EventEmitterModule],
  providers: [
    InitMetaServiceProvider,
    AppHooksService,
    UsersService,
    JwtStrategyProvider,
    GlobalGuard,
    SocketGateway,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
  ],
  exports: [
    MetaService,
    JwtStrategyProvider,
    UsersService,
    GlobalGuard,
    AppHooksService,
    AppHooksListenerService,
    TelemetryService,
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [SocketGateway] : []),
  ],
}

@Global()
@Module(globalModuleMetadata)
export class GlobalModule {}
