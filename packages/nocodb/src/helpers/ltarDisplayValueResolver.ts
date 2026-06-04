import { isLinksOrLTAR, NcApiVersion, RelationTypes } from 'nocodb-sdk';
import type { LinkToAnotherRecordColumn } from '~/models';
import type { NcContext } from '~/interface/config';
import { Column, Filter, Model, Source } from '~/models';
import { NcError } from '~/helpers/catchError';
import NcConnectionMgrv2 from '~/utils/common/NcConnectionMgrv2';
import { dataWrapper } from '~/helpers/dbHelpers';

/**
 * Shared context + display-value → pk resolution for link (LTAR) columns.
 *
 * Used by both grid copy-paste (`DataTableService.nestedBulkLinkByDisplayValue`)
 * and file import (`DataImportProcessor`) so the matching semantics — which
 * column is matched, exact-then-case-insensitive fallback — stay identical.
 */
export interface LtarDisplayValueContext {
  column: Column;
  colOptions: LinkToAnotherRecordColumn;
  /** Context of the related (child) table — may differ from the parent's. */
  refContext: NcContext;
  relatedModel: Model;
  relatedBaseModel: Awaited<ReturnType<typeof Model.getBaseModelSQL>>;
  /** Column of the related table whose values are matched against. */
  displayValueColumn: Column;
  /** BELONGS_TO / ONE_TO_ONE / MANY_TO_ONE — at most one link target. */
  isSingleLink: boolean;
}

/**
 * Resolves all shared context for a link column: validates it is an LTAR
 * type, loads colOptions, the related model + base model, and the
 * display-value column to match against.
 *
 * Prefers the LTAR's custom display value column (`fk_display_value_column_id`)
 * — that's what the user sees in the cell chip and would be copying — and
 * falls back to the related table's primary value.
 *
 * Throws when the column is not a link or the related table has no usable
 * display value column. Unlike the paste path, this does NOT short-circuit
 * on a missing junction model: callers that link via `addLinks` (e.g. import)
 * support has-many / belongs-to relations too.
 */
export async function getLtarDisplayValueContext(
  context: NcContext,
  column: Column,
): Promise<LtarDisplayValueContext> {
  if (!isLinksOrLTAR(column)) {
    NcError.get(context).invalidRequestBody(
      `Column '${column.title ?? column.id}' is not a link column`,
    );
  }

  const colOptions =
    await column.getColOptions<LinkToAnotherRecordColumn>(context);

  const { refContext } = await colOptions.getParentChildContext(context);
  const relatedModel = await colOptions.getRelatedTable(refContext);
  await relatedModel.getColumns(refContext);

  const customDisplayColId = (colOptions as any).fk_display_value_column_id;
  const customDisplayCol =
    customDisplayColId &&
    relatedModel.columns?.find((c) => c.id === customDisplayColId);
  const displayValueColumn = customDisplayCol ?? relatedModel.displayValue;
  if (!displayValueColumn) {
    NcError.get(context).badRequest(
      'Related table has no display value column',
    );
  }

  const isSingleLink = [
    RelationTypes.BELONGS_TO,
    RelationTypes.ONE_TO_ONE,
    RelationTypes.MANY_TO_ONE,
  ].includes(colOptions.type as RelationTypes);

  const relatedSource = await Source.get(refContext, relatedModel.source_id);
  const relatedBaseModel = await Model.getBaseModelSQL(refContext, {
    id: relatedModel.id,
    dbDriver: await NcConnectionMgrv2.get(relatedSource),
  });

  return {
    column,
    colOptions,
    refContext,
    relatedModel,
    relatedBaseModel,
    displayValueColumn,
    isSingleLink,
  };
}

/**
 * Batch-resolves display values to primary keys for the related table.
 *
 * Two-step strategy:
 *  1. Case-sensitive exact match (`eq`) — one query for all values.
 *  2. Case-insensitive fallback (`like`) for any values step 1 missed, with a
 *     post-filter lowercase equality check to avoid partial/wildcard matches.
 *
 * Returns a Map from submitted display value → matched primary key. Unmatched
 * values are simply absent. Ambiguous values (matching multiple rows) resolve
 * to the first row seen.
 */
export async function resolveLtarDisplayValuesToPks(
  groupCtx: LtarDisplayValueContext,
  uniqueValues: Iterable<string>,
): Promise<Map<string, string | number>> {
  const { relatedModel, relatedBaseModel, displayValueColumn } = groupCtx;
  const dvTitle = displayValueColumn.title;

  const pkFieldSet = new Set(
    relatedModel.primaryKeys.map((pk) => pk.title || pk.column_name),
  );
  pkFieldSet.add(dvTitle);

  const listOpts = { fieldsSet: pkFieldSet };
  const listFlags = {
    ignoreViewFilterAndSort: true,
    ignorePagination: true,
  };

  const allUniqueValues = new Set<string>(uniqueValues);

  const valueToPk = new Map<string, string | number>();

  if (allUniqueValues.size === 0) return valueToPk;

  // Step 1: case-sensitive exact match (eq)
  const eqFilterArr = [...allUniqueValues].map(
    (v) =>
      new Filter({
        fk_column_id: displayValueColumn.id,
        comparison_op: 'eq',
        value: v,
        logical_op: 'or',
      }),
  );

  const exactRows = await relatedBaseModel.list(
    { ...listOpts, filterArr: eqFilterArr, apiVersion: NcApiVersion.V3 },
    listFlags,
  );

  for (const row of exactRows) {
    const dv = row[dvTitle];
    if (dv == null) continue;
    const dvStr = String(dv);
    if (allUniqueValues.has(dvStr) && !valueToPk.has(dvStr)) {
      valueToPk.set(dvStr, dataWrapper(row).extractPksValue(relatedModel, true));
    }
  }

  // Step 2: case-insensitive fallback for the values eq didn't match
  const unmatchedValues = [...allUniqueValues].filter((v) => !valueToPk.has(v));
  if (unmatchedValues.length > 0) {
    const likeFilterArr = unmatchedValues.map(
      (v) =>
        new Filter({
          fk_column_id: displayValueColumn.id,
          comparison_op: 'like',
          value: v,
          logical_op: 'or',
        }),
    );

    const candidateRows = await relatedBaseModel.list(
      { ...listOpts, filterArr: likeFilterArr, apiVersion: NcApiVersion.V3 },
      listFlags,
    );

    const lowerToOriginal = new Map<string, string>();
    for (const v of unmatchedValues) {
      const lower = v.toLowerCase();
      if (!lowerToOriginal.has(lower)) lowerToOriginal.set(lower, v);
    }

    for (const row of candidateRows) {
      const dv = row[dvTitle];
      if (dv == null) continue;
      const dvLower = String(dv).toLowerCase();
      const originalValue = lowerToOriginal.get(dvLower);
      if (originalValue && !valueToPk.has(originalValue)) {
        valueToPk.set(
          originalValue,
          dataWrapper(row).extractPksValue(relatedModel, true),
        );
      }
    }
  }

  return valueToPk;
}
