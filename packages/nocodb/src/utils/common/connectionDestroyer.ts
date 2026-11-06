import { Logger } from '@nestjs/common';

/**
 * A destroyed knex pool fails every query still running on it with `Unable to
 * acquire a connection`. Connections dropped from a cache are therefore
 * destroyed after a grace period, so in-flight requests finish first.
 */
const logger = new Logger('ConnectionDestroyer');

const DEFAULT_GRACE_MS = 120_000;

const graceMs = () => {
  const value = Number(process.env.NC_CONNECTION_DESTROY_GRACE_MS);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_GRACE_MS;
};

interface Destroyable {
  destroy(): Promise<unknown>;
}

const pending = new Map<Destroyable, NodeJS.Timeout>();

async function runDestroy(conn: Destroyable): Promise<void> {
  try {
    await conn.destroy();
  } catch (e) {
    logger.error({ error: e, details: 'Error destroying connection' });
  }
}

/** Destroy `conn` once the grace period (NC_CONNECTION_DESTROY_GRACE_MS) ends. */
export function scheduleConnectionDestroy(conn?: Destroyable | null): void {
  if (!conn || pending.has(conn)) return;

  const ms = graceMs();
  if (ms === 0) {
    void runDestroy(conn);
    return;
  }

  const timer = setTimeout(() => {
    pending.delete(conn);
    void runDestroy(conn);
  }, ms);
  timer.unref?.();
  pending.set(conn, timer);
}

/** Destroy every scheduled connection now: shutdown and tests. */
export async function flushConnectionDestroys(): Promise<void> {
  const conns = [...pending.entries()];
  pending.clear();
  await Promise.all(
    conns.map(([conn, timer]) => {
      clearTimeout(timer);
      return runDestroy(conn);
    }),
  );
}

export function pendingConnectionDestroyCount(): number {
  return pending.size;
}
