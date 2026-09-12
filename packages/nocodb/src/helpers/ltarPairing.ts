/**
 * Helpers for identifying the counterpart column of a Link-to-another-record
 * (LTAR) relation while upgrading V1 links to V2.
 *
 * Background (nocodb/nocodb#13781):
 * When a link is converted to V2 we have to locate the column on the related
 * table that forms the other half of the relation (the BT for an HM, or the HM
 * for a BT). Historically this match keyed only on
 * `(fk_parent_column_id, fk_child_column_id, type)` and returned the first hit.
 * Those keys are NOT unique when an external source has multiple foreign-key
 * constraints over the same column pair: NocoDB then creates two links that
 * share both column ids and differ only by `fk_index_name`, so the first match
 * could pick the wrong counterpart and the two links' identities ended up
 * swapped after the (irreversible) upgrade.
 *
 * A genuine HM/BT pair is always created with the same FK constraint name in
 * `fk_index_name` (see `createHmAndBtColumn`), and distinct relations get
 * distinct constraint names. So when the base match is ambiguous we
 * disambiguate by `fk_index_name`.
 */

/** Minimal subset of LTAR relation metadata needed to pair columns. */
export interface LtarPairColOptions {
  fk_parent_column_id?: string;
  fk_child_column_id?: string;
  fk_index_name?: string;
  type?: string;
}

export interface LtarPairCandidate<
  TColumn = unknown,
  TColOptions extends LtarPairColOptions = LtarPairColOptions,
> {
  column: TColumn;
  colOptions: TColOptions;
}

/**
 * Pick the column that is the true counterpart of the link being converted.
 *
 * Behaviour is intentionally unchanged when the base match yields 0 or 1
 * candidate, or when the source column has no `fk_index_name` (legacy rows) — in
 * those cases the first base match is returned exactly as before, so existing
 * conversions cannot regress. Only the previously-broken ambiguous case
 * (an external source with multiple FK constraints over the same column pair)
 * now resolves deterministically.
 */
export function pickPairedLtarColumn<
  TColumn,
  TColOptions extends LtarPairColOptions,
>(
  candidates: LtarPairCandidate<TColumn, TColOptions>[],
  source: LtarPairColOptions,
  pairedRelType: string,
): LtarPairCandidate<TColumn, TColOptions> | undefined {
  const baseMatches = candidates.filter(
    (c) =>
      c.colOptions.fk_parent_column_id === source.fk_parent_column_id &&
      c.colOptions.fk_child_column_id === source.fk_child_column_id &&
      c.colOptions.type === pairedRelType,
  );

  // 0 or 1 match → unambiguous, keep the historic result.
  if (baseMatches.length <= 1) {
    return baseMatches[0];
  }

  // Ambiguous: several links share the same (parent, child, type) — e.g. an
  // external source with multiple FK constraints over the same column pair. The
  // correct counterpart shares this link's FK constraint name, which uniquely
  // identifies the pair.
  if (source.fk_index_name) {
    const exact = baseMatches.find(
      (c) => c.colOptions.fk_index_name === source.fk_index_name,
    );
    if (exact) {
      return exact;
    }
  }

  // Could not disambiguate (e.g. legacy rows without `fk_index_name`); fall back
  // to the previous behaviour so we never break a conversion that worked before.
  return baseMatches[0];
}
