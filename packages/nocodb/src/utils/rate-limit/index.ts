import Redis from 'ioredis';
import type { RateLimitConfig } from '~/utils/rate-limit/abstract-rate-limiter';
import { InMemoryRateLimiter } from '~/utils/rate-limit/in-memory-rate-limiter';
import { RedisRateLimiter } from '~/utils/rate-limit/redis-rate-limit';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

export const withRateLimit = (config: RateLimitConfig) => {
  if (process.env.NC_REDIS_URL) {
    return new RedisRateLimiter(
      new Redis(getRedisURL(NC_REDIS_TYPE.THROTTLER)),
      config,
    );
  } else {
    return new InMemoryRateLimiter(config);
  }
};
