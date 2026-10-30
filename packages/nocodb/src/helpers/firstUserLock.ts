import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from '@nestjs/common';
import type { Knex } from 'knex';
import type { MetaService } from '~/meta/meta.service';
import { NcError } from '~/helpers/catchError';
import { User } from '~/models';
import Noco from '~/Noco';

const LOCK_KEY = 'nc_first_user';
const LOCK_TIMEOUT_SECONDS = 60;
// Postgres SQLSTATE for lock_not_available (lock_timeout hit).
const PG_LOCK_NOT_AVAILABLE = '55P03';

const logger = new Logger('firstUserLock');
let warnedSmallPool = false;

const lockHeld = new AsyncLocalStorage<true>();
let localQueue: Promise<void> = Promise.resolve();

// In-process queue; a waiter gives up after `timeoutSeconds` with the same 429 as the DB lock.
export async function withLocalMutex<T>(
  fn: () => Promise<T>,
  { timeoutSeconds = LOCK_TIMEOUT_SECONDS }: { timeoutSeconds?: number } = {},
): Promise<T> {
  const previous = localQueue;
  let release: () => void;
  localQueue = new Promise<void>((resolve) => (release = resolve));

  let timer: NodeJS.Timeout;
  const timedOut = await Promise.race([
    previous.then(() => false),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(true), timeoutSeconds * 1000);
      timer.unref?.();
    }),
  ]);
  clearTimeout(timer);

  if (timedOut) {
    // Free our slot only after the one ahead, so later waiters still wait for the holder.
    void previous.then(release);
    NcError.get().tooManyRequests('Signup is busy, please try again');
  }

  try {
    return await fn();
  } finally {
    release();
  }
}

// Cross-process lock on a dedicated connection; `fn` keeps using its own.
export async function withDbLock<T>(
  knex: Knex,
  fn: () => Promise<T>,
  { timeoutSeconds = LOCK_TIMEOUT_SECONDS }: { timeoutSeconds?: number } = {},
): Promise<T> {
  const client = knex.client.config.client;
  if (client !== 'pg' && client !== 'mysql' && client !== 'mysql2') {
    // SQLite is single-process: the local mutex is enough.
    return fn();
  }

  // The lock holds one pooled connection while `fn` needs another; a pool of one is a single pod in practice.
  if ((knex.client.pool?.max ?? knex.client.config.pool?.max ?? 2) < 2) {
    if (!warnedSmallPool) {
      warnedSmallPool = true;
      logger.warn(
        'Meta database pool has 1 connection: first-user signup is serialised in this process only. Raise NC_DB_POOL_MAX to 2+ when running several instances.',
      );
    }
    return fn();
  }

  if (client === 'pg') {
    return knex.transaction(async (trx) => {
      // Transaction-local, like MySQL's GET_LOCK timeout: a hung holder must not queue every signup.
      await trx.raw("select set_config('lock_timeout', ?, true)", [
        `${timeoutSeconds}s`,
      ]);
      try {
        await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [LOCK_KEY]);
      } catch (e) {
        if (e?.code === PG_LOCK_NOT_AVAILABLE) {
          NcError.get().tooManyRequests('Signup is busy, please try again');
        }
        throw e;
      }
      return fn();
    });
  }

  return knex.transaction(async (trx) => {
    const [rows] = await trx.raw('select get_lock(?, ?) as locked', [
      LOCK_KEY,
      timeoutSeconds,
    ]);
    if (!rows?.[0]?.locked) {
      NcError.get().tooManyRequests('Signup is busy, please try again');
    }
    try {
      return await fn();
    } finally {
      await trx.raw('select release_lock(?)', [LOCK_KEY]);
    }
  });
}

// Decides "first user" under a lock held until `fn` settles; re-entrant.
export async function withFirstUserLock<T>(
  fn: (isFirstUser: boolean) => Promise<T>,
  ncMeta: MetaService = Noco.ncMeta,
  { timeoutSeconds = LOCK_TIMEOUT_SECONDS }: { timeoutSeconds?: number } = {},
): Promise<T> {
  if (lockHeld.getStore()) {
    return fn(await User.isFirst(ncMeta));
  }

  // One deadline for both waits; the DB lock gets what is left, in whole seconds (0 would mean no limit on pg).
  const deadline = Date.now() + timeoutSeconds * 1000;
  return lockHeld.run(true, () =>
    withLocalMutex(
      () =>
        withDbLock(
          ncMeta.knexInstance,
          async () => fn(await User.isFirst(ncMeta)),
          {
            timeoutSeconds: Math.max(
              1,
              Math.ceil((deadline - Date.now()) / 1000),
            ),
          },
        ),
      { timeoutSeconds },
    ),
  );
}
