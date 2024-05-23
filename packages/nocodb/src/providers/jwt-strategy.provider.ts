import { ExtractJwt } from 'passport-jwt';
import type { Provider } from '@nestjs/common';
import { MetaService } from '~/meta/meta.service';
import { UsersService } from '~/services/users/users.service';
import { JwtStrategy } from '~/strategies/jwt.strategy';
import Noco from '~/Noco';

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
