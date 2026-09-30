import { defaultLimitConfig } from '~/helpers/extractLimitAndOffset';

/**
 * A tool call that ran costs at least one API call, the way any REST request
 * does. Without this an empty `records: []` would cost nothing and a batch of
 * empty calls would be free.
 */
export function atLeastOne(units: number): number {
  return Number.isFinite(units) && units > 1 ? Math.ceil(units) : 1;
}

/**
 * What a bulk write would have cost over the public v3 API, where `restCap` is
 * the records that API accepts per request — `V3_DATA_PAYLOAD_LIMIT` for the
 * record routes, and 1 for the link routes, which take `rowId` in the path and
 * so handle exactly one record per call.
 */
export function unitsForBulk(count: number, restCap: number): number {
  return atLeastOne(Math.ceil(count / Math.max(restCap, 1)));
}

/** What reading `rows` rows would have cost paging the v3 list API. */
export function unitsForRows(rows: number): number {
  return atLeastOne(Math.ceil(rows / defaultLimitConfig.limitMax));
}
