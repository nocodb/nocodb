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
 *
 * Deliberately out: oAuthAuthCode (single-use, setExpiring only),
 * usageStats/storageStats/sqlExecutor (runtime counters), templates (external
 * API cache).
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
  'appToken',
  'oAuthToken',
  'ssoClient',
  'ssoClientPublicList',
  'store',
  // Count aggregate over meta rows, like resourceStats.
  'instanceMeta',
  'installation',
  'installationAlias',
  'gcpMarketplaceAccount',
  'gcpMarketplaceAccountAlias',
  'gcpMarketplaceEntitlement',
  'gcpMarketplaceEntitlementAlias',
  'managedAppDeploymentLog',
  'factoryRepo',
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
  'baseSchema',
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
// back after the replay (or the first invalidation).
const SECOND_INVALIDATION_MS = +(
  process.env.NC_TRX_CACHE_SECOND_INVALIDATION_MS || 2000
);

// Replay only updates keys that are still cached: an absent key may have been
// invalidated by another writer since the transaction read it, and a miss is
// always safe. A newer value (by `"timestamp":<ms>}`, CacheMgr.prepareValue)
// wins and the key is dropped.
const REPLAY_SET_SCRIPT = `
local cur = redis.call('GET', KEYS[1])
if not cur then return 0 end
local ts = string.match(cur, '"timestamp":(%d+)}$')
if ts and tonumber(ts) > tonumber(ARGV[2]) then
  redis.call('DEL', KEYS[1])
  return 0
end
local unpackFn = table.unpack or unpack
redis.call('SET', KEYS[1], ARGV[1], unpackFn(ARGV, 3))
return 1`;

// List delta: ARGV = nAdd, adds..., nRem, rems..., expire|''. A list that is
// gone stays gone (SADD would create a partial list readers trust as whole).
// Touches only KEYS[1]; whether new members are cached is checked beforehand.
const REPLAY_LIST_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local i = 1
local nAdd = tonumber(ARGV[i])
-- An empty-list sentinel plus a member would read as empty: drop instead.
if nAdd > 0 and redis.call('SISMEMBER', KEYS[1], 'NONE') == 1 then
  redis.call('DEL', KEYS[1])
  return -1
end
for j = 1, nAdd do redis.call('SADD', KEYS[1], ARGV[i + j]) end
i = i + nAdd + 1
local nRem = tonumber(ARGV[i])
for j = 1, nRem do redis.call('SREM', KEYS[1], ARGV[i + j]) end
i = i + nRem + 1
if ARGV[i] and ARGV[i] ~= '' then redis.call('EXPIRE', KEYS[1], ARGV[i]) end
return 1`;

// Hash delta: ARGV = nSet, f, v..., nDel, f..., nIncr, f, by..., expire|''.
// Skipped when the hash is gone, so it is never recreated with partial fields.
const REPLAY_HASH_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then return 0 end
local i = 1
local nSet = tonumber(ARGV[i])
for j = 0, nSet - 1 do
  redis.call('HSET', KEYS[1], ARGV[i + 1 + 2 * j], ARGV[i + 2 + 2 * j])
end
i = i + 2 * nSet + 1
local nDel = tonumber(ARGV[i])
for j = 1, nDel do redis.call('HDEL', KEYS[1], ARGV[i + j]) end
i = i + nDel + 1
local nIncr = tonumber(ARGV[i])
for j = 0, nIncr - 1 do
  redis.call('HINCRBY', KEYS[1], ARGV[i + 1 + 2 * j], ARGV[i + 2 + 2 * j])
end
i = i + 2 * nIncr + 1
if ARGV[i] and ARGV[i] ~= '' then redis.call('EXPIRE', KEYS[1], ARGV[i]) end
return 1`;

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
  'appToken',
  'oAuthToken',
  'ssoClient',
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

type WriteCmd =
  | 'set'
  | 'del'
  | 'sadd'
  | 'srem'
  | 'hset'
  | 'hdel'
  | 'hincrby'
  | 'expire';
type LoggedWrite = [cmd: WriteCmd, key: string, args: string[]];

/** A key's net effect after folding the transaction's writes in order. */
interface KeyPlan {
  del: boolean;
  set?: string[];
  sadd: Set<string>;
  srem: Set<string>;
  hset: Map<string, string>;
  hdel: Set<string>;
  hincr: Map<string, number>;
  expire?: string[];
}

export type TrxOutcome = 'commit' | 'rollback';

interface QueuedEffect {
  fn: () => unknown;
  onRollback: 'drop' | 'run';
}

interface Invalidator {
  prefix: string;
  raw: IORedis;
  delKeys(keys: string[]): Promise<void>;
  delPattern(pattern: string): Promise<void>;
  fenceKeys(keys: string[], ttlSeconds: number): Promise<void>;
}

let invalidator: Invalidator | null = null;

/** Wired by NocoCache.init — the scope never touches Redis directly. */
export function registerTrxScopeInvalidator(inv: Invalidator) {
  invalidator = inv;
  // EVALSHA with automatic fallback, instead of shipping each script per key.
  if (typeof Reflect.get(inv.raw, 'ncReplaySet') !== 'function') {
    inv.raw.defineCommand('ncReplaySet', {
      numberOfKeys: 1,
      lua: REPLAY_SET_SCRIPT,
    });
    inv.raw.defineCommand('ncReplayList', {
      numberOfKeys: 1,
      lua: REPLAY_LIST_SCRIPT,
    });
    inv.raw.defineCommand('ncReplayHash', {
      numberOfKeys: 1,
      lua: REPLAY_HASH_SCRIPT,
    });
  }
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
  private writes: LoggedWrite[] = [];
  // Fenced-scope keys whose existing value this transaction changed; plain
  // cache fills stay out so a cold read doesn't fence a hot user key.
  private readonly changed = new Set<string>();
  private readonly fills = new Set<string>();
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
    // The pattern is cleared first on replay; earlier writes it covers are moot.
    this.writes = this.writes.filter(([, key]) => !key.startsWith(base));
  }

  /** Log a meta-key write for replay against Redis at commit. */
  record(cmd: WriteCmd, key: string, args: string[] = []) {
    if (!this.dropped) this.writes.push([cmd, key, args]);
  }

  markChanged(key: string) {
    if (isFencedKey(key)) this.changed.add(key);
  }

  /** Mark a fenced key changed if a write is about to replace a cached value. */
  /** The next write to `key` is a read-through fill: log it, don't fence it. */
  markFill(key: string) {
    this.fills.add(key);
  }

  async markIfCached(real: IORedis, key: string) {
    if (this.fills.delete(key)) return;
    if (!isFencedKey(key) || this.changed.has(key)) return;
    const e = this.peek(key);
    if (e ? e.kind !== 'tomb' : await real.exists(key)) this.changed.add(key);
  }

  /** Mark keys stale (e.g. an independent inner transaction committed them). */
  tombstone(keys: Iterable<string>) {
    const stale = new Set(keys);
    for (const key of stale) this.entries.set(key, TOMB);
    // Drop our earlier writes to them too, or our commit would replay a value
    // older than the inner transaction's; a DEL can only produce a miss.
    this.writes = this.writes.filter(([, key]) => !stale.has(key));
    for (const key of stale) this.record('del', key);
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
      this.writes = [];
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
        // Redis has no empty sets/hashes: an empty read means absent, so keep
        // it absent (a tombstone) rather than an empty entry exists() sees.
        if (kind === 'set') {
          const members = await real.smembers(key);
          entry = members.length ? { kind: 'set', v: new Set(members) } : TOMB;
        } else if (kind === 'hash') {
          const fields = Object.entries(await real.hgetall(key));
          entry = fields.length ? { kind: 'hash', v: new Map(fields) } : TOMB;
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
    const fenced = [...this.changed];
    const patterns = [...this.clearedPatterns];
    const committed = outcome === 'commit';
    const plans = committed && !this.dropped ? planWrites(this.writes) : null;
    // Keys this transaction wrote to (past the limit: everything it touched).
    const written = this.dropped
      ? keys
      : [...new Set(this.writes.map(([, key]) => key))];
    // Async resources created inside the scope keep it reachable through the
    // AsyncLocalStorage store; drop the overlay state so they don't pin it.
    this.entries.clear();
    this.loads.clear();
    this.clearedPatterns.length = 0;
    this.writes = [];
    this.changed.clear();
    this.fills.clear();
    this.trx = null;

    if (!committed) {
      // Redis was never written, but work on another connection (an explicit
      // .knex write, DDL) may have committed with its cache update held here.
      // Drop only the keys this transaction wrote to; a miss is always safe.
      // Cleared prefixes are left alone: the clear never ran, and a prefix
      // sweep would also take non-meta keys (collab state, locks).
      await invalidate(written, []);
      if (written.length) {
        setTimeout(() => {
          invalidate(written, []).catch(() => {});
        }, SECOND_INVALIDATION_MS).unref?.();
      }
    } else {
      // Prefix clears first, so they can't wipe the fences set next.
      await invalidate([], patterns);
      if (fenced.length && invalidator) {
        await invalidator
          .fenceKeys(fenced, FENCE_TTL_SECONDS)
          .catch((e) => logger.error(`Cache fence failed: ${e?.message}`));
      }

      if (plans) {
        // Access-control keys are dropped, never written through: a fill of
        // a row read before another transaction's revoke could carry a newer
        // timestamp than that revoke's cached value.
        for (const key of plans.keys()) {
          if (isFencedKey(key)) plans.set(key, emptyPlan(true));
        }
        await replay(plans);
        if (plans.size) {
          setTimeout(() => {
            verifyReplay(plans).catch(() => {});
          }, SECOND_INVALIDATION_MS).unref?.();
        }
      } else {
        // Past the overlay limit no values were kept to replay.
        await invalidate(keys, []);
        if (keys.length) {
          setTimeout(() => {
            invalidate(keys, []).catch(() => {});
          }, SECOND_INVALIDATION_MS).unref?.();
        }
      }
    }

    if (committed && this.parent?.isOpen) {
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

function emptyPlan(del: boolean): KeyPlan {
  return {
    del,
    sadd: new Set(),
    srem: new Set(),
    hset: new Map(),
    hdel: new Set(),
    hincr: new Map(),
  };
}

function planWrites(writes: LoggedWrite[]): Map<string, KeyPlan> {
  const plans = new Map<string, KeyPlan>();
  const reset = (key: string, del: boolean): KeyPlan => {
    const plan = emptyPlan(del);
    plans.set(key, plan);
    return plan;
  };
  for (const [cmd, key, args] of writes) {
    let plan = plans.get(key) ?? reset(key, false);
    // A set/hash op after a plain SET replaces the key's type.
    if (plan.set && cmd !== 'set' && cmd !== 'del' && cmd !== 'expire') {
      plan = reset(key, true);
    }
    switch (cmd) {
      case 'set':
        reset(key, false).set = args;
        break;
      case 'del':
        reset(key, true);
        break;
      case 'sadd':
        for (const m of args) {
          plan.srem.delete(m);
          plan.sadd.add(m);
        }
        break;
      case 'srem':
        for (const m of args) {
          plan.sadd.delete(m);
          plan.srem.add(m);
        }
        break;
      case 'hset':
        for (let i = 0; i + 1 < args.length; i += 2) {
          plan.hdel.delete(args[i]);
          plan.hincr.delete(args[i]);
          plan.hset.set(args[i], args[i + 1]);
        }
        break;
      case 'hdel':
        for (const f of args) {
          plan.hset.delete(f);
          plan.hincr.delete(f);
          plan.hdel.add(f);
        }
        break;
      case 'hincrby': {
        const [field, by] = args;
        if (plan.hset.has(field)) {
          plan.hset.set(field, String(Number(plan.hset.get(field)) + +by));
        } else {
          plan.hdel.delete(field);
          plan.hincr.set(field, (plan.hincr.get(field) ?? 0) + +by);
        }
        break;
      }
      case 'expire':
        plan.expire = args;
        break;
    }
  }
  for (const [key, plan] of plans) {
    // A list the transaction dropped and rebuilt is replayed as a plain DEL:
    // DEL + SADD would wipe members other requests appended meanwhile.
    if (plan.del && (plan.sadd.size || plan.srem.size)) {
      plan.sadd.clear();
      plan.srem.clear();
      plan.expire = undefined;
    }
    // Counters: a reader may rebuild the hash from the committed DB before
    // replay, so adding the delta again would double-count. Drop instead.
    if (plan.hincr.size) plans.set(key, emptyPlan(true));
  }
  return plans;
}

/** Apply a committed transaction's cache writes to Redis. */
async function replay(plans: Map<string, KeyPlan>) {
  if (!invalidator) return;
  const raw = invalidator.raw;
  try {
    const entries = [...plans];
    // exec resolves with per-command errors instead of rejecting.
    const run = async (
      queue: (
        pipe: ChainableCommander,
        call: (cmd: string, ...args: (string | number)[]) => void,
      ) => void,
    ) => {
      const pipe = raw.pipeline();
      queue(pipe, (cmd, ...args) =>
        Reflect.apply(Reflect.get(pipe, cmd), pipe, args),
      );
      const res = (await pipe.exec()) ?? [];
      const failed = res.find(([err]) => err)?.[0];
      if (failed) throw failed;
      return res.map(([, r]) => r);
    };

    // Pass 1: deletes, values, and which new list members are cached.
    const cached = new Set<string>();
    for (let i = 0; i < entries.length; i += INVALIDATION_BATCH) {
      const batch = entries.slice(i, i + INVALIDATION_BATCH);
      const probes: string[] = [];
      const res = await run((pipe, call) => {
        for (const [key, plan] of batch) if (plan.del) pipe.del(key);
        for (const [key, plan] of batch) {
          if (!plan.set) continue;
          const [value, ...opts] = plan.set;
          const ts = /"timestamp":(\d+)}$/.exec(value)?.[1] ?? '0';
          call('ncReplaySet', key, value, ts, ...opts);
        }
        for (const [, plan] of batch) {
          for (const m of plan.sadd) {
            pipe.exists(m);
            probes.push(m);
          }
        }
      });
      const probed = res.slice(res.length - probes.length);
      probes.forEach((m, j) => probed[j] && cached.add(m));
    }

    // Pass 2: list and hash deltas. A list gaining a member whose value isn't
    // cached is dropped instead of pointing at a missing child.
    for (let i = 0; i < entries.length; i += INVALIDATION_BATCH) {
      const batch = entries.slice(i, i + INVALIDATION_BATCH);
      await run((pipe, call) => {
        for (const [key, plan] of batch) {
          const expire = plan.expire?.[0] ?? '';
          if (plan.sadd.size || plan.srem.size) {
            if ([...plan.sadd].some((m) => !cached.has(m))) {
              pipe.del(key);
            } else {
              call(
                'ncReplayList',
                key,
                plan.sadd.size,
                ...plan.sadd,
                plan.srem.size,
                ...plan.srem,
                expire,
              );
            }
          }
          if (plan.hset.size || plan.hdel.size || plan.hincr.size) {
            call(
              'ncReplayHash',
              key,
              plan.hset.size,
              ...[...plan.hset].flat(),
              plan.hdel.size,
              ...plan.hdel,
              plan.hincr.size,
              ...[...plan.hincr].flat(),
              expire,
            );
          }
        }
      });
    }
  } catch (e) {
    logger.error(`Cache replay after commit failed: ${e?.message}`);
    // A partial replay leaves Redis inconsistent; a miss is always safe.
    await invalidate([...plans.keys()], []);
  }
}

/**
 * A reader that loaded pre-commit rows may cache them after the replay. Drop
 * any replayed key whose value no longer matches what the transaction wrote.
 */
async function verifyReplay(plans: Map<string, KeyPlan>) {
  if (!invalidator) return;
  const raw = invalidator.raw;
  const stale: string[] = [];
  const entries = [...plans];
  for (let i = 0; i < entries.length; i += INVALIDATION_BATCH) {
    const batch = entries.slice(i, i + INVALIDATION_BATCH);
    const pipe = raw.pipeline();
    for (const [key, plan] of batch) {
      if (plan.set) pipe.get(key);
      else if (plan.sadd.size || plan.srem.size) pipe.smembers(key);
      else if (plan.hset.size || plan.hdel.size) pipe.hgetall(key);
      else pipe.exists(key);
    }
    const res = (await pipe.exec()) ?? [];
    batch.forEach(([key, plan], j) => {
      const [err, r] = res[j] ?? [null, null];
      if (err) return stale.push(key);
      if (plan.set) {
        if (r !== plan.set[0]) stale.push(key);
      } else if (plan.sadd.size || plan.srem.size) {
        const members = new Set(r as string[]);
        const drifted =
          [...plan.sadd].some((m) => !members.has(m)) ||
          [...plan.srem].some((m) => members.has(m)) ||
          (plan.del && members.size > plan.sadd.size);
        if (drifted) stale.push(key);
      } else if (plan.hset.size || plan.hdel.size) {
        const hash = r as Record<string, string>;
        const drifted =
          [...plan.hset].some(([f, v]) => hash[f] !== v) ||
          [...plan.hdel].some((f) => f in hash);
        if (drifted) stale.push(key);
      } else if (plan.del && r) {
        stale.push(key);
      }
    });
  }
  await invalidate(stale, []);
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
      await scope.markIfCached(real, key);
      scope.put(key, { kind: 'str', v: String(value) });
      scope.record('set', key, [String(value), ...flatten(rest)]);
      return 'OK';
    },

    async del(...args: unknown[]) {
      const keys = flatten(args);
      const passthrough = keys.filter((k) => !meta(k));
      for (const k of keys) {
        if (!meta(k)) continue;
        // A DEL is never a read-through fill: fence it even if the key is cold,
        // or a reader that loaded the old row before commit can write it back.
        scope.markChanged(k);
        scope.put(k, TOMB);
        scope.record('del', k);
      }
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
      await scope.markIfCached(real, key);
      await scope.load(real, key, 'set');
      const e = scope.peek(key);
      const set = e?.kind === 'set' ? e.v : new Set<string>();
      // Only new members: re-adding ones already held would resurrect members
      // another request removed since the set was copied in.
      const added: string[] = [];
      for (const m of flatten(args)) {
        if (!set.has(m)) {
          set.add(m);
          added.push(m);
        }
      }
      scope.put(key, { kind: 'set', v: set });
      if (added.length) scope.record('sadd', key, added);
      return added.length;
    },

    async srem(key: string, ...args: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.srem, real, [key, ...args]);
      await scope.markIfCached(real, key);
      await scope.load(real, key, 'set');
      const e = scope.peek(key);
      if (e?.kind !== 'set') return 0;
      const members = flatten(args);
      let removed = 0;
      for (const m of members) if (e.v.delete(m)) removed++;
      scope.record('srem', key, members);
      return removed;
    },

    async expire(key: string, ...rest: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.expire, real, [key, ...rest]);
      if (scope.peek(key)?.kind === 'tomb') return 0;
      scope.record('expire', key, flatten(rest));
      return 1;
    },

    async hset(key: string, ...args: unknown[]) {
      if (!meta(key)) return Reflect.apply(real.hset, real, [key, ...args]);
      await scope.markIfCached(real, key);
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
      scope.record('hset', key, pairs.flat());
      return added;
    },

    async hincrby(key: string, field: string, by: number | string) {
      if (!meta(key)) return real.hincrby(key, field, by);
      await scope.markIfCached(real, key);
      await scope.load(real, key, 'hash');
      const e = scope.peek(key);
      const hash = e?.kind === 'hash' ? e.v : new Map<string, string>();
      const next = Number(hash.get(field) ?? 0) + Number(by);
      hash.set(field, String(next));
      scope.put(key, { kind: 'hash', v: hash });
      scope.record('hincrby', key, [field, String(by)]);
      return next;
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
      await scope.markIfCached(real, key);
      await scope.load(real, key, 'hash');
      const e = scope.peek(key);
      if (e?.kind !== 'hash') return 0;
      const names = flatten(fields);
      let removed = 0;
      for (const f of names) if (e.v.delete(f)) removed++;
      scope.record('hdel', key, names);
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
