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
  abstract validate(key: string | (() => string)): Promise<boolean>;
}
