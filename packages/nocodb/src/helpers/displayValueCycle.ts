import { isLinksOrLTAR } from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { Column, LinksColumn, LinkToAnotherRecordColumn } from '~/models';
import { NcError } from '~/helpers/catchError';

// A display value chain longer than this is rejected rather than followed.
export const DISPLAY_VALUE_LINK_MAX_DEPTH = 8;

/**
 * Follows a link display value to the first non-link column and returns the chain of
 * link columns walked. Stops at a column already seen or at the depth cap, so a cycle that
 * already exists in the data cannot loop.
 */
export async function resolveDisplayValueChain(
  start: Column,
  {
    maxDepth = DISPLAY_VALUE_LINK_MAX_DEPTH,
    // Treat `override.column` as the display value of `override.modelId`, for a column that is
    // about to become one.
    override,
  }: {
    maxDepth?: number;
    override?: { modelId: string; column: Column };
  } = {},
): Promise<{ chain: Column[]; leaf: Column | null; cyclic: boolean }> {
  const chain: Column[] = [];
  const seen = new Set<string>();
  let cur: Column | null = start;

  while (cur && isLinksOrLTAR(cur)) {
    if (seen.has(cur.id) || chain.length >= maxDepth) {
      return { chain, leaf: null, cyclic: true };
    }
    seen.add(cur.id);
    chain.push(cur);

    const opts = await cur.getColOptions<
      LinkToAnotherRecordColumn | LinksColumn
    >();
    const related = await opts?.getRelatedTable();
    if (!related) return { chain, leaf: null, cyclic: false };
    await related.getColumns();
    cur =
      override && related.id === override.modelId
        ? override.column
        : related.displayValue;
  }

  return { chain, leaf: cur, cyclic: false };
}

/**
 * Rejects making `candidate` (a link column) its table's display value when following the
 * related tables' display values leads back to a column already on the path.
 */
export async function assertNoDisplayValueCycle(
  context: NcContext,
  candidate: Column,
) {
  const { cyclic } = await resolveDisplayValueChain(candidate, {
    override: { modelId: candidate.fk_model_id, column: candidate },
  });
  if (cyclic) {
    NcError.get(context).invalidRequestBody(
      'This link cannot be the display value: it would refer back to itself through the display values of the linked tables.',
    );
  }
}

/** A table's display value, or undefined when it is a link whose chain loops back. */
export async function displayValueUnlessCyclic(
  displayValue: Column | undefined,
): Promise<Column | undefined> {
  if (!displayValue || !isLinksOrLTAR(displayValue)) return displayValue;
  return (await resolveDisplayValueChain(displayValue)).cyclic
    ? undefined
    : displayValue;
}
