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
  private lastCleanupTime = 0;
  private readonly cleanupIntervalMs = 60000; // Cleanup every minute

  // keep this simple for now, in memory should not be used
  private cleanup(): void {
    const now = Date.now();
    const { intervalMs } = this.config;

    // Only run cleanup periodically to avoid performance impact
    if (now - this.lastCleanupTime < this.cleanupIntervalMs) {
      return;
    }

    this.lastCleanupTime = now;

    Object.keys(rateLimitMap).forEach((key) => {
      const state = rateLimitMap[key];
      if (!state) return;

      // Remove entries that are expired and not blocked
      const isExpired = now - state.windowStart >= intervalMs * 2; // Give extra buffer
      const isNotBlocked = !state.blockedUntil || now >= state.blockedUntil;

      if (isExpired && isNotBlocked) {
        delete rateLimitMap[key];
      }
    });
  }

  async validate(key: string | (() => string)): Promise<boolean> {
    this.cleanup();

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
