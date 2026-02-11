import type { RateLimitConfig } from '~/utils/rate-limit/abstract-rate-limiter';
import { NcError } from '~/helpers/ncError';
import { AbstractRateLimiter } from '~/utils/rate-limit/abstract-rate-limiter';

type RateLimitState = {
  hits: number;
  windowStart: number;
  blockedUntil: number | null;
};

const rateLimitMap: Record<string, RateLimitState> = {};

export class InMemoryRateLimiter extends AbstractRateLimiter {
  protected config: RateLimitConfig;

  async validate(key: string | (() => string)): Promise<boolean> {
    const { maxHit, intervalMs, blockDurationMs } = this.config;
    const rateLimitKey = typeof key === 'string' ? key : key();
    const now = Date.now();

    let state = rateLimitMap[rateLimitKey];

    if (!state) {
      state = {
        hits: 0,
        windowStart: now,
        blockedUntil: null,
      };
      rateLimitMap[rateLimitKey] = state;
    }

    if (state.blockedUntil && now < state.blockedUntil) {
      NcError.get().rateLimitReached();
    }

    if (now - state.windowStart >= intervalMs) {
      state.hits = 0;
      state.windowStart = now;
      state.blockedUntil = null;
    }

    if (state.hits >= maxHit) {
      state.blockedUntil = now + blockDurationMs;
      NcError.get().rateLimitReached();
    }

    state.hits += 1;
    return true;
  }
}
