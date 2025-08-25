import { Injectable } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
} from '@nestjs/throttler';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';
import { getApiTokenFromAuthHeader } from '~/helpers';

const HEADER_NAME = 'xc-token';
const HEADER_NAME_GUI = 'xc-auth';
const HEADER_NAME_AUTH = 'authorization';

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(private readonly configService: ConfigService<AppConfig>) {}

  createThrottlerOptions(): ThrottlerModuleOptions {
    const config = this.configService.get('throttler', { infer: true });

    return {
      throttlers: [
        {
          ttl: config.meta.ttl,
          limit: config.meta.max_apis,
          blockDuration: config.meta.block_duration,
          skipIf: (context) => {
            const req = context.switchToHttp().getRequest();
            return (
              !req.headers[HEADER_NAME] &&
              !getApiTokenFromAuthHeader(req.headers[HEADER_NAME_AUTH])
            );
          },
          name: 'meta',
        },
        {
          ttl: config.meta_gui.ttl,
          limit: config.meta_gui.max_apis,
          blockDuration: config.meta_gui.block_duration,
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().headers[
              HEADER_NAME_GUI
            ];
          },
          name: 'meta-gui',
        },
        {
          ttl: config.data.ttl,
          limit: config.data.max_apis,
          blockDuration: config.data.block_duration,
          skipIf: (context) => {
            const req = context.switchToHttp().getRequest();
            return (
              !req.headers[HEADER_NAME] &&
              !getApiTokenFromAuthHeader(req.headers[HEADER_NAME_AUTH])
            );
          },
          name: 'data',
        },
        {
          ttl: config.data_gui.ttl,
          limit: config.data_gui.max_apis,
          blockDuration: config.data_gui.block_duration,
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().headers[
              HEADER_NAME_GUI
            ];
          },
          name: 'data-gui',
        },
        {
          ttl: config.public.ttl,
          limit: config.public.max_apis,
          blockDuration: config.public.block_duration,
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().clientIp;
          },
          name: 'public',
        },
      ],
      storage: new ThrottlerStorageRedisService(
        getRedisURL(NC_REDIS_TYPE.THROTTLER),
      ),
    };
  }
}
