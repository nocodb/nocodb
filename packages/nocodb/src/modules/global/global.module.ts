import { Global, Module } from '@nestjs/common';
import { ExtractJwt } from 'passport-jwt';
import { T } from 'nc-help';
import { SocketGateway } from '../../gateways/socket.gateway';
import { GlobalGuard } from '../../guards/global/global.guard';
import { MetaService } from '../../meta/meta.service';
import { JwtStrategy } from '../../strategies/jwt.strategy';
import { UsersService } from '../../services/users/users.service';
import Noco from '../../Noco';
import NcPluginMgrv2 from '../../helpers/NcPluginMgrv2';
import NcUpgrader from '../../version-upgrader/NcUpgrader';
import NocoCache from '../../cache/NocoCache';
import getInstance from '../../utils/getInstance';
import initAdminFromEnv from '../../helpers/initAdminFromEnv';
import { User } from '../../models';
import { NcConfig, prepareEnv } from '../../utils/nc-config';
import type { Provider } from '@nestjs/common';
import type { IEventEmitter } from '../event-emitter/event-emitter.interface';

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
    {
      // initialize app,
      // 1. init cache
      // 2. init db connection and create if not exist
      // 3. init meta and set to Noco
      // 4. init jwt
      // 5. init plugin manager
      // 6. run upgrader
      useFactory: async (eventEmitter: IEventEmitter) => {
        // NC_DATABASE_URL_FILE, DATABASE_URL_FILE, DATABASE_URL, NC_DATABASE_URL to NC_DB
        await prepareEnv();

        const config = await NcConfig.createByEnv();

        // set version
        process.env.NC_VERSION = '0107004';

        // init cache
        await NocoCache.init();

        // init meta service
        const metaService = new MetaService(config);
        await metaService.init();

        // provide meta and config to Noco
        Noco._ncMeta = metaService;
        Noco.config = config;
        Noco.eventEmitter = eventEmitter;

        // init jwt secret
        await Noco.initJwt();

        // load super admin user from env if env is set
        await initAdminFromEnv(metaService);

        // init plugin manager
        await NcPluginMgrv2.init(Noco.ncMeta);
        await Noco.loadEEState();

        // run upgrader
        await NcUpgrader.upgrade({ ncMeta: Noco._ncMeta });

        T.init({
          instance: getInstance,
        });
        T.emit('evt_app_started', await User.count());

        return metaService;
      },
      provide: MetaService,
      inject: ['IEventEmitter'],
    },
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
