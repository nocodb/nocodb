import { Global, Module } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ExtractJwt } from 'passport-jwt';
import { Connection } from '../../connection/connection';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import { SocketService } from '../../services/socket.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import NcConfigFactory from '../../utils/NcConfigFactory';
import { UsersService } from '../../services/users/users.service';
import type { Provider } from '@nestjs/common';
import {AppHooksService} from "../../services/app-hooks.service";

export const JwtStrategyProvider: Provider = {
  provide: JwtStrategy,
  useFactory: async (usersService: UsersService) => {
    const config = await NcConfigFactory.make();

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
  inject: [UsersService],
};

@Global()
@Module({
  imports: [],
  providers: [
    Connection,
    MetaService,
    UsersService,
    JwtStrategyProvider,
    GlobalGuard,
    SocketService,
  ],
  exports: [
    Connection,
    MetaService,
    JwtStrategyProvider,
    UsersService,
    GlobalGuard,
    SocketService,
    AppHooksService,
  ],
})
export class GlobalModule {}
