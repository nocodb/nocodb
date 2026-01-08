import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';

interface EndpointRateLimit {
  maxRequests: number;
  perMilliseconds: number;
}

interface RateLimitOptions {
  global?: {
    maxRequests: number;        // global rate limit
    perMilliseconds: number;    // window duration (60000 for per-minute)
  };
  perEndpoint?: {
    [pattern: string]: EndpointRateLimit; // per-endpoint limits
  };
  maxQueueSize?: number;        // optional cap on queue
}

/**
 * Creates an Axios instance with a rate limiter.
 * Supports both global and per-endpoint rate limiting
 *
 * Example
 * {
 *   global: { maxRequests: 200, perMilliseconds: 60000 },
 *   perEndpoint: {
 *     '/api/v2/tickets$': { maxRequests: 80, perMilliseconds: 60000 },      // POST
 *     '/api/v2/tickets/': { maxRequests: 80, perMilliseconds: 60000 },      // PUT
 *     '/api/v2/tickets\\?': { maxRequests: 20, perMilliseconds: 60000 },    // GET list
 *     '/api/v2/contacts\\?': { maxRequests: 20, perMilliseconds: 60000 },   // GET list
 *   },
 *   maxQueueSize: 1000
 * }
 */
function createAxiosInstance(
  baseConfig: AxiosRequestConfig = {},
  options?: RateLimitOptions | null,
): AxiosInstance {
  const instance = axios.create(baseConfig);

  // If no rate limiting is needed, return plain instance
  if (!options || (!options.global && !options.perEndpoint)) {
    return instance;
  }

  const { global, perEndpoint = {}, maxQueueSize = Infinity } = options;

  interface QueuedRequest {
    config: InternalAxiosRequestConfig;
    resolve: (value: InternalAxiosRequestConfig) => void;
    reject: (reason: any) => void;
  }

  interface RateLimiter {
    queue: QueuedRequest[];
    requestTimestamps: number[];  // Track when requests were made
    processing: boolean;           // Prevent concurrent processing
  }

  // Global rate limiter
  const globalLimiter: RateLimiter | null = global
    ? { queue: [], requestTimestamps: [], processing: false }
    : null;

  // Per-endpoint rate limiters
  const endpointLimiters = new Map<string, RateLimiter>();

  function getEndpointKey(config: InternalAxiosRequestConfig): string | null {
    const url = config.url || '';

    // Match against patterns
    for (const [pattern, _limits] of Object.entries(perEndpoint)) {
      const regex = new RegExp(pattern);
      if (regex.test(url)) {
        return pattern;
      }
    }
    return null;
  }

  function getOrCreateLimiter(endpointKey: string): RateLimiter {
    if (!endpointLimiters.has(endpointKey)) {
      endpointLimiters.set(endpointKey, {
        queue: [],
        requestTimestamps: [],
        processing: false,
      });
    }
    return endpointLimiters.get(endpointKey)!;
  }

  function cleanOldTimestamps(
    timestamps: number[],
    windowMs: number
  ): number[] {
    const now = Date.now();
    const cutoff = now - windowMs;
    return timestamps.filter(ts => ts > cutoff);
  }

  function canMakeRequest(
    limiter: RateLimiter,
    limits: { maxRequests: number; perMilliseconds: number }
  ): boolean {
    limiter.requestTimestamps = cleanOldTimestamps(
      limiter.requestTimestamps,
      limits.perMilliseconds
    );
    return limiter.requestTimestamps.length < limits.maxRequests;
  }

  function recordRequest(limiter: RateLimiter): void {
    limiter.requestTimestamps.push(Date.now());
  }

  async function processQueue(
    limiter: RateLimiter,
    limits: { maxRequests: number; perMilliseconds: number }
  ): Promise<void> {
    // Prevent concurrent processing
    if (limiter.processing) {
      return;
    }

    limiter.processing = true;

    try {
      while (limiter.queue.length > 0) {
        // Clean up old timestamps
        if (!canMakeRequest(limiter, limits)) {
          // Calculate when next slot will be available
          const oldestTimestamp = limiter.requestTimestamps[0];
          const nextAvailableTime = oldestTimestamp + limits.perMilliseconds;
          const delay = Math.max(0, nextAvailableTime - Date.now());

          // Schedule next processing attempt
          setTimeout(() => processQueue(limiter, limits), delay);
          break;
        }

        // Dequeue and process request
        const request = limiter.queue.shift();
        if (request) {
          recordRequest(limiter);
          request.resolve(request.config);
        }
      }
    } finally {
      limiter.processing = false;
    }
  }

  async function scheduleRequest(
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    const endpointKey = getEndpointKey(config);
    const endpointLimiter = endpointKey ? getOrCreateLimiter(endpointKey) : null;

    // If no limiters apply, proceed immediately
    if (!globalLimiter && !endpointLimiter) {
      return config;
    }

    // Check queue size
    const totalQueueSize =
      (globalLimiter?.queue.length || 0) +
      (endpointLimiter?.queue.length || 0);

    if (totalQueueSize >= maxQueueSize) {
      throw new Error(
        `Rate limit queue overflow (max ${maxQueueSize} requests waiting)`
      );
    }

    // Wait for both limiters if both apply
    const promises: Promise<InternalAxiosRequestConfig>[] = [];

    if (globalLimiter && global) {
      promises.push(
        new Promise<InternalAxiosRequestConfig>((resolve, reject) => {
          globalLimiter.queue.push({ config, resolve, reject });
          processQueue(globalLimiter, global);
        })
      );
    }

    if (endpointLimiter && endpointKey) {
      const limits = perEndpoint[endpointKey];
      promises.push(
        new Promise<InternalAxiosRequestConfig>((resolve, reject) => {
          endpointLimiter.queue.push({ config, resolve, reject });
          processQueue(endpointLimiter, limits);
        })
      );
    }

    // Wait for all applicable limiters to allow the request
    await Promise.all(promises);
    return config;
  }

  // Hook into request pipeline
  instance.interceptors.request.use(
    async (config) => {
      await scheduleRequest(config as InternalAxiosRequestConfig);
      return config;
    },
    (error) => Promise.reject(error),
  );

  // Hook into response pipeline to handle 429 errors
  instance.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error) => {
      // Log rate limit errors for debugging
      if (error.response?.status === 429) {
        console.warn('Rate limit exceeded (429):', error.config?.url);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}

export {
  RateLimitOptions,
  EndpointRateLimit,
  createAxiosInstance
};