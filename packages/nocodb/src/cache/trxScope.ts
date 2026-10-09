import { AsyncLocalStorage } from 'node:async_hooks';
import { Logger } from '@nestjs/common';
import type IORedis from 'ioredis';
import type { ChainableCommander } from 'ioredis';

const logger = new Logger('TrxScope');

/**
 * Cache scopes holding meta-DB entities. Only these are held in a transaction's
 * overlay; locks, counters, rate limits, presence, job state and other runtime
 * keys always go straight to Redis. Plain strings so CE compiles without the
 * EE-only CacheScope members.
 */
const META_SCOPES = new Set<string>([
  'base',
  'baseAlias',
  'baseToWorkspace',
  'source',
  'model',
  'modelAlias',
  'modelRoleVisibility',
  'column',
  'colProp',
  'colRelation',
  'colSelectOption',
  'colLookup',
  'colRollup',
  'colFormula',
  'colQRCode',
  'colBarcode',
  'colLongText',
  'colButton',
  'lmtTrackedField',
  'filterExp',
  'sort',
  'sharedView',
  'view',
  'viewAlias',
  'viewSection',
  'formView',
  'formViewColumn',
  'galleryView',
  'galleryViewColumn',
  'gridView',
  'gridViewColumn',
  'kanbanView',
  'kanbanViewColumn',
  'mapView',
  'mapViewColumn',
  'listView',
  'listViewColumn',
  'listViewLevel',
  'calendarView',
  'calendarViewColumn',
  'calendarViewRange',
  'timelineView',
  'timelineViewColumn',
  'timelineViewRange',
  'ganttView',
  'ganttViewColumn',
  'dateDependency',
  'singleQuery_v4',
  'user',
  'team',
  'teamUser',
  'baseUser',
  'workspace',
  'workspaceUser',
  // Derived from meta rows: a pre-commit DEL would let readers re-cache stale counts.
  'resourceStats',
  'org',
  'orgDomain',
  'orgWorkspace',
  'permission',
  'permissionUser',
  'principal',
  'principalAssignment',
  'apiToken',
  'apiTokenScope',
  'mcpToken',
  'hook',
  'plugin',
  'bookmarkGroup',
  'bookmark',
  'uiExtension',
  'baseVariable',
  'baseVariableEnvValue',
  'integration',
  'integrationGlobal',
  'integrationEnvConfig',
  'integrationUserConfig',
  'environment',
  'baseEnvironment',
  'vault',
  'vaultPermission',
  'snapshot',
  'snapshotSchedule',
  'dataReflection',
  'customUrls',
  'scripts',
  'syncConfigs',
  'syncMappings',
  'tableSync',
  'tableSyncMapping',
  'tableSyncColumnMapping',
  'plans',
  'subscriptions',
  'subscriptionsAlias',
  'addons',
  'subscriptionAddons',
  'dbServers',
  'dashboard',
  'widget',
  'interface',
  'interfacePage',
  'oAuthClient',
  'workflow',
  'app',
  'appSlug',
  'appDomain',
  'appVersion',
  'appTeam',
  'appTeamMember',
  'appIntegrationGrant',
  'appConnectionSlot',
  'appAction',
  'appActionVersion',
  'appVersionAction',
  'appActionSurface',
  'appVersionGrant',
  'appVersionPublicRoute',
  'managedApp',
  'managedAppVersion',
  'managedAppTeam',
  'marketplacePublisher',
  'marketplaceCuration',
  'automationSubscriber',
  'automationSection',
  'baseSection',
  'agentSection',
  'scimConfig',
  'recordTemplate',
  'rlsPolicy',
  'document',
  'trash',
  'agent',
  'agentChannel',
  'skill',
  'skillCatalog',
  'skillRegistry',
  'skillPolicy',
]);

// Past this many touched keys the overlay stops holding values and only
// remembers which keys to invalidate (huge base/workspace deletes, duplicates).
const OVERLAY_VALUE_LIMIT = +(process.env.NC_TRX_CACHE_OVERLAY_LIMIT || 20000);

// Catches readers that loaded committed state just before commit and wrote it
// back after the first invalidation.
const SECOND_INVALIDATION_MS = +(
  process.env.NC_TRX_CACHE_SECOND_INVALIDATION_MS || 2000
);

const INVALIDATION_BATCH = 500;

// Access-control state: after a transaction touches these, cache writes to the
// same keys are refused briefly so a reader that loaded the pre-commit row
// can't put it back (e.g. a revoked role).
const FENCED_SCOPES = new Set<string>([
  'user',
  'baseUser',
  'workspaceUser',
  'teamUser',
  'orgWorkspace',
  'permission',
  'permissionUser',
  'principalAssignment',
  'apiToken',
  'apiTokenScope',
  'mcpToken',
]);

const FENCE_TTL_SECONDS = +(process.env.NC_TRX_CACHE_FENCE_TTL || 5);

function scopeOfKey(key: string): string | undefined {
  const prefix = invalidator?.prefix;
  if (!prefix || typeof key !== 'string' || !key.startsWith(`${prefix}:`)) {
    return undefined;
  }
  const parts = key.slice(prefix.length + 1).split(':');
  return parts[0] === 'root' ? parts[1] : parts[2];
}

export const fenceKeyFor = (key: string) => `${key}:__fence`;

export const isFencedKey = (key: string) =>
  FENCED_SCOPES.has(scopeOfKey(key) ?? '');

type Entry =
  | { kind: 'str'; v: string }
  | { kind: 'set'; v: Set<string> }
  | { kind: 'hash'; v: Map<string, string> }
  | { kind: 'tomb' };

const TOMB: Entry = { kind: 'tomb' };

export type TrxOutcome = 'commit' | 'rollback';

interface QueuedEffect {
  fn: () => unknown;
  onRollback: 'drop' | 'run';
}

interface Invalidator {
  prefix: string;
  delKeys(keys: string[]): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  fenceKeys(keys: string[], ttlSeconds: number): Promise<void>;
}

let invalidator: Invalidator | null = null;

/** Wired by NocoCache.init — the scope never touches Redis directly. */
export function registerTrxScopeInvalidator(inv: Invalidator) {
  invalidator = inv;
}

const storage = new AsyncLocalStorage<TrxScope>();

export class TrxScope {
  state: 'open' | 'committed' | 'rolledBack' = 'open';
  aborted = false;
  abortError: unknown;

  private readonly entries = new Map<string, Entry>();
  private readonly loads = new Map<string, Promise<void>>();
  private readonly clearedPatterns: string[] = [];
  private readonly effects: QueuedEffect[] = [];
  private readonly overlays = new WeakMap<IORedis, IORedis>();
  private dropped = false;

  constructor(public trx: unknown, readonly parent?: TrxScope) {}

  get isOpen() {
    return this.state === 'open';
  }

  /** Past OVERLAY_VALUE_LIMIT keys, every meta write is kept as a tombstone. */
  get valuesDropped() {
    return this.dropped;
  }

  markAborted(e?: unknown) {
    this.aborted = true;
    this.abortError ??= e;
  }

  isMetaKey(key: string): boolean {
    return META_SCOPES.has(scopeOfKey(key) ?? '');
  }

  defer(fn: () => unknown, onRollback: 'drop' | 'run') {
    this.effects.push({ fn, onRollback });
  }

  clearPattern(pattern: string) {
    this.clearedPatterns.push(pattern);
    const base = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern;
    for (const key of this.entries.keys()) {
      if (key.startsWith(base)) this.entries.set(key, TOMB);
    }
  }

  /** Mark keys stale (e.g. an independent inner transaction committed them). */
  tombstone(keys: Iterable<string>) {
    for (const key of keys) this.entries.set(key, TOMB);
  }

  overlayFor(real: IORedis): IORedis {
    let overlay = this.overlays.get(real);
    if (!overlay) {
      overlay = createOverlayClient(real, this);
      this.overlays.set(real, overlay);
    }
    return overlay;
  }

  // ── overlay internals ──────────────────────────────────────────

  has(key: string) {
    return this.entries.has(key) || this.isCleared(key);
  }

  peek(key: string): Entry | undefined {
    const e = this.entries.get(key);
    if (e) return e;
    return this.isCleared(key) ? TOMB : undefined;
  }

  put(key: string, entry: Entry) {
    if (this.dropped && entry.kind !== 'tomb') entry = TOMB;
    this.entries.set(key, entry);
    if (!this.dropped && this.entries.size > OVERLAY_VALUE_LIMIT) {
      this.dropped = true;
      for (const k of this.entries.keys()) this.entries.set(k, TOMB);
    }
  }

  /** Copy the Redis value in before the first write, so writes stay additive. */
  async load(real: IORedis, key: string, kind: Entry['kind']) {
    if (this.has(key)) return;
    let pending = this.loads.get(key);
    if (!pending) {
      pending = (async () => {
        let entry: Entry;
        if (kind === 'set') {
          entry = { kind: 'set', v: new Set(await real.smembers(key)) };
        } else if (kind === 'hash') {
          entry = {
            kind: 'hash',
            v: new Map(Object.entries(await real.hgetall(key))),
          };
        } else {
          const v = await real.get(key);
          entry = v === null ? TOMB : { kind: 'str', v };
        }
        if (!this.entries.has(key)) this.put(key, entry);
      })().finally(() => this.loads.delete(key));
      this.loads.set(key, pending);
    }
    await pending;
  }

  private isCleared(key: string) {
    return this.clearedPatterns.some((p) =>
      key.startsWith(p.endsWith('*') ? p.slice(0, -1) : p),
    );
  }

  // ── end of scope ───────────────────────────────────────────────

  async end(outcome: TrxOutcome) {
    if (!this.isOpen) return;
    this.state = outcome === 'commit' ? 'committed' : 'rolledBack';

    const keys = [...this.entries.keys()];
    const patterns = [...this.clearedPatterns];
    // Async resources created inside the scope keep it reachable through the
    // AsyncLocalStorage store; drop the overlay state so they don't pin it.
    this.entries.clear();
    this.loads.clear();
    this.clearedPatterns.length = 0;
    this.trx = null;

    const fenced = keys.filter(isFencedKey);
    if (fenced.length && invalidator) {
      await invalidator
        .fenceKeys(fenced, FENCE_TTL_SECONDS)
        .catch((e) => logger.error(`Cache fence failed: ${e?.message}`));
    }

    // Same-connection work inside the scope may have committed (autocommit
    // calls, DDL) even on rollback, so invalidate on both outcomes.
    await invalidate(keys, patterns);
    if (keys.length || patterns.length) {
      setTimeout(() => {
        invalidate(keys, patterns).catch(() => {});
      }, SECOND_INVALIDATION_MS).unref?.();
    }

    if (this.parent?.isOpen) {
      // The outer scope may hold copies of what this independent transaction
      // just changed.
      this.parent.tombstone(keys);
      for (const p of patterns) this.parent.clearPattern(p);
    }

    const effects = this.effects.splice(0);
    await storage.exit(async () => {
      for (const effect of effects) {
        if (outcome === 'rollback' && effect.onRollback === 'drop') continue;
        try {
          await effect.fn();
        } catch (e) {
          logger.error(`Deferred side effect failed: ${e?.message}`, e?.stack);
        }
      }
    });
  }
}

async function invalidate(keys: string[], patterns: string[]) {
  if (!invalidator) return;
  try {
    for (let i = 0; i < keys.length; i += INVALIDATION_BATCH) {
      await invalidator.delKeys(keys.slice(i, i + INVALIDATION_BATCH));
    }
    for (const p of patterns) await invalidator.delPattern(p);
  } catch (e) {
    logger.error(`Cache invalidation after transaction failed: ${e?.message}`);
  }
}

export function getTrxScope(): TrxScope | undefined {
  return storage.getStore();
}

export function getOpenTrxScope(): TrxScope | undefined {
  const scope = storage.getStore();
  return scope?.isOpen ? scope : undefined;
}

export function runInTrxScope<T>(scope: TrxScope, fn: () => Promise<T>) {
  return storage.run(scope, fn);
}

/** Run `fn` outside any transaction scope, for work that outlives the caller. */
export function exitTrxScope<T>(fn: () => T): T {
  return storage.exit(fn);
}

/**
 * Queue `fn` to run after the enclosing meta transaction commits. Returns
 * false (caller runs it now) outside an open scope. `onRollback: 'run'` is for
 * effects describing writes that are not part of the meta transaction (data DB
 * records), which stand regardless of the meta outcome.
 */
export function deferUntilCommit(
  fn: () => unknown,
  opts: { onRollback?: 'drop' | 'run' } = {},
): boolean {
  const scope = getOpenTrxScope();
  if (!scope) return false;
  scope.defer(fn, opts.onRollback ?? 'drop');
  return true;
}

/** The client CacheMgr should use right now. */
export function activeCacheClient(real: IORedis): IORedis {
  const scope = getOpenTrxScope();
  return scope ? scope.overlayFor(real) : real;
}

// ── overlay client ───────────────────────────────────────────────

function flatten(args: unknown[]): string[] {
  return args.flat().map(String);
}

function createOverlayClient(real: IORedis, scope: TrxScope): IORedis {
  const meta = (key: string) => scope.isMetaKey(key);

  // Pass-throughs forward the caller's arguments untouched; Reflect.apply
  // avoids re-resolving ioredis's overloads against a spread.
  const ops: Record<string, (...args: never[]) => unknown> = {
    async get(key: string) {
      if (!meta(key)) return real.get(key);
      const e = scope.peek(key);
      if (!e) return real.get(key);
      return e.kind === 'str' ? e.v : null;
    },

    async mget(...args: unknown[]) {
      const keys = flatten(args);
      const out: (string | null)[] = new Array(keys.length).fill(null);
      const missing: number[] = [];
      keys.forEach((k, i) => {
        const e = meta(k) ? scope.peek(k) : undefined;
        if (e) out[i] = e.kind === 'str' ? e.v : null;
        else missing.push(i);
      });
      if (missing.length) {
        const vals = await real.mget(missing.map((i) => keys[i]));
        missing.forEach((idx, j) => (out[idx] = vals[j]));
      }
      return out;
    },

    async exists(...args: unknown[]) {
      let n = 0;
      for (const k of flatten(args)) {
        const e = meta(k) ? scope.peek(k) : undefined;
        if (e) n += e.kind === 'tomb' ? 0 : 1;
        else n += await real.exists(k);
      }
      return n;
    },

    async set(key: string, value: unknown, ...rest: unknown[]) {
      if (!meta(key) || rest.some((r) => String(r).toUpperCase() === 'NX')) {
        return Reflect.apply(real.set, real, [key, value, ...rest]);
      }
      scope.put(key, { kind: 'str', v: String(value) });
      return 'OK';
    },

    async del(...args: unknown[]) {
      const keys = flatten(args);
      const passthrough = keys.filter((k) => !meta(k));
      for (const k of keys) if (meta(k)) scope.put(k, TOMB);
      if (passthrough.length) await real.del(passthrough);
      return keys.length;
    },

    async smembers(key: string) {
      if (!meta(key)) return real.smembers(key);
      const e = scope.peek(key);
      if (!e) return real.smembers(key);
      return e.kind === 'set' ? [...e.v] : [];
    },

    async sadd(key: string, ...args: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.sadd, real, [key, ...args]);
      await scope.load(real, key, 'set');
      const e = scope.peek(key);
      const set = e?.kind === 'set' ? e.v : new Set<string>();
      let added = 0;
      for (const m of flatten(args)) {
        if (!set.has(m)) {
          set.add(m);
          added++;
        }
      }
      scope.put(key, { kind: 'set', v: set });
      return added;
    },

    async srem(key: string, ...args: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.srem, real, [key, ...args]);
      await scope.load(real, key, 'set');
      const e = scope.peek(key);
      if (e?.kind !== 'set') return 0;
      let removed = 0;
      for (const m of flatten(args)) if (e.v.delete(m)) removed++;
      return removed;
    },

    async expire(key: string, ...rest: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.expire, real, [key, ...rest]);
      return scope.peek(key)?.kind === 'tomb' ? 0 : 1;
    },

    async hset(key: string, ...args: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.hset, real, [key, ...args]);
      await scope.load(real, key, 'hash');
      const e = scope.peek(key);
      const hash = e?.kind === 'hash' ? e.v : new Map<string, string>();
      const pairs: [string, string][] =
        args.length === 1 && typeof args[0] === 'object' && args[0] !== null
          ? Object.entries(args[0]).map(([f, v]) => [f, String(v)])
          : args.reduce<[string, string][]>((acc, cur, i, arr) => {
              if (i % 2 === 0) acc.push([String(cur), String(arr[i + 1])]);
              return acc;
            }, []);
      let added = 0;
      for (const [f, v] of pairs) {
        if (!hash.has(f)) added++;
        hash.set(f, v);
      }
      scope.put(key, { kind: 'hash', v: hash });
      return added;
    },

    async hget(key: string, field: string) {
      if (!meta(key)) return real.hget(key, field);
      const e = scope.peek(key);
      if (!e) return real.hget(key, field);
      return e.kind === 'hash' ? e.v.get(field) ?? null : null;
    },

    async hgetall(key: string) {
      if (!meta(key)) return real.hgetall(key);
      const e = scope.peek(key);
      if (!e) return real.hgetall(key);
      return e.kind === 'hash' ? Object.fromEntries(e.v) : {};
    },

    async hdel(key: string, ...fields: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.hdel, real, [key, ...fields]);
      await scope.load(real, key, 'hash');
      const e = scope.peek(key);
      if (e?.kind !== 'hash') return 0;
      let removed = 0;
      for (const f of flatten(fields)) if (e.v.delete(f)) removed++;
      return removed;
    },

    pipeline() {
      const queued: [string | symbol, unknown[]][] = [];
      const pipe = new Proxy<ChainableCommander>(Object.create(null), {
        get(_t, prop) {
          if (prop === 'exec') {
            return async (
              cb?: (err: Error | null, res: [Error | null, unknown][]) => void,
            ) => {
              const results: [Error | null, unknown][] = [];
              for (const [name, args] of queued) {
                try {
                  const fn = Reflect.get(overlay, name);
                  results.push([null, await Reflect.apply(fn, overlay, args)]);
                } catch (e) {
                  results.push([e, null]);
                }
              }
              cb?.(null, results);
              return results;
            };
          }
          return (...args: unknown[]) => {
            queued.push([prop, args]);
            return pipe;
          };
        },
      });
      return pipe;
    },
  };

  const overlay = new Proxy<IORedis>(real, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && prop in ops) return ops[prop];
      const v = Reflect.get(target, prop, receiver);
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
  return overlay;
}
