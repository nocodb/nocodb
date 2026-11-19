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
let warnedMssql = false;

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
    if (client === 'mssql' && !warnedMssql) {
      warnedMssql = true;
      logger.warn(
        'MSSQL meta database: first-user signup is serialised in this process only. Run a single instance until the first user exists.',
      );
    }
    // SQLite is single-process: the local mutex is enough.
    return fn();
  }

  let connection: unknown;
  try {
    // The lock holds its connection while `fn` needs another: a pool of one
    // cannot spare it, so the lock gets a connection opened beside the pool.
    if ((knex.client.pool?.max ?? knex.client.config.pool?.max ?? 2) < 2) {
      connection = await openLockConnection(knex);
    }
    return await lockedTransaction(
      knex,
      client,
      fn,
      timeoutSeconds,
      connection,
    );
  } finally {
    // A failed close must not turn a committed signup into an error.
    if (connection)
      await knex.client.destroyRawConnection(connection).catch(() => undefined);
  }
}

// Fails closed: without the lock, two signups could both become the first user.
async function openLockConnection(knex: Knex): Promise<unknown> {
  try {
    return await knex.client.acquireRawConnection();
  } catch (e) {
    logger.error(
      `First-user lock could not open its extra meta database connection: ${e?.message}`,
    );
    NcError.get().internalServerError(
      'The first-user lock could not open its extra meta database connection. Free a connection on the meta database or set NC_DB_POOL_MAX to 2 or more.',
    );
  }
}

function lockedTransaction<T>(
  knex: Knex,
  client: string,
  fn: () => Promise<T>,
  timeoutSeconds: number,
  connection?: unknown,
): Promise<T> {
  if (client === 'pg') {
    return knex.transaction(
      async (trx) => {
        // Transaction-local, like MySQL's GET_LOCK timeout: a hung holder must not queue every signup.
        await trx.raw("select set_config('lock_timeout', ?, true)", [
          `${timeoutSeconds}s`,
        ]);
        try {
          await trx.raw('select pg_advisory_xact_lock(hashtext(?))', [
            LOCK_KEY,
          ]);
        } catch (e) {
          if (e?.code === PG_LOCK_NOT_AVAILABLE) {
            NcError.get().tooManyRequests('Signup is busy, please try again');
          }
          throw e;
        }
        return fn();
      },
      { connection },
    );
  }

  return knex.transaction(
    async (trx) => {
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
    },
    { connection },
  );
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
