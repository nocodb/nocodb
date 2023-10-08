import { Injectable } from '@nestjs/common';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from '~/interface/config';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
} from '@nestjs/throttler';

class CustomThrottlerStorageRedisService extends ThrottlerStorageRedisService {
  // keeping this for reference
  //   getScriptSrc(): string {
  //     return `
  //       -- Generate a shadow key
  //       local shadowKey = KEYS[1].."_shadow"
  //       local totalHits = redis.call("INCR", KEYS[1])
  //       -- Set shadow key value to totalHits
  //       redis.call("SET", shadowKey, totalHits)
  //       local timeToExpire = redis.call("PTTL", KEYS[1])
  //       if timeToExpire <= 0
  //         then
  //           redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[1]))
  //           timeToExpire = tonumber(ARGV[1])
  //         end
  //       return { totalHits, timeToExpire }
  //     `
  //       .replace(/^\s+/gm, '')
  //       .trim();
  //   }
}

const HEADER_NAME = 'xc-token';

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
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().headers[HEADER_NAME];
          },
          name: 'meta',
        },
        {
          ttl: config.data.ttl,
          limit: config.data.max_apis,
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().headers[HEADER_NAME];
          },
          name: 'data',
        },
        {
          ttl: config.public.ttl,
          limit: config.public.max_apis,
          skipIf: (context) => {
            return !context.switchToHttp().getRequest().clientIp;
          },
          name: 'public',
        },
      ],
      storage: new CustomThrottlerStorageRedisService(
        process.env['NC_THROTTLER_REDIS'],
      ),
    };
  }
}
