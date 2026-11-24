import { defaultGroupByLimitConfig } from '~/helpers/extractLimitAndOffset';
import { NcError } from '~/helpers/catchError';

// Each bulk entry costs a full query. Shared-view routes are anonymous, and a
// searched member request holds one search slot for all its entries — without a
// cap one 50MB body (the json-body middleware limit) buys tens of thousands of
// them. 200 leaves 2x headroom over the largest batch the UI sends
// (GROUP_CHUNK_SIZE = 100 in useInfiniteGroups).
//
// useViewGroupBy sizes its batch by `limitGroup` instead, which has a lower clamp
// only — so raising NC_DB_QUERY_LIMIT_GROUP_BY_GROUP past the cap would 400 every
// shared-view request and blame this file. Track it rather than couple to it.
export const MAX_PUBLIC_BULK_ENTRIES = Math.max(
  200,
  defaultGroupByLimitConfig.limitGroup,
);

export function assertBulkFilterListWithinLimit(bulkFilterList: unknown): void {
  if (!Array.isArray(bulkFilterList) || !bulkFilterList.length) {
    NcError.badRequest('Invalid bulkFilterList');
  }

  if ((bulkFilterList as unknown[]).length > MAX_PUBLIC_BULK_ENTRIES) {
    NcError.badRequest(
      `bulkFilterList exceeds the maximum of ${MAX_PUBLIC_BULK_ENTRIES} entries`,
    );
  }
}
