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
import Noco from '~/Noco';
import { Column as ColumnModel } from '~/models';
import { MetaTable } from '~/utils/globals';

// A display value chain longer than this is rejected rather than followed.
// Keep it within getAst's nesting cap and the grid's LINKED_RECORD_MAX_DEPTH.
export const DISPLAY_VALUE_LINK_MAX_DEPTH = 5;

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
    // Reaching this table's display value closes the loop, for a candidate link that does not
    // exist yet and so cannot be recognised by identity.
    cycleAt,
  }: {
    maxDepth?: number;
    override?: { modelId: string; column: Column };
    linkDisplayColumns?: Record<string, string | null>;
    cycleAt?: string;
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
    if (related.id === cycleAt) {
      return { chain, leaf: null, cyclic: true, tooDeep: false };
    }
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

export async function getDisplayValueOfRefTable(
  context: NcContext,
  relationCol: Column<LinkToAnotherRecordColumn | LinksColumn>,
) {
  const colOpt = await relationCol.getColOptions<
    LinkToAnotherRecordColumn | LinksColumn
  >();
  const model = await colOpt.getRelatedTable();
  const cols = await model.getColumns();

  const override = getLinkDisplayOverride(colOpt, cols);
  if (override) return override;

  const pv = cols.find((col) => col.pv) || cols[0];

  // A display value link that leads back to itself cannot be followed: use the id instead.
  if (
    pv &&
    isLinksOrLTAR(pv) &&
    isUnfollowableChain(await resolveDisplayValueChain(pv))
  ) {
    return cols.find((col) => col.pk) || cols[0];
  }

  return pv;
}

/**
 * Links in the longest chain of display-value links that ends at `modelId`: a link counts
 * when it is its table's display value and reads the linked table's display value (no
 * display column of its own). Same-base links only; one meta query per level, capped.
 */
async function longestUpstreamChain(
  context: NcContext,
  modelId: string,
  seen = new Set<string>([modelId]),
): Promise<number> {
  if (seen.size > DISPLAY_VALUE_LINK_MAX_DEPTH) return 0;
  const relations = await Noco.ncMeta.metaList2(
    context.workspace_id,
    context.base_id,
    MetaTable.COL_RELATIONS,
    { condition: { fk_related_model_id: modelId } },
  );
  let longest = 0;
  for (const relation of relations) {
    if (relation.fk_display_value_column_id) continue;
    const col = await ColumnModel.get(context, {
      colId: relation.fk_column_id,
    });
    if (
      !col?.pv ||
      !isLinksOrLTAR(col) ||
      seen.has(col.fk_model_id) ||
      (await col.getColOptions<LinkToAnotherRecordColumn>())
        ?.fk_related_model_id !== modelId
    ) {
      continue;
    }
    const upstream = await longestUpstreamChain(
      context,
      col.fk_model_id,
      new Set(seen).add(col.fk_model_id),
    );
    longest = Math.max(longest, 1 + upstream);
  }
  return longest;
}

/**
 * Rejects making `candidate` (a link column) its table's display value when following the
 * related tables' display values leads back to a column already on the path, or when the
 * chain, with the display-value links that already lead into its table, would be too deep.
 */
export async function assertNoDisplayValueCycle(
  context: NcContext,
  candidate: Column,
  linkDisplayColumns?: Record<string, string | null>,
) {
  const { chain, cyclic, tooDeep } = await resolveDisplayValueChain(candidate, {
    override: { modelId: candidate.fk_model_id, column: candidate },
    linkDisplayColumns,
  });
  if (cyclic) {
    NcError.get(context).invalidRequestBody(
      "This link would refer back to itself through the linked tables' display values.",
    );
  }
  if (
    tooDeep ||
    chain.length +
      (await longestUpstreamChain(context, candidate.fk_model_id)) >
      DISPLAY_VALUE_LINK_MAX_DEPTH
  ) {
    NcError.get(context).invalidRequestBody(
      `Linked display values are nested more than ${DISPLAY_VALUE_LINK_MAX_DEPTH} tables deep.`,
    );
  }
}

/**
 * Same rules as {@link assertNoDisplayValueCycle}, for a link that is about to be created: the
 * chain it would follow is the related table's own display value, so it can be checked before
 * anything is written.
 */
export async function assertNewLinkDisplayValueOk(
  context: NcContext,
  param: {
    ownerModelId: string;
    relatedModel: Model;
    displayColumnId?: string | null;
  },
) {
  const { ownerModelId, relatedModel, displayColumnId } = param;
  await relatedModel.getColumns();

  const cyclic = () =>
    NcError.get(context).invalidRequestBody(
      "This link would refer back to itself through the linked tables' display values.",
    );
  const tooDeep = () =>
    NcError.get(context).invalidRequestBody(
      `Linked display values are nested more than ${DISPLAY_VALUE_LINK_MAX_DEPTH} tables deep.`,
    );

  // The link's own display column is a scalar and ends the chain; without one, a link back to
  // its own table would read the display value it is becoming.
  const override = getLinkDisplayOverride(
    { fk_display_value_column_id: displayColumnId ?? undefined },
    relatedModel.columns,
  );
  if (!override && relatedModel.id === ownerModelId) cyclic();

  let chain: Column[] = [];
  const start = override ?? relatedModel.displayValue;
  if (start && isLinksOrLTAR(start)) {
    const result = await resolveDisplayValueChain(start, {
      cycleAt: ownerModelId,
    });
    if (result.cyclic) cyclic();
    if (result.tooDeep) tooDeep();
    chain = result.chain;
  }

  // + 1 for the link itself
  if (
    1 + chain.length + (await longestUpstreamChain(context, ownerModelId)) >
    DISPLAY_VALUE_LINK_MAX_DEPTH
  ) {
    tooDeep();
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
