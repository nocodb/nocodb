import type { RateLimitConfig } from '~/utils/rate-limit/abstract-rate-limiter';
import type IORedis from 'ioredis';
import { AbstractRateLimiter } from '~/utils/rate-limit/abstract-rate-limiter';
import { NcError } from '~/helpers/ncError';

/*
-- KEYS[1] = hitKey
-- KEYS[2] = blockKey
-- ARGV[1] = intervalMs
-- ARGV[2] = maxHit
-- ARGV[3] = blockDurationMs
*/

// LUA script to increment
const RATE_LIMIT_LUA = `
if redis.call("EXISTS", KEYS[2]) == 1 then
  return {0, "BLOCKED"}
end

local hits = redis.call("INCR", KEYS[1])
local ttl = redis.call("PTTL", KEYS[1])

-- Set expiry if key is new or has no expiry
if ttl == -1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])  -- ARGV[1] should be in milliseconds
end

if hits > tonumber(ARGV[2]) then
  redis.call("SET", KEYS[2], 1, "PX", ARGV[3], "NX")
  return {0, "RATE_LIMIT"}
end

return {1, hits}
`;

let rateLimitScriptSha = '';

/**
 * Redis-based rate limiter implementation using distributed locking
 * Stores rate limit state in Redis and uses Redlock for atomic operations
 *
 * Referenced in:
 * - src/utils/rate-limit/in-memory-rate-limiter.ts (similar implementation pattern)
 * - src/utils/rate-limit/abstract-rate-limiter.ts (base class)
 */
export class RedisRateLimiter extends AbstractRateLimiter {
  constructor(redis: IORedis, config: RateLimitConfig) {
    super(config);
    this.redis = redis;
  }
  protected config: RateLimitConfig;
  redis: IORedis;
  private sha?: string;

  private async loadScript(): Promise<string> {
    if (!rateLimitScriptSha) {
      rateLimitScriptSha = (await this.redis.script(
        'LOAD',
        RATE_LIMIT_LUA,
      )) as string;
    } else {
      // fallback, if redis restart but instance still running (sha is deleted)
      const exists = await this.redis.script('EXISTS', rateLimitScriptSha);
      if (!exists) {
        rateLimitScriptSha = (await this.redis.script(
          'LOAD',
          RATE_LIMIT_LUA,
        )) as string;
      }
    }
    return rateLimitScriptSha;
  }

  /**
   * validate if given key can execute
   * @param key key to validate execution
   * @returns true if valid to execute, otherwise throws error
   */
  async validate(key: string | (() => string)): Promise<boolean> {
    const { maxHit, intervalMs, blockDurationMs } = this.config;
    const rateLimitKey = typeof key === 'string' ? key : key();

    const hitKey = `rate-limit:hit:${rateLimitKey}`;
    const blockKey = `rate-limit:block:${rateLimitKey}`;

    // Acquire distributed lock
    const sha = await this.loadScript();

    let result: [number, string | number];

    try {
      result = (await this.redis.evalsha(
        sha,
        2,
        hitKey,
        blockKey,
        intervalMs,
        maxHit,
        blockDurationMs,
      )) as [number, string | number];
    } catch (err: any) {
      throw err;
    }

    const [allowed] = result;
    if (allowed === 0) {
      throw NcError.get().rateLimitReached();
    }
    return true;
  }
}
