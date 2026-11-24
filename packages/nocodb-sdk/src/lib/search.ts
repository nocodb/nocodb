import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import UITypes, { isBtLikeV2Junction } from './UITypes';
import { FormulaDataTypes } from './formula/enums';
import { getRollupResultUidt } from './formula/rollupFormula';
import { parseProp } from './helperFunctions';

dayjs.extend(customParseFormat);

/** Above this many matches a searched count reports `SEARCH_COUNT_CAP + 1`, shown as "1,000+". */
export const SEARCH_COUNT_CAP = 1000;

/** Longest search term accepted by the all-fields search. */
export const SEARCH_TERM_MAX_LENGTH = 256;

/** Request param carrying the all-fields search term on data list/count/aggregate/group requests. */
export const SEARCH_QUERY_PARAM = 'search';

/** Request param with the searcher's IANA timezone; a date term matches DateTime values on that day. */
export const SEARCH_TIMEZONE_QUERY_PARAM = 'searchTz';

// Shared by the server query and the client's realtime match / cell highlight, so the two agree.

const SEARCH_TEXT_TYPES = new Set<string>([
  UITypes.SingleLineText,
  UITypes.LongText,
  UITypes.Email,
  UITypes.URL,
  UITypes.PhoneNumber,
  UITypes.SingleSelect,
  UITypes.MultiSelect,
  UITypes.GeoData,
  UITypes.User,
  UITypes.CreatedBy,
  UITypes.LastModifiedBy,
  UITypes.Lookup,
  UITypes.LinkToAnotherRecord,
  UITypes.SpecificDBType,
]);

const SEARCH_NUMBER_TYPES = new Set<string>([
  UITypes.Number,
  UITypes.Decimal,
  UITypes.Currency,
  UITypes.Percent,
  UITypes.Rating,
  UITypes.Year,
  UITypes.AutoNumber,
  UITypes.ID,
]);

const SEARCH_DATE_TYPES = new Set<string>([
  UITypes.Date,
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
]);

const SEARCH_DATE_TIME_TYPES = new Set<string>([
  UITypes.DateTime,
  UITypes.CreatedTime,
  UITypes.LastModifiedTime,
]);

const SEARCH_DATE_INPUT_FORMATS = [
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'DD-MM-YYYY',
  'DD/MM/YYYY',
];

/** How the all-fields search compares a field: text contains, whole number, or same day. */
export type SearchMatchKind = 'text' | 'number' | 'date';

export interface SearchFieldInfo {
  uidt?: string;
  dt?: string;
  meta?: unknown;
  /** Formula `parsed_tree.dataType` / Rollup `result_uidt` / Links relation decide their type. */
  colOptions?: unknown;
}

/**
 * "1,200", "$1,200.50", "-3", "50%" → number; anything else (words, "555 0004") → undefined.
 * A leading zero ("0111") is text: a stored number never shows one.
 */
export function parseSearchNumber(term: string): number | undefined {
  const match =
    /^\s*[$€£¥₹]?\s*([+-]?(?:[1-9]\d{0,2}(?:,\d{3})+|[1-9]\d*|0)(?:\.\d+)?|[+-]?\.\d+)\s*%?\s*$/.exec(
      term
    );
  if (!match) return undefined;
  const value = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(value) ? value : undefined;
}

/** A search term as a `YYYY-MM-DD` day, if it is in one of the accepted date formats. */
export function parseSearchDate(term: string): string | undefined {
  const parsed = dayjs(term, SEARCH_DATE_INPUT_FORMATS, true);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : undefined;
}

/** The type a field's displayed value has; undefined is not searched. */
export function searchFieldType(field: SearchFieldInfo): string | undefined {
  const options = field.colOptions as
    | { parsed_tree?: { dataType?: string }; result_uidt?: string }
    | null
    | undefined;
  switch (field.uidt) {
    case UITypes.Formula:
      switch (options?.parsed_tree?.dataType) {
        case FormulaDataTypes.NUMERIC:
          return UITypes.Number;
        case FormulaDataTypes.DATE:
          return UITypes.Date;
        case FormulaDataTypes.LOGICAL:
        case FormulaDataTypes.COND_EXP:
        case FormulaDataTypes.BOOLEAN:
          return undefined;
        default:
          return UITypes.SingleLineText;
      }
    case UITypes.Rollup: {
      const uidt =
        getRollupResultUidt({ uidt: field.uidt, colOptions: options }) ??
        options?.result_uidt ??
        UITypes.Number;
      return uidt === UITypes.Checkbox ? undefined : uidt;
    }
    case UITypes.Links:
      // A V2 single link (mo/oo) shows its record's title; many-links show a count.
      return isBtLikeV2Junction({ uidt: field.uidt, colOptions: options })
        ? UITypes.LinkToAnotherRecord
        : undefined;
    default:
      return field.uidt;
  }
}

export function isNumericSearchDt(dt?: string) {
  return /int|serial|numeric|decimal|float|double|real/i.test(dt ?? '');
}

/** How the all-fields search compares `field`; undefined is not searched. */
export function searchMatchKind(
  field: SearchFieldInfo
): SearchMatchKind | undefined {
  const uidt = searchFieldType(field);
  if (!uidt) return undefined;
  if (SEARCH_TEXT_TYPES.has(uidt)) return 'text';
  if (SEARCH_NUMBER_TYPES.has(uidt)) {
    // A text primary key (ID over varchar) matches as text.
    return field.uidt === UITypes.ID && !isNumericSearchDt(field.dt)
      ? 'text'
      : 'number';
  }
  if (SEARCH_DATE_TYPES.has(uidt)) return 'date';
  return undefined;
}

/**
 * Timezone whose day a DateTime value is searched in: the field's own, else the
 * searcher's (as toolbar filters do). Undefined for fields without a time.
 */
export function searchDayTimezone(
  field: SearchFieldInfo,
  searcherTimezone?: string
): string | undefined {
  if (!field.uidt || !SEARCH_DATE_TIME_TYPES.has(field.uidt)) return undefined;
  return parseProp(field.meta)?.timezone || searcherTimezone || undefined;
}

/**
 * Why an all-fields search was slower or returned no or possibly incomplete
 * rows, sent as `pageInfo.searchState`:
 * - `indexing`: the table's search index is still being built; the same matches are read from the table, slower.
 * - `failed`: the table's index failed to build (retried later in the background); matches are read from the table, slower.
 * - `too_large_unindexed`: the index isn't built or failed, and the table is too large to read live; no rows match until it's built.
 * - `too_large`: the table has no index and is over the size an automatic build writes, so none is built until an explicit build; no rows match.
 * - `unsupported`: the table can't have a search index (external source, no single primary key, ...).
 * - `catching_up`: the index is behind on recent changes; some matches may be missing.
 * - `term_too_short`: the term gives the trigram index nothing to match (e.g. `ab`, a bare `東京`), isn't a number or a date, and the table is too large to read directly.
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
  | 'disabled';

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
