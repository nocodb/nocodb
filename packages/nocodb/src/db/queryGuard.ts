import { AsyncLocalStorage } from 'node:async_hooks';
import type { SearchState } from 'nocodb-sdk';
import type { Knex } from 'knex';
import { NcError } from '~/helpers/catchError';
import { searchEnvInt } from '~/db/search/searchEnv';

/**
 * Limits on the SQL a request may run. Scoped per async chain, like
 * `cacheBypassScope.ts`, so the data layer enforces them without every
 * caller threading options through. Enforced for internal Postgres only.
 */
export interface QueryGuard {
  /** Aborted once nobody wants the result (the client disconnected). */
  signal?: AbortSignal;
  /** Server-side cap per statement, via `SET LOCAL statement_timeout`. */
  statementTimeoutMs?: number;
  /** User-facing message when the statement timeout fires. */
  timeoutMessage?: string;
  /** Set for an all-fields search request; `search` args are ignored without it. */
  search?: boolean;
  /**
   * Apply `searchPlanSettings()` to this request's reads that carry
   * `SEARCH_PLAN_MARK`. Off for base record search: it re-checks only a
   * few ids per table, so the settings only cost it.
   */
  planSettings?: boolean;
  /** Why the search returned no or possibly incomplete rows; reported in `pageInfo`. */
  searchState?: SearchState;
  /** Search index probes, run once per request for each table and term. */
  searchProbes?: Map<
    string,
    Promise<{ matched?: string[]; behind?: string[]; hashed?: boolean }>
  >;
  /** Rows behind the index matched live, once per request for each table and term. */
  searchBehindLive?: Map<
    string,
    Promise<(qb: Knex.QueryBuilder, alias?: string) => void>
  >;
}

/** Thrown when the guard's signal aborts a query; nobody is left to answer. */
export class QueryAbortedError extends Error {
  /** Transient to `isTransientError`, so the formula retry never stores it as a formula error. */
  readonly code = 'ECONNABORTED';

  constructor() {
    super('Query aborted: the client closed the request');
    this.name = 'QueryAbortedError';
  }
}

const PG_QUERY_CANCELED = '57014';

// knex opens a raw connection outside the pool per cancel, so cap them; a
// skipped cancel leaves the query to its statement timeout.
export const MAX_CONCURRENT_CANCELS = 4;
const CANCEL_WAIT_MS = 2000;
let activeCancels = 0;

/**
 * `pg_cancel_backend(pid)` on a raw connection. The pid comes from
 * `pg_backend_pid()`: behind a pooler (PgBouncer, Neon's `-pooler`) the
 * connection's own `processID` is the pooler's key, not a backend.
 */
function cancelBackend(client: Knex['client'], pid: number) {
  if (activeCancels >= MAX_CONCURRENT_CANCELS) return undefined;
  activeCancels++;
  return client
    .cancelQuery({ processID: pid })
    .catch(() => {})
    .finally(() => activeCancels--);
}

type PgResult = { rows?: Record<string, any>[] };

/** Rows of the last statement in a multi-statement `raw`. */
const lastRows = (result: PgResult | PgResult[]) =>
  (Array.isArray(result) ? result[result.length - 1] : result)?.rows;

/** Whether `cancelling` settled within `ms`. */
async function settlesWithin(cancelling: Promise<unknown>, ms: number) {
  let timer: NodeJS.Timeout;
  const timedOut = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  try {
    return await Promise.race([cancelling.then(() => true), timedOut]);
  } finally {
    clearTimeout(timer);
  }
}

const scope = new AsyncLocalStorage<QueryGuard>();

export const getQueryGuard = (): QueryGuard | undefined => scope.getStore();

/** Run `fn` under `guard`, tightened by any guard already in scope. */
export const runWithQueryGuard = <T>(guard: QueryGuard, fn: () => T): T =>
  scope.run(mergeGuards(scope.getStore(), guard), fn);

function mergeGuards(outer: QueryGuard | undefined, inner: QueryGuard) {
  if (!outer) return inner;

  const signals = [outer.signal, inner.signal].filter(
    (s): s is AbortSignal => !!s,
  );
  const timeouts = [outer.statementTimeoutMs, inner.statementTimeoutMs].filter(
    (t) => t > 0,
  );

  return {
    signal: signals.length > 1 ? AbortSignal.any(signals) : signals[0],
    statementTimeoutMs: timeouts.length ? Math.min(...timeouts) : undefined,
    timeoutMessage: inner.timeoutMessage ?? outer.timeoutMessage,
    search: inner.search || outer.search,
  };
}

const READ_QUERY_REGEX = /^\s*\(?\s*(select|with)\b/i;

/** The guard covers reads only: a cancelled write would need its own story. */
export function shouldGuardQuery(
  guard: QueryGuard | undefined,
  query: string,
): guard is QueryGuard {
  return (
    !!guard &&
    (!!guard.signal || guard.statementTimeoutMs > 0) &&
    READ_QUERY_REGEX.test(query)
  );
}

const WORK_MEM_REGEX = /^\d+(kB|MB|GB)$/;

/**
 * Marks a search clause matched through an id set: only reads carrying it get
 * `searchPlanSettings()`, not the request's other reads.
 */
export const SEARCH_PLAN_MARK = '/* nc_search_plan */';

/**
 * A listed match set gets the planner settings only past this many ids;
 * smaller ones plan with Postgres defaults, reading their rows by primary key
 * instead of scanning the table. `NC_SEARCH_PLAN_MIN_IDS` (default 20,000).
 */
export function searchPlanMinIds(): number {
  return searchEnvInt('NC_SEARCH_PLAN_MIN_IDS', 20_000, 0);
}

/**
 * Planner settings for a search's reads. Without nested loops, a small LIMIT
 * can't walk the sort index probing the matched ids row by row; the extra
 * work_mem keeps those id sets hashed instead of scanned per row. JIT off:
 * nested loops a plan can't avoid (LATERAL) still cost `disable_cost`, which
 * makes Postgres compile the whole query, seconds for a wide one.
 * `NC_SEARCH_PLAN_SETTINGS=false` turns them off; `NC_SEARCH_WORK_MEM` sets
 * the memory (default 16MB).
 */
export function searchPlanSettings(): string[] {
  if (process.env.NC_SEARCH_PLAN_SETTINGS === 'false') return [];
  const workMem = searchWorkMem();
  return [
    'SET LOCAL enable_nestloop = off',
    'SET LOCAL jit = off',
    ...(workMem ? [`SET LOCAL work_mem = '${workMem}'`] : []),
  ];
}

/** The `work_mem` search reads set, if valid; undefined when they set none. */
function searchWorkMem(): string | undefined {
  if (process.env.NC_SEARCH_PLAN_SETTINGS === 'false') return undefined;
  const workMem = process.env.NC_SEARCH_WORK_MEM ?? '16MB';
  return WORK_MEM_REGEX.test(workMem) ? workMem : undefined;
}

const UNIT_BYTES = { kB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 } as const;

/** `searchWorkMem()` in bytes. */
export function searchWorkMemBytes(): number | undefined {
  const match = searchWorkMem()?.match(WORK_MEM_REGEX);
  return match
    ? Number(match[0].slice(0, -match[1].length)) * UNIT_BYTES[match[1]]
    : undefined;
}

/**
 * Run a fully rendered SELECT on its own pooled connection under `guard`:
 * the statement timeout lives in a transaction (`SET LOCAL`, so it never
 * leaks to the pool or through a transaction-mode pooler), and an abort
 * cancels the backend through knex, which uses a connection outside the pool.
 * With a signal the read always runs in a transaction: a transaction-mode
 * pooler keeps the backend, and so its pid, ours only until it ends.
 */
export async function execPgWithGuard(
  knex: Knex,
  query: string,
  guard: QueryGuard,
  bindings?: readonly Knex.RawBinding[],
  /** `SET LOCAL` statements for this query only, e.g. planner settings. */
  localSettings: readonly string[] = [],
): Promise<Record<string, any>[]> {
  const { signal } = guard;
  const timeoutMs = Math.floor(guard.statementTimeoutMs ?? 0);
  const client = knex.client;

  if (signal?.aborted) throw new QueryAbortedError();

  const connection = await acquireConnection(client, signal);

  let pid: number | undefined;
  let cancelling: Promise<unknown> | undefined;
  const onAbort = () => {
    if (pid) cancelling = cancelBackend(client, pid);
  };
  let inTransaction = false;

  /**
   * End the transaction once any cancel has landed: after it, a pooler may
   * hand the backend to another client, whose query a late cancel would stop.
   * A cancel still pending drops the connection instead, which ends it too.
   */
  const endTransaction = async (statement: 'COMMIT' | 'ROLLBACK') => {
    if (!inTransaction) return;
    inTransaction = false;
    signal?.removeEventListener('abort', onAbort);
    if (cancelling && !(await settlesWithin(cancelling, CANCEL_WAIT_MS))) {
      connection.__knex__disposed = new Error('Query cancel still pending');
      return;
    }
    await knex.raw(statement).connection(connection);
  };

  try {
    const settings = [
      ...(timeoutMs > 0 ? [`SET LOCAL statement_timeout = ${timeoutMs}`] : []),
      ...localSettings,
      ...(guard.search && guard.planSettings && query.includes(SEARCH_PLAN_MARK)
        ? searchPlanSettings()
        : []),
    ];
    if (settings.length || signal) {
      inTransaction = true;
      const begun = await knex
        .raw(
          [
            'BEGIN',
            ...settings,
            ...(signal ? ['SELECT pg_backend_pid() AS pid'] : []),
          ].join('; '),
        )
        .connection(connection);
      if (signal) pid = lastRows(begun)?.[0]?.pid;
    }

    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) throw new QueryAbortedError();

    const result = await (bindings
      ? knex.raw(query, bindings)
      : knex.raw(query)
    ).connection(connection);

    await endTransaction('COMMIT');

    return result?.rows;
  } catch (e) {
    await endTransaction('ROLLBACK').catch((rollbackError) => {
      connection.__knex__disposed = rollbackError;
    });

    if (signal?.aborted) throw new QueryAbortedError();

    if (e?.code === PG_QUERY_CANCELED && timeoutMs > 0) {
      NcError.get().externalTimeOut(
        guard.timeoutMessage ??
          'This query took too long. Narrow the filters or search and try again.',
      );
    }

    throw e;
  } finally {
    signal?.removeEventListener('abort', onAbort);
    await client.releaseConnection(connection);
  }
}

/** Pool acquire that stops waiting once `signal` aborts. */
async function acquireConnection(client: Knex.Client, signal?: AbortSignal) {
  const acquiring = client.acquireConnection();

  if (!signal) return acquiring;

  let onAbort: () => void;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new QueryAbortedError());
    signal.addEventListener('abort', onAbort, { once: true });
  });

  try {
    return await Promise.race([acquiring, aborted]);
  } catch (e) {
    acquiring
      .then((connection) => client.releaseConnection(connection))
      .catch(() => {});
    throw e;
  } finally {
    signal.removeEventListener('abort', onAbort);
  }
}
