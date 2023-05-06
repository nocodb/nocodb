import { Injectable } from '@nestjs/common';
import { ThrottlerStorageRedisService } from 'nestjs-throttler-storage-redis';
import { ConfigService } from '@nestjs/config';
import type {
  ThrottlerModuleOptions,
  ThrottlerOptionsFactory,
} from '@nestjs/throttler';

class CustomThrottlerStorageRedisService extends ThrottlerStorageRedisService {
  getScriptSrc(): string {
    return `
      -- Generate a shadow key
      local shadowKey = KEYS[1].."_shadow"
      local totalHits = redis.call("INCR", KEYS[1])
      -- Set shadow key value to totalHits
      redis.call("SET", shadowKey, totalHits)
      local timeToExpire = redis.call("PTTL", KEYS[1])
      if timeToExpire <= 0
        then
          redis.call("PEXPIRE", KEYS[1], tonumber(ARGV[1]))
          timeToExpire = tonumber(ARGV[1])
        end
      return { totalHits, timeToExpire }
    `
      .replace(/^\s+/gm, '')
      .trim();
  }
}

@Injectable()
export class ThrottlerConfigService implements ThrottlerOptionsFactory {
  constructor(private readonly configService: ConfigService) {}

  createThrottlerOptions(): ThrottlerModuleOptions {
    const config = this.configService.get<{ ttl: number; limit: number }>(
      'throttler',
    );

    return {
      ttl: config.ttl,
      limit: config.limit,
      skipIf: (context) => {
        // check request header contains 'xc-token', if missing skip throttling
        return !context.switchToHttp().getRequest().headers['xc-auth'];
      },

      storage: new CustomThrottlerStorageRedisService(),
    };
  }
}
