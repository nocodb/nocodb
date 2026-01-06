export interface RateLimitConfig {
  maxHit: number;
  intervalMs: number;
  blockDurationMs: number;
}

export abstract class AbstractRateLimiter {
  constructor(config: RateLimitConfig) {
    this.config = config;
  }
  protected config: RateLimitConfig;
  abstract withRateLimited<T>(
    handle: () => Promise<T>,
    key: string | (() => string),
  ): Promise<T>;
}
