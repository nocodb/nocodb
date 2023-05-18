import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import {
  AppInitService,
  appInitServiceProvider,
} from '../../services/app-init.service';
import { SocketGateway } from '../../gateways/socket.gateway';
import { Connection } from '../../connection/connection';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import Noco from '../../Noco';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { UsersService } from '../../services/users/users.service';
import type { Provider } from '@nestjs/common';

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (
    usersService: UsersService,
    appInitService: AppInitService,
  ) => {
    const config = appInitService.appConfig;

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
  inject: [UsersService, AppInitService],
};

@Global()
@Module({
  imports: [],
  providers: [
    appInitServiceProvider,
    Connection,
    MetaService,
    UsersService,
    JwtStrategyProvider,
    GlobalGuard,
    ...(!process.env['NC_WORKER_CONTAINER'] ? [SocketGateway] : []),
  ],
  exports: [
    AppInitService,
    Connection,
    MetaService,
    JwtStrategyProvider,
    UsersService,
    GlobalGuard,
    ...(!process.env['NC_WORKER_CONTAINER'] ? [SocketGateway] : []),
  ],
})
export class GlobalModule {}
