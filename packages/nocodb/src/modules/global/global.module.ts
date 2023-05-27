import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { SocketGateway } from '../../gateways/socket.gateway';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { UsersService } from '../../services/users/users.service';
import Noco from '../../Noco';
import { InitMetaServiceProvider } from './init-meta-service.provider';
import type { Provider } from '@nestjs/common';

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

@Global()
@Module({
  imports: [],
  providers: [
    InitMetaServiceProvider,
    UsersService,
    JwtStrategyProvider,
    GlobalGuard,
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [SocketGateway] : []),
  ],
  exports: [
    MetaService,
    JwtStrategyProvider,
    UsersService,
    GlobalGuard,
    ...(process.env.NC_WORKER_CONTAINER !== 'true' ? [SocketGateway] : []),
  ],
})
export class GlobalModule {}
