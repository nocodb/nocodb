// All-fields search matching rules are EE: src/ee/lib/search.ts.

/** Above this many matches a searched count reports `SEARCH_COUNT_CAP + 1`, shown as "1,000+". */
export const SEARCH_COUNT_CAP = 1000;

/** Longest search term accepted by the all-fields search. */
export const SEARCH_TERM_MAX_LENGTH = 256;

/** Request param carrying the all-fields search term on data list/count/aggregate/group requests. */
export const SEARCH_QUERY_PARAM = 'search';

/** Request param with the searcher's IANA timezone; a date term matches DateTime values on that day. */
export const SEARCH_TIMEZONE_QUERY_PARAM = 'searchTz';

/**
 * Why an all-fields search was slower or returned no or possibly incomplete
 * rows, sent as `pageInfo.searchState`:
 * - `indexing`: the table's search index is still being built; the same matches are read from the table, slower.
 * - `failed`: the table's index failed to build (retried later in the background); matches are read from the table, slower.
 * - `too_large_unindexed`: the index isn't built or failed, and the table is too large to read live; no rows match until it's built.
 * - `too_large`: the table has no index and is over the size an automatic build writes, so none is built until an explicit build; no rows match.
 * - `unsupported`: the table can't have a search index (external source, no single primary key, ...).
 * - `catching_up`: the index is behind on recent changes; some matches may be missing.
 * - `term_too_short`: the term gives the trigram index nothing to match (e.g. `ab`, `40`, a bare `東京`) and the table is too large to read directly: text fields aren't searched, number and date fields still are.
 * - `disabled`: all-fields search was turned off at runtime; no rows match. Reload `appInfo` and search one field.
 */
export type SearchState =
  | 'indexing'
  | 'failed'
  | 'too_large_unindexed'
  | 'too_large'
  | 'unsupported'
  | 'catching_up'
  | 'term_too_short'
  | 'disabled'
  /** Too large to read live on a plan without global search (past the live-search row cap or the server's live budget); no rows match. */
  | 'plan_limit';

/** The `pageInfo` key carrying a search's {@link SearchState}. */
export const SEARCH_STATE_FIELD = 'searchState';

/** Per table: `auto` indexes the table when searched unless turned off server-wide; `on`/`off` force it. */
export type SearchIndexMode = 'auto' | 'on' | 'off';

/** The last build that completed. */
export interface SearchIndexBuildSummary {
  finished_at: string;
  /** From start until searches were served from it. */
  duration_ms: number;
  rows: number;
  fields: number;
  /** `direct`: no index was served, so cells went straight to it; `full`: every field of a served index rewritten in place (`swap` before); `fields`: only changed fields rewritten. */
  kind: 'direct' | 'full' | 'swap' | 'fields';
}

export interface SearchIndexStatus {
  mode: SearchIndexMode;
  /** `none`: no index; `outdated`: built by an older version, rebuilt on next search. */
  state: 'none' | 'building' | 'ready' | 'failed' | 'outdated';
  /** A ready index is being rebuilt and still serves searches. */
  rebuilding: boolean;
  fields: { indexed: number; pending: number };
  /** When the build that wrote the served documents started. */
  built_at?: string;
  last_build?: SearchIndexBuildSummary;
  /** Why the last build failed, in general terms. */
  error?: string;
  /** The class of database error behind `error`, as a fixed text (the driver's message is only logged). Not shown in the UI. */
  error_detail?: string;
  /** Failed builds in a row; reset by a build that completes. */
  failures?: number;
  failed_at?: string;
  /** Earliest background retry, on a search after it; null past the failure cap, when only an explicit build retries. */
  retry_at?: string | null;
  size_bytes?: number;
  /** Whether indexes are built and kept fresh on this server (`NC_GLOBAL_SEARCH` is `index` or `on`). */
  enabled: boolean;
  /** Whether search is served on this server (`NC_GLOBAL_SEARCH=on`). */
  searchEnabled: boolean;
  /** Why this table can't be indexed. */
  unavailable?: string;
  /** Why no automatic build indexes this table: it is over the cell budget. An explicit build (mode `on`) still does. */
  too_large?: string;
  /** Fields the index can't hold whose search reads every row: shown in a view, the index doesn't speed it up. */
  slow_fields?: Array<{ id: string; title: string }>;
}

/** Internal operation searching the records of one base (EE, Cmd+K). */
export const BASE_RECORD_SEARCH_OPERATION = 'baseRecordSearch';

/** Shortest term a base record search accepts; under 3, only small tables are searched. */
export const BASE_RECORD_SEARCH_MIN_LENGTH = 2;

/** Most records one base record search returns. */
export const BASE_RECORD_SEARCH_LIMIT = 50;

export interface BaseRecordSearchHit {
  tableId: string;
  tableTitle: string;
  /** The record's primary key, as the `rowId` route query takes it. */
  rowId: string;
  /** The display value as text; empty when the record has none. */
  title: string;
}

export interface BaseRecordSearchResult {
  list: BaseRecordSearchHit[];
  /** Readable tables whose index is still being built; they join later searches. */
  indexing: number;
  /** Readable tables that can't be searched now: the index failed to build (retried in the background), or the search failed. */
  failed: number;
  /** Readable tables that can't be indexed (external source, no single primary key, ...), or too large for an automatic build. */
  unsupported: number;
  /** More records matched than were returned. */
  truncated: boolean;
  /** Global search was turned off at runtime: nothing was searched. */
  disabled?: boolean;
}
