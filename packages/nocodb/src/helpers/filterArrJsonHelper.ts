import type { NcContext } from 'nocodb-sdk';
import type Filter from '~/models/Filter';
import { NcError } from '~/helpers/ncError';

// `filterArrJson` arrives either as a JSON string (API/query-param callers) or
// an already-parsed Filter[] (internal callers pass it pre-parsed). A malformed
// JSON string fails closed with a 400 — silently dropping it would run the
// query unfiltered (fail-open data exposure, e.g. an unfiltered count on a
// public shared view). Empty/absent => undefined (no extra filter); a value
// that parses to a non-array is rejected too. Note `[null]` is a valid array,
// so it passes here — conditionV2 tolerates/drops null entries downstream.
export function parseFilterArrJson(
  context: NcContext,
  raw: string | Filter[] | undefined,
  label?: string,
): Filter[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) return raw;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    NcError.get(context).badRequest(
      `Invalid filterArrJson${label ? ` for ${label}` : ''}`,
    );
  }

  if (!Array.isArray(parsed)) {
    NcError.get(context).badRequest(
      `Invalid filterArrJson${label ? ` for ${label}` : ''}`,
    );
  }

  return parsed as Filter[];
}
