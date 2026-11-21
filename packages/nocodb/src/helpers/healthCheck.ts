import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import Noco from '~/Noco';
import { getRedisURL, NC_REDIS_TYPE } from '~/helpers/redisHelpers';

export type HealthCheckStatus = 'ok' | 'error';

export interface ReadinessResult {
  status: HealthCheckStatus;
  checks: Record<string, HealthCheckStatus>;
}

const CHECK_TIMEOUT_MS = 3000;

const logger = new Logger('HealthCheck');

let inFlight: Promise<ReadinessResult> | null = null;

// The throttler's Redis is left out: the throttler fails open without it.
const redisTargets = () => ({
  redis_job: getRedisURL(NC_REDIS_TYPE.JOB),
  redis_cache: getRedisURL(),
});

// Probe-only clients: no offline queue, so a PING fails at once while Redis is down
// instead of piling up on a client the app uses.
const probeClients = new Map<string, Redis>();

const getProbeClient = (url: string) => {
  let client = probeClients.get(url);
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: CHECK_TIMEOUT_MS,
    });
    client.on('error', () => {});
    probeClients.set(url, client);
  }
  return client;
};

const pingRedis = async (url: string) => {
  const client = getProbeClient(url);
  if (client.status === 'wait') await client.connect();
  await client.ping();
};

const withTimeout = async <T>(promise: Promise<T>, ms: number) => {
  let timer: NodeJS.Timeout;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const runCheck = async (
  name: string,
  fn: () => Promise<unknown>,
): Promise<HealthCheckStatus> => {
  try {
    await withTimeout(fn(), CHECK_TIMEOUT_MS);
    return 'ok';
  } catch (e) {
    logger.warn(`Readiness check '${name}' failed: ${(e as Error)?.message}`);
    return 'error';
  }
};

const runReadinessChecks = async (): Promise<ReadinessResult> => {
  const pending: Record<string, Promise<HealthCheckStatus>> = {
    meta_db: runCheck('meta_db', () =>
      Noco.ncMeta.knexConnection.raw('select 1'),
    ),
  };

  // Roles sharing a URL share one PING.
  const pings = new Map<string, Promise<HealthCheckStatus>>();
  for (const [name, url] of Object.entries(redisTargets())) {
    if (!url) continue;
    if (!pings.has(url))
      pings.set(
        url,
        runCheck(name, () => pingRedis(url)),
      );
    pending[name] = pings.get(url);
  }

  const checks: Record<string, HealthCheckStatus> = {};
  for (const [name, result] of Object.entries(pending)) {
    checks[name] = await result;
  }

  return {
    status: Object.values(checks).every((s) => s === 'ok') ? 'ok' : 'error',
    checks,
  };
};

// Concurrent probes share one round of checks. Responses carry no error detail: the route is public.
export const checkReadiness = (): Promise<ReadinessResult> => {
  inFlight ??= runReadinessChecks().finally(() => {
    inFlight = null;
  });
  return inFlight;
};
