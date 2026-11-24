import { Logger } from '@nestjs/common';
import type {
  MetaType,
  SearchIndexBuildSummary,
  SearchIndexMode,
  TableReqType,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import { Model, Store } from '~/models';
import { NcError } from '~/helpers/catchError';
import { isCloud } from '~/utils/constants';
import {
  SEARCH_INDEX_META_KEYS,
  withoutSearchIndexMeta,
} from '~/db/search/searchIndexKeys';

/** Bump when the side table's layout changes; older indexes are rebuilt. */
export const SEARCH_INDEX_FORMAT = 8;

/**
 * `NC_GLOBAL_SEARCH`, one of:
 * - `off` (or `false`): no search, no index upkeep. Dropping an index still
 *   works. The default, except on Cloud.
 * - `index`: indexes are built and kept fresh; search is hidden and
 *   its APIs return 400. Index operations still work. The default on Cloud.
 * - `on` (or `true`): all-fields grid search and base record search.
 * Turned back on, the periodic reconcile catches indexes up from their watermarks.
 * A runtime override (`nc_global_search_mode`, see setGlobalSearchOverride)
 * can lower this without a restart.
 */
export type GlobalSearchMode = 'off' | 'index' | 'on';

export interface GlobalSearchModeStatus {
  env: GlobalSearchMode;
  override: GlobalSearchMode | null;
  /** The env mode, lowered by the override. */
  mode: GlobalSearchMode;
}

const GLOBAL_SEARCH_MODE_RANK: Record<GlobalSearchMode, number> = {
  off: 0,
  index: 1,
  on: 2,
};

const GLOBAL_SEARCH_MODES: Record<string, GlobalSearchMode> = {
  off: 'off',
  false: 'off',
  '0': 'off',
  index: 'index',
  on: 'on',
  true: 'on',
  '1': 'on',
};

let warnedGlobalSearchValue: string | undefined;

/** `NC_GLOBAL_SEARCH` alone, without the runtime override. */
export function getEnvGlobalSearchMode(): GlobalSearchMode {
  const fallback: GlobalSearchMode = isCloud ? 'index' : 'off';
  const raw = process.env.NC_GLOBAL_SEARCH?.trim().toLowerCase();
  if (!raw) return fallback;
  const mode = GLOBAL_SEARCH_MODES[raw];
  if (mode) return mode;
  if (warnedGlobalSearchValue !== raw) {
    warnedGlobalSearchValue = raw;
    new Logger('GlobalSearch').warn(
      `NC_GLOBAL_SEARCH=${raw} is not one of off, index, on; using ${fallback}`,
    );
  }
  return fallback;
}

export const GLOBAL_SEARCH_MODE_KEY = 'nc_global_search_mode';
/** Set from nc_store; undefined when no override is stored. */
let globalSearchOverride: GlobalSearchMode | undefined;

export function getGlobalSearchOverride(): GlobalSearchMode | undefined {
  return globalSearchOverride;
}

/** The env mode, lowered by the runtime override when that is lower. */
export function getGlobalSearchMode(): GlobalSearchMode {
  const env = getEnvGlobalSearchMode();
  const override = globalSearchOverride;
  if (
    !override ||
    GLOBAL_SEARCH_MODE_RANK[override] >= GLOBAL_SEARCH_MODE_RANK[env]
  ) {
    return env;
  }
  return override;
}

/**
 * Reads the override from nc_store. Each instance runs it at startup and on a
 * timer, so a change made on another instance applies here too.
 */
export async function loadGlobalSearchOverride() {
  const row = await Store.get(GLOBAL_SEARCH_MODE_KEY);
  const value = row?.value;
  globalSearchOverride =
    value === 'off' || value === 'index' || value === 'on' ? value : undefined;
}

/** Stores the override (`null` clears it) and applies it in this process now. */
export async function setGlobalSearchOverride(mode: GlobalSearchMode | null) {
  await Store.saveOrUpdate({ key: GLOBAL_SEARCH_MODE_KEY, value: mode ?? '' });
  globalSearchOverride = mode ?? undefined;
}

/** Index upkeep runs: builds, write tracking, flushes, field syncs, reconcile. */
export function isSearchIndexingEnabled() {
  return getGlobalSearchMode() !== 'off';
}

/** Search is served: all-fields grid search and base record search. */
export function isGlobalSearchEnabled() {
  return getGlobalSearchMode() === 'on';
}

/** Search is on in the env but off by the runtime override: clients loaded before it still ask. */
export function isGlobalSearchSwitchedOff() {
  return getEnvGlobalSearchMode() === 'on' && !isGlobalSearchEnabled();
}

export type SearchIndexState = 'building' | 'ready' | 'failed';
export type { SearchIndexMode };

export interface SearchIndexField {
  /** Expression version and column-settings digest the cells were written with. */
  v: string;
  /** Digest of the linked fields a link or lookup reads through. */
  d?: string;
  /** In every document as of this time; unset until a rebuild writes it. */
  built_at?: string;
  /** When last marked unbuilt; a build started before it doesn't cover it. */
  marked_at?: string;
}

export interface SearchIndexBuild {
  id: string;
  started_at: string;
  heartbeat_at: string;
  /** Column ids the build writes. */
  fields?: string[];
  /** Stopped by a shutdown: counted in `interrupts`, not always a failure. */
  interrupted?: boolean;
  /** Stopped because indexing was switched off: never an interrupt or a failure. */
  paused?: boolean;
  /** Rewrites `fields` of a served index; otherwise a first build. */
  in_place?: boolean;
  /** Every row up to this pk is written; saved with the heartbeat. */
  after?: string | number;
  /** A first build's own table (`schema.name`), attached when done. */
  table?: string;
}

/** Where a build that stopped left off: the next one with the same fields goes on from there. */
export interface SearchIndexResume {
  after: string | number;
  started_at: string;
  fields: string[];
  in_place?: boolean;
  table?: string;
}

export interface SearchIndexMeta {
  format: number;
  /** `building`: no usable index yet. `ready`: served, even while a rebuild runs. */
  state: SearchIndexState;
  row_id_type: 'bigint' | 'text';
  fields: Record<string, SearchIndexField>;
  /** Tables whose meta lists this one under `search_dependents` or `search_junction_for`. */
  dep_tables?: string[];
  /** When the build that wrote the served documents started. */
  built_at?: string;
  last_build?: SearchIndexBuildSummary;
  build?: SearchIndexBuild;
  resume?: SearchIndexResume;
  error?: string;
  failed_at?: string;
  /** Builds failed in a row; a ready build clears it. */
  failures?: number;
  /** Builds stopped by a shutdown in a row; a ready build clears it. */
  interrupts?: number;
}

/** A catch-up read in bounded pk chunks, resumed each pass until it ends. */
export interface SearchCatchUpWalk {
  /** Rows stamped after this are re-indexed. */
  from: string;
  /** When the walk began: the watermark once it ends. */
  started_at: string;
  /** Last pk read; the next chunk starts after it. */
  after?: string | number;
}

/** On a table other indexes read through links: who, and along which links. */
export interface SearchDependent {
  table_id: string;
  links: string[];
  /** The dependent's fields read through `links`; unset = every field. */
  fields?: string[];
}

export { SEARCH_INDEX_META_KEYS };

const KEY_INDEX = 'search_index';
const KEY_DEPENDENTS = 'search_dependents';
/** On a junction table: indexes whose many-to-many links go through it. */
const KEY_JUNCTION_FOR = 'search_junction_for';
const KEY_MODE = 'search_index_mode';
/** Rows updated after this were maybe not re-indexed (catch-up watermark). */
const KEY_SYNCED_AT = 'search_synced_at';
/** A write the queue knows only as "many rows": search scans until it's indexed. */
const KEY_STALE_SINCE = 'search_stale_since';
/** No longer written; cleared with the stale marker. */
const KEY_STALE_FROM = 'search_stale_from';
const KEY_CATCH_UP_WALK = 'search_catch_up_walk';

/** Stored or sent `meta` as an object; undefined when a string doesn't parse. */
function parseMetaObject(meta: unknown): Record<string, unknown> | undefined {
  if (!meta) return {};
  if (typeof meta === 'string') {
    try {
      const parsed = JSON.parse(meta);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return undefined;
    }
  }
  return meta as Record<string, unknown>;
}

export function parseMeta(model: Model): Record<string, unknown> {
  return parseMetaObject(model?.meta) ?? {};
}

/** The index meta, also when it was written by an older format. */
export function getRawSearchIndexMeta(
  model: Model,
): Partial<SearchIndexMeta> | undefined {
  const value = parseMeta(model)[KEY_INDEX] as
    | Partial<SearchIndexMeta>
    | undefined;
  return value?.state ? value : undefined;
}

/** The index meta in the current format; older formats read as no index. */
export function getSearchIndexMeta(model: Model): SearchIndexMeta | undefined {
  const value = getRawSearchIndexMeta(model);
  return value?.format === SEARCH_INDEX_FORMAT
    ? (value as SearchIndexMeta)
    : undefined;
}

export function getSearchDependents(model: Model): SearchDependent[] {
  const value = parseMeta(model)[KEY_DEPENDENTS];
  return Array.isArray(value) ? (value as SearchDependent[]) : [];
}

/** Indexes whose many-to-many links go through this table as their junction. */
export function getSearchJunctionFor(model: Model): string[] {
  const value = parseMeta(model)[KEY_JUNCTION_FOR];
  return Array.isArray(value) ? (value as string[]) : [];
}

export function getSearchIndexMode(model: Model): SearchIndexMode {
  const value = parseMeta(model)[KEY_MODE];
  return value === 'on' || value === 'off' ? value : 'auto';
}

export function getSearchSyncedAt(model: Model): string | undefined {
  const value = parseMeta(model)[KEY_SYNCED_AT];
  return typeof value === 'string' ? value : undefined;
}

export function getSearchStaleSince(model: Model): string | undefined {
  const value = parseMeta(model)[KEY_STALE_SINCE];
  return typeof value === 'string' ? value : undefined;
}

export function getSearchCatchUpWalk(
  model: Model,
): SearchCatchUpWalk | undefined {
  const value = parseMeta(model)[KEY_CATCH_UP_WALK] as
    | SearchCatchUpWalk
    | undefined;
  return value?.from && value.started_at ? value : undefined;
}

/** Saves the walk's progress, or ends it with `null`. */
export function setSearchCatchUpWalk(
  context: NcContext,
  modelId: string,
  walk: SearchCatchUpWalk | null,
) {
  return updateModelMeta(context, modelId, (meta) => {
    if (walk) meta[KEY_CATCH_UP_WALK] = walk;
    else if (KEY_CATCH_UP_WALK in meta) delete meta[KEY_CATCH_UP_WALK];
    else return false;
  });
}

/**
 * `nextMeta` with its search keys replaced by `model`'s current ones: a client
 * sends back the copy it loaded, which may be stale.
 */
export function withSearchIndexMeta(
  model: Model,
  nextMeta: MetaType,
): MetaType {
  return withSearchIndexMetaFrom(parseMeta(model), nextMeta);
}

function withSearchIndexMetaFrom(
  current: Record<string, unknown>,
  nextMeta: MetaType,
): MetaType {
  const stripped = withoutSearchIndexMeta(nextMeta);
  const kept = SEARCH_INDEX_META_KEYS.filter((k) => k in current);
  if (!kept.length) return stripped;
  let next: Record<string, unknown> = {};
  if (typeof stripped === 'string') {
    try {
      next = JSON.parse(stripped) ?? {};
    } catch {
      return stripped;
    }
  } else if (stripped) {
    next = stripped as Record<string, unknown>;
  }
  const merged = { ...next };
  for (const key of kept) merged[key] = current[key];
  return typeof stripped === 'string' ? JSON.stringify(merged) : merged;
}

/**
 * The context for work that outlives its request: without the request's
 * per-request cache, which would keep serving the meta as it was then, and
 * without its user, so cells are derived unrestricted (no RLS or hidden
 * tables); each search applies its requester's limits.
 */
export function detachedContext(context: NcContext): NcContext {
  return {
    ...context,
    user: undefined,
    // Cells are built the same whoever starts the build: with emails.
    is_public: false,
    access_source: undefined,
    cache: false,
    cacheMap: undefined,
  };
}

const locks = new Map<string, Promise<unknown>>();

/** Runs `fn` after every earlier call for the same model in this process. */
function withModelLock<T>(modelId: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(modelId) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(fn);
  const tail = run.catch(() => undefined);
  locks.set(modelId, tail);
  void tail.then(() => {
    if (locks.get(modelId) === tail) locks.delete(modelId);
  });
  return run;
}

const CAS_ATTEMPTS = 8;

/**
 * Read-modify-write of a table's meta, as a compare-and-swap on the stored
 * text: a write from another instance in between is redone on top, never
 * overwritten. Serialised per table in this process. `update` returning
 * false skips the write; the result says whether it wrote. `extra` columns
 * are written in the same statement.
 */
export function updateModelMeta(
  context: NcContext,
  modelId: string,
  update: (meta: Record<string, unknown>) => void | false,
  extra?: Pick<TableReqType, 'description'>,
): Promise<boolean> {
  context = detachedContext(context);
  return withModelLock(modelId, async () => {
    for (let attempt = 0; attempt < CAS_ATTEMPTS; attempt++) {
      const stored = await Model.readRawMeta(context, modelId);
      if (!stored) return false;
      const meta = { ...parseMetaObject(stored.meta) };
      if (update(meta) === false) return false;
      if (
        await Model.updateMetaIfUnchanged(
          context,
          modelId,
          meta,
          stored.meta,
          extra,
        )
      ) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 20 * (attempt + 1)));
    }
    return false;
  });
}

/**
 * Write a client's `meta` for the table, keeping the stored search keys: a
 * client sends back the copy it loaded. `extra` is written with it or not at
 * all. Throws on a `meta` that doesn't parse, or when every compare-and-swap
 * attempt lost.
 */
export async function replaceClientModelMeta(
  context: NcContext,
  modelId: string,
  clientMeta: MetaType,
  extra?: Pick<TableReqType, 'description'>,
) {
  if (!parseMetaObject(clientMeta)) {
    NcError.get(context).invalidRequestBody('Invalid table meta');
  }
  const written = await updateModelMeta(
    context,
    modelId,
    (meta) => {
      const next = parseMetaObject(withSearchIndexMetaFrom(meta, clientMeta));
      for (const key of Object.keys(meta)) delete meta[key];
      Object.assign(meta, next);
    },
    extra,
  );
  if (!written) {
    NcError.get(context).internalServerError(
      'Table meta changed concurrently, please retry',
    );
  }
}

export function setSearchIndexMode(
  context: NcContext,
  modelId: string,
  mode: SearchIndexMode,
) {
  return updateModelMeta(context, modelId, (meta) => {
    if (mode === 'auto') delete meta[KEY_MODE];
    else meta[KEY_MODE] = mode;
  });
}

/**
 * Moves the watermark forward to `at`. Declined when the side table was
 * swapped since `builtAt` was read: the catch-up wrote to the old one.
 */
export function setSearchSyncedAt(
  context: NcContext,
  modelId: string,
  at: string,
  builtAt: string | undefined,
) {
  return updateModelMeta(context, modelId, (meta) => {
    const index = meta[KEY_INDEX] as SearchIndexMeta | undefined;
    if (index?.built_at !== builtAt) return false;
    const current = meta[KEY_SYNCED_AT];
    if (typeof current === 'string' && current >= at) return false;
    meta[KEY_SYNCED_AT] = at;
  });
}

/** Keeps the latest `at`: only a pass started after it clears the marker. */
export function markSearchIndexStale(
  context: NcContext,
  modelId: string,
  at: string,
) {
  return updateModelMeta(context, modelId, (meta) => {
    const current = meta[KEY_STALE_SINCE];
    if (typeof current === 'string' && current >= at) return false;
    meta[KEY_STALE_SINCE] = at;
  });
}

/** Clears the marker when it predates `passStartedAt`, the start of a pass that indexed those rows. */
export function clearSearchIndexStale(
  context: NcContext,
  modelId: string,
  passStartedAt: string,
) {
  return updateModelMeta(context, modelId, (meta) => {
    const current = meta[KEY_STALE_SINCE];
    if (typeof current !== 'string' || current >= passStartedAt) return false;
    delete meta[KEY_STALE_SINCE];
    delete meta[KEY_STALE_FROM];
  });
}

/** `resetSyncedAt`: a new side table, caught up only as of its `built_at`. */
export function patchSearchIndexMeta(
  context: NcContext,
  modelId: string,
  patch: (index: SearchIndexMeta) => SearchIndexMeta | null | false,
  { resetSyncedAt = false }: { resetSyncedAt?: boolean } = {},
) {
  return updateModelMeta(context, modelId, (meta) => {
    const current = meta[KEY_INDEX] as SearchIndexMeta | undefined;
    const next = patch(current);
    if (next === false) return false;
    if (next) meta[KEY_INDEX] = next;
    else delete meta[KEY_INDEX];
    if (resetSyncedAt) {
      delete meta[KEY_SYNCED_AT];
      delete meta[KEY_CATCH_UP_WALK];
    }
  });
}

/** `junction`: the dependent's many-to-many links go through `tableId`. */
export function replaceSearchDependents(
  context: NcContext,
  tableId: string,
  dependentTableId: string,
  entries: SearchDependent[],
  junction = false,
) {
  return updateModelMeta(context, tableId, (meta) => {
    const list = Array.isArray(meta[KEY_DEPENDENTS])
      ? (meta[KEY_DEPENDENTS] as SearchDependent[])
      : [];
    const next = [
      ...list.filter((d) => d.table_id !== dependentTableId),
      ...entries,
    ];
    const junctionFor = Array.isArray(meta[KEY_JUNCTION_FOR])
      ? (meta[KEY_JUNCTION_FOR] as string[])
      : [];
    const nextJunctionFor = [
      ...junctionFor.filter((id) => id !== dependentTableId),
      ...(junction ? [dependentTableId] : []),
    ];
    if (
      JSON.stringify(next) === JSON.stringify(list) &&
      JSON.stringify(nextJunctionFor) === JSON.stringify(junctionFor)
    ) {
      return false;
    }
    if (next.length) meta[KEY_DEPENDENTS] = next;
    else delete meta[KEY_DEPENDENTS];
    if (nextJunctionFor.length) meta[KEY_JUNCTION_FOR] = nextJunctionFor;
    else delete meta[KEY_JUNCTION_FOR];
  });
}
