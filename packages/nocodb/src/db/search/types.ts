import type { IBaseModelSqlV2 } from '~/db/IBaseModelSqlV2';
import type { Filter } from '~/models';

export interface SearchRequest {
  term: string;
  /** Searcher's IANA timezone, for DateTime fields without their own. */
  timezone?: string;
  /** Match text without a trigram (`ab`, `東京`): only on a table read directly. */
  scan?: boolean;
}

/**
 * The rows a search matches. A provider returns a condition to AND into the
 * view query, or (for an external index) a capped list of row ids.
 */
export type SearchMatch =
  | { kind: 'condition'; filters: Filter[] }
  | { kind: 'ids'; ids: Array<string | number>; capped: boolean };

export interface SearchProvider {
  /** 0 = scan, 1 = search table, 2 = external engine. */
  readonly tier: 0 | 1 | 2;
  match(
    baseModel: IBaseModelSqlV2,
    request: SearchRequest,
  ): Promise<SearchMatch>;
}
