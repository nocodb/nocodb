import {
  isLinksOrLTAR,
  isSingleRecordLinkColumn,
  isSupportedDisplayValueColumn,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type {
  Column,
  LinksColumn,
  LinkToAnotherRecordColumn,
  Model,
} from '~/models';
import { NcError } from '~/helpers/catchError';

// A display value chain longer than this is rejected rather than followed.
export const DISPLAY_VALUE_LINK_MAX_DEPTH = 16;

/** The link's own scalar display column on the related table, which wins over its display value. */
export function getLinkDisplayOverride(
  colOpt: { fk_display_value_column_id?: string } | null | undefined,
  relatedColumns: Column[] | undefined,
): Column | undefined {
  const overrideId = colOpt?.fk_display_value_column_id;
  if (!overrideId) return undefined;
  const override = relatedColumns?.find((c) => c.id === overrideId);
  return override && isSupportedDisplayValueColumn(override)
    ? override
    : undefined;
}

/** The chain cannot be followed: it loops back or is deeper than the cap. */
export function isUnfollowableChain(result: {
  cyclic: boolean;
  tooDeep: boolean;
}) {
  return result.cyclic || result.tooDeep;
}

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
    // Link column id -> display column it is about to get (null clears it).
    linkDisplayColumns,
  }: {
    maxDepth?: number;
    override?: { modelId: string; column: Column };
    linkDisplayColumns?: Record<string, string | null>;
  } = {},
): Promise<{
  chain: Column[];
  leaf: Column | null;
  cyclic: boolean;
  tooDeep: boolean;
}> {
  const chain: Column[] = [];
  const seen = new Set<string>();
  let cur: Column | null = start;

  while (cur && isLinksOrLTAR(cur)) {
    if (seen.has(cur.id)) {
      return { chain, leaf: null, cyclic: true, tooDeep: false };
    }
    if (chain.length >= maxDepth) {
      return { chain, leaf: null, cyclic: false, tooDeep: true };
    }
    seen.add(cur.id);
    chain.push(cur);

    const opts = await cur.getColOptions<
      LinkToAnotherRecordColumn | LinksColumn
    >();
    const related = await opts?.getRelatedTable();
    if (!related) return { chain, leaf: null, cyclic: false, tooDeep: false };
    const relatedColumns = await related.getColumns();
    // The link's own display column is a scalar and ends the chain.
    const linkOpts =
      linkDisplayColumns && cur.id in linkDisplayColumns
        ? {
            fk_display_value_column_id: linkDisplayColumns[cur.id] ?? undefined,
          }
        : opts;
    cur =
      getLinkDisplayOverride(linkOpts, relatedColumns) ??
      (override && related.id === override.modelId
        ? override.column
        : related.displayValue);
  }

  return { chain, leaf: cur, cyclic: false, tooDeep: false };
}

/**
 * Rejects making `candidate` (a link column) its table's display value when following the
 * related tables' display values leads back to a column already on the path.
 */
export async function assertNoDisplayValueCycle(
  context: NcContext,
  candidate: Column,
  linkDisplayColumns?: Record<string, string | null>,
) {
  const { cyclic, tooDeep } = await resolveDisplayValueChain(candidate, {
    override: { modelId: candidate.fk_model_id, column: candidate },
    linkDisplayColumns,
  });
  if (cyclic) {
    NcError.get(context).invalidRequestBody(
      "This link would refer back to itself through the linked tables' display values.",
    );
  }
  if (tooDeep) {
    NcError.get(context).invalidRequestBody(
      `Linked display values are nested more than ${DISPLAY_VALUE_LINK_MAX_DEPTH} tables deep.`,
    );
  }
}

/**
 * A related table's display value, or undefined when it cannot be followed: a link whose
 * chain loops back or is too deep, or one the link's own display column replaces.
 */
export async function displayValueUnlessCyclic(
  relatedModel: Model,
  colOpt?: { fk_display_value_column_id?: string } | null,
): Promise<Column | undefined> {
  const displayValue = relatedModel.displayValue;
  if (!displayValue || !isLinksOrLTAR(displayValue)) return displayValue;
  if (getLinkDisplayOverride(colOpt, relatedModel.columns)) return undefined;
  return isUnfollowableChain(await resolveDisplayValueChain(displayValue))
    ? undefined
    : displayValue;
}

/**
 * Ids of the single-record links among `columns` that may be their table's display value:
 * not part of a loop and not too deep. Used when a display value has to be re-picked.
 */
export async function getEligibleDisplayValueLinkIds(
  columns: Column[],
): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const col of columns) {
    if (!isLinksOrLTAR(col) || col.system) continue;
    if (!col.colOptions) await col.getColOptions();
    if (!isSingleRecordLinkColumn(col)) continue;
    const result = await resolveDisplayValueChain(col, {
      override: { modelId: col.fk_model_id, column: col },
    });
    if (!isUnfollowableChain(result)) ids.add(col.id);
  }
  return ids;
}
