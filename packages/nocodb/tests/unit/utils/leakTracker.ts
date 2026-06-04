/**
 * Knex transaction & connection-pool leak tracker for tests.
 *
 * Patches Knex at module level to record every transaction and pool
 * created during a test, then asserts they were closed before the
 * test completed. Catches the leak classes from PR #8883's postmortem:
 *
 *   - Pre-commit trx leak: async throw between transaction() and try {}.
 *   - Post-commit trx leak: throw after commit() inside try {} that
 *     re-triggers rollback() on a completed trx.
 *   - Orphan pool leak: knex({...}) constructed but never destroyed.
 *
 * Opt out with LEAK_TRACK=0.
 */
import KnexClient from 'knex/lib/client';
import KnexTransaction from 'knex/lib/execution/transaction';

export interface LeakRecord {
  id: string;
  stack: string;
  createdAt: number;
  meta?: Record<string, unknown>;
}

export interface LeakSnapshot {
  trxIds: Set<string>;
  poolIds: Set<string>;
}

export interface LeakReport {
  trxs: LeakRecord[];
  pools: LeakRecord[];
}

const openTrxs = new Map<string, LeakRecord>();
const openPools = new Map<string, LeakRecord>();
const trxIds = new WeakMap<object, string>();

let trxCounter = 0;
let poolCounter = 0;
let installed = false;

const DIALECTS = [
  'mysql2',
  'mysql',
  'postgres',
  'sqlite3',
  'better-sqlite3',
  'mssql',
  'oracle',
  'oracledb',
  'redshift',
  'cockroachdb',
  'pgnative',
];

export function installLeakTracker(): void {
  if (installed) return;
  if (process.env.LEAK_TRACK === '0') {
    installed = true;
    return;
  }
  installed = true;

  patchClientTransactionMethod(KnexClient);
  for (const dialect of DIALECTS) {
    let mod: any;
    try {
      mod = require(`knex/lib/dialects/${dialect}`);
    } catch {
      continue;
    }
    if (mod && typeof mod === 'function' && mod.prototype) {
      patchClientTransactionMethod(mod);
    } else if (
      mod &&
      mod.default &&
      typeof mod.default === 'function' &&
      mod.default.prototype
    ) {
      // ESM-interop: actual class on .default
      patchClientTransactionMethod(mod.default);
    }
  }

  patchTransactionLifecycle(KnexTransaction.prototype);
  // Transaction_MSSQL / Transaction_Oracledb override commit/rollback as
  // their own methods, so the base-prototype patch above doesn't reach them.
  for (const dialect of DIALECTS) {
    let mod: any;
    try {
      mod = require(`knex/lib/dialects/${dialect}/transaction`);
    } catch {
      continue;
    }
    const TrxClass = mod && (mod.default ?? mod);
    if (TrxClass && typeof TrxClass === 'function' && TrxClass.prototype) {
      patchTransactionLifecycle(TrxClass.prototype);
    }
  }
  patchPoolLifecycle();
}

function patchClientTransactionMethod(ClientClass: any): void {
  const proto = ClientClass.prototype;
  if (!proto) return;
  // hasOwnProperty: dialect Client subclasses inherit from base Client, so we
  // need to check the marker on the OWN prototype only — otherwise a dialect
  // that inherits the patched base would be treated as already patched and
  // its own override of transaction() would never be wrapped.
  if (Object.prototype.hasOwnProperty.call(proto, '__leakPatched')) return;
  if (typeof proto.transaction !== 'function') return;
  // Only patch if transaction is OWN to this class — otherwise the dialect
  // doesn't override the base, and our base patch already covers it.
  if (!Object.prototype.hasOwnProperty.call(proto, 'transaction') &&
      ClientClass !== KnexClient) {
    return;
  }

  const original = proto.transaction;
  proto.transaction = function patchedTransaction(
    container: unknown,
    config: unknown,
    outerTx: unknown,
  ) {
    const stack = captureStack();
    const trx = original.call(this, container, config, outerTx);
    if (trx && typeof trx === 'object') {
      const id = nextTrxId();
      trxIds.set(trx, id);
      openTrxs.set(id, { id, stack, createdAt: Date.now() });
    }
    return trx;
  };
  proto.__leakPatched = true;
}

function patchTransactionLifecycle(proto: any): void {
  if (!proto) return;
  // Own-only check — subclass prototypes inherit the marker otherwise.
  if (Object.prototype.hasOwnProperty.call(proto, '__leakLifecyclePatched')) {
    return;
  }

  // commit/rollback are top-level trx terminators; release/rollbackTo are
  // savepoint terminators (nested transactions). Patch all four.
  //
  // We deregister SYNCHRONOUSLY on call rather than on Promise resolution.
  // Reason: when `await knex.batchInsert(...)` (or any callback-style trx)
  // rejects, the user's await resumes via `executionPromise`'s rejection,
  // which is signalled in the same callback that resolves the rollback's
  // own promise. The user's `it()` body can return before the rollback
  // promise's `.finally()` runs as a microtask — at which point the test's
  // afterEach fires, observes the not-yet-deregistered trx, and false-flags
  // a leak. Deregistering at call time avoids the race; the contract is
  // "user attempted to terminate" rather than "SQL has flushed".
  for (const method of ['commit', 'rollback', 'release', 'rollbackTo']) {
    if (!Object.prototype.hasOwnProperty.call(proto, method)) continue;
    const orig = proto[method];
    if (typeof orig !== 'function') continue;
    proto[method] = function patchedTrxTerminator(...args: unknown[]) {
      const id = trxIds.get(this);
      if (id) openTrxs.delete(id);
      return orig.apply(this, args);
    };
  }

  proto.__leakLifecyclePatched = true;
}

function patchPoolLifecycle(): void {
  const proto = KnexClient.prototype;
  if (proto.__leakPoolPatched) return;

  const origInit = proto.initializePool;
  proto.initializePool = function patchedInitializePool(config?: unknown) {
    const result = origInit.apply(this, arguments as any);
    if (this.pool && !this.__leakPoolId) {
      const id = nextPoolId();
      this.__leakPoolId = id;
      openPools.set(id, {
        id,
        stack: captureStack(),
        createdAt: Date.now(),
        meta: {
          client: this.config?.client,
          database: this.config?.connection?.database,
        },
      });
    }
    return result;
  };

  const origDestroy = proto.destroy;
  proto.destroy = function patchedDestroy(callback?: unknown) {
    const id = this.__leakPoolId;
    const result = origDestroy.apply(this, arguments as any);
    return Promise.resolve(result).finally(() => {
      if (id) {
        openPools.delete(id);
        this.__leakPoolId = undefined;
      }
    });
  };

  proto.__leakPoolPatched = true;
}

function captureStack(): string {
  const err = { stack: '' };
  Error.captureStackTrace?.(err, captureStack);
  return err.stack || new Error().stack || '';
}

function nextTrxId(): string {
  return `trx_${++trxCounter}`;
}

function nextPoolId(): string {
  return `pool_${++poolCounter}`;
}

export function snapshot(): LeakSnapshot {
  return {
    trxIds: new Set(openTrxs.keys()),
    poolIds: new Set(openPools.keys()),
  };
}

export function diff(s: LeakSnapshot): LeakReport {
  return {
    trxs: [...openTrxs.values()].filter((r) => !s.trxIds.has(r.id)),
    pools: [...openPools.values()].filter((r) => !s.poolIds.has(r.id)),
  };
}

export function getOpenTrxCount(): number {
  return openTrxs.size;
}

export function getOpenPoolCount(): number {
  return openPools.size;
}

export function isInstalled(): boolean {
  return installed && process.env.LEAK_TRACK !== '0';
}

export function shortStack(stack: string, depth = 6): string {
  return stack
    .split('\n')
    .slice(1, 1 + depth)
    .map((l) => l.trim())
    .join('\n  ');
}

export function formatLeakReport(report: LeakReport): string {
  if (!report.trxs.length && !report.pools.length) return '';
  const lines: string[] = [];
  if (report.trxs.length) {
    lines.push(`leaked ${report.trxs.length} transaction(s):`);
    for (const t of report.trxs.slice(0, 3)) {
      lines.push(`  trx @ ${shortStack(t.stack, 4)}`);
    }
    if (report.trxs.length > 3) {
      lines.push(`  ...and ${report.trxs.length - 3} more`);
    }
  }
  if (report.pools.length) {
    lines.push(`leaked ${report.pools.length} connection pool(s):`);
    for (const p of report.pools.slice(0, 3)) {
      const tag = p.meta?.client ? ` [${p.meta.client}]` : '';
      lines.push(`  pool${tag} @ ${shortStack(p.stack, 4)}`);
    }
    if (report.pools.length > 3) {
      lines.push(`  ...and ${report.pools.length - 3} more`);
    }
  }
  return lines.join('\n');
}
