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
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromHeader('xc-auth'),
        (req: any) => req?.cookies?.nc_token || null,
      ]),
      // expiresIn: '10h',
      passReqToCallback: true,
      secretOrKey: config.auth.jwt.secret,
      ...config.auth.jwt.options,
      // Pin the accepted signature algorithm. All first-party tokens are signed
      // with the symmetric HS256 secret; explicitly restricting the verifier
      // prevents algorithm-substitution attacks and is set last so it cannot be
      // weakened via config.auth.jwt.options.
      algorithms: ['HS256'],
    };

    return new JwtStrategy(options, usersService);
  },
  inject: [UsersService, MetaService],
};
