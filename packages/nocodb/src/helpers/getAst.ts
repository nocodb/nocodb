import {
  isBtLikeV2Junction,
  NcApiVersion,
  parseProp,
  RelationTypes,
  ROW_COLORING_MODE,
  UITypes,
} from 'nocodb-sdk';
import { Logger } from '@nestjs/common';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
} from '~/models';
import type { ViewMetaRowColoring } from '~/models/View';
import { View } from '~/models';
import { MetaTable } from '~/cli';
import { NcError } from '~/helpers/catchError';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';
import {
  type Ast,
  type AstResult,
  type ColumnAstContext,
  resolveColumnAst,
} from '~/helpers/getAstColumnStrategy';
import { resolveViewVisibleColumns } from '~/helpers/viewVisibleColumns';

const logger = new Logger('getAst');

// Cap on recursive nested-LTAR expansion. See `_depth` param doc on getAst.
const GET_AST_MAX_DEPTH = 8;

const getAst = async (
  context: NcContext,
  {
    query,
    extractOnlyPrimaries = false,
    includePkByDefault = true,
    model,
    view,
    dependencyFields = {
      ...(query || {}),
      nested: { ...(query?.nested || {}) },
      fieldsSet: new Set(),
    },
    getHiddenColumn = query?.['getHiddenColumn'] === 'true',
    throwErrorIfInvalidParams = false,
    extractOnlyRangeFields = false,
    apiVersion = NcApiVersion.V2,
    extractOrderColumn = false,
    includeSortAndFilterColumns = false,
    includeRowColorColumns = false,
    includeButtonFilterColumns = false,
    skipSubstitutingColumnIds = false,
    fk_display_value_column_id,
    allowRequestedHiddenFields = false,
    skipRelationExpansion = false,
    requiredColumnIds,
    _depth = 0,
  }: {
    query?: RequestQuery;
    extractOnlyPrimaries?: boolean;
    // Bound relation re-resolution to a single query: build the AST normally
    // but drop the recursion drivers — LinkToAnotherRecord, Lookup, and V2
    // junction Links (mo/bt/oo) — which resolve by reading related rows
    // (re-entering postProcessData). Everything else (scalars, Rollup, a Links
    // count, Formula, Barcode/…) resolves inside this one SELECT and is kept,
    // so an outer lookup can read a target of any of those types on the nested
    // read without unbounded fan-out (#14229).
    skipRelationExpansion?: boolean;
    // #14229 targeted expansion: on a bounded nested read, LTAR/Lookup columns
    // whose id is in this set are KEPT (expanded) even past the depth bound —
    // these are the lookup targets an outer lookup chain actually needs, so a
    // deep lookup→lookup→lookup chain resolves without expanding every unrelated
    // relation column on the table (which caused the metaLTAR fan-out). Computed
    // per relation read in relation-data-fetcher (union of the fk_lookup_column_id
    // of all lookups traversing that relation) and threaded down here.
    requiredColumnIds?: Set<string>;
    includePkByDefault?: boolean;
    model: Model;
    view?: View;
    dependencyFields?: DependantFields;
    getHiddenColumn?: boolean;
    throwErrorIfInvalidParams?: boolean;
    // Used for calendar view
    extractOnlyRangeFields?: boolean;
    apiVersion?: NcApiVersion;
    extractOrderColumn?: boolean;
    includeSortAndFilterColumns?: boolean;
    includeRowColorColumns?: boolean;
    includeButtonFilterColumns?: boolean;
    skipSubstitutingColumnIds?: boolean;
    fk_display_value_column_id?: string | null;
    // Opt-in: return an explicitly requested field even if view-hidden. Off by
    // default for every caller — the nested-link fetchers set it, since there the
    // exposure is bounded by the link's own pk/pv/display projection instead.
    allowRequestedHiddenFields?: boolean;
    // Internal: recursion depth for nested LTAR expansion. Bounded to
    // GET_AST_MAX_DEPTH (8) to prevent client-controlled `?nested[a][nested]
    // [b][nested]…` payloads or cyclic LTAR/Lookup metadata from blowing
    // the stack. Eight levels covers every realistic UI/agent need.
    _depth?: number;
  },
): Promise<{
  ast: Ast;
  dependencyFields: DependantFields;
  parsedQuery: DependantFields;
}> => {
  if (_depth > GET_AST_MAX_DEPTH) {
    logger.warn(
      `getAst recursion depth exceeded (${_depth} > ${GET_AST_MAX_DEPTH}) for model ${model.id}; ` +
        `truncating nested expansion. This usually means a deeply nested ?nested[…] ` +
        `query, or a cyclic LTAR/Lookup chain in column metadata.`,
    );
    return { ast: {}, dependencyFields, parsedQuery: dependencyFields };
  }
  // set default values of dependencyFields and nested
  dependencyFields.nested = dependencyFields.nested || {};
  dependencyFields.fieldsSet = dependencyFields.fieldsSet || new Set();

  const getFieldKey = (col: Column) => {
    return skipSubstitutingColumnIds ? col.id : col.title;
  };

  // Per-view-type visible-column resolution lives in `viewVisibleColumns` so the
  // response-payload gate below (`allowedCols`) and the shared-view QUERY gate
  // (`restrictSharedViewQuery`) are computed from one source and cannot drift.
  //
  // Stays ABOVE the `extractOnlyPrimaries` return: it lazily loads
  // `model.columns`, which that block reads via `model.primaryKeys`.
  const {
    allowedCols,
    dependencyFieldsForRangeView,
    sortColumnIds,
    filterColumnIds,
  } = await resolveViewVisibleColumns(context, {
    model,
    view,
    includeSortAndFilterColumns,
  });

  const rowColoringColumnIds = new Set<string>();
  if (view && includeRowColorColumns) {
    const addingColumns = await getViewRowColorFields({ context, view });
    for (const addColumn of addingColumns) {
      rowColoringColumnIds.add(addColumn);
    }
  }

  const buttonFilterColumnIds = new Set<string>();
  if (view && includeButtonFilterColumns) {
    const addingColumns = await getButtonFilterFields({ context, model, view });
    for (const addColumn of addingColumns) {
      buttonFilterColumnIds.add(addColumn);
    }
  }

  // extract only pk and pv
  if (extractOnlyPrimaries) {
    const ast: Ast = {
      ...(model.primaryKeys
        ? model.primaryKeys.reduce(
            (o, pk) => ({ ...o, [getFieldKey(pk)]: 1 }),
            {},
          )
        : {}),
      ...(model.displayValue ? { [getFieldKey(model.displayValue)]: 1 } : {}),
    };
    await Promise.all(
      model.primaryKeys.map((c) =>
        extractDependencies(context, c, dependencyFields),
      ),
    );

    await extractDependencies(context, model.displayValue, dependencyFields);

    // Include custom display value column if specified by the parent LTAR relation
    if (fk_display_value_column_id) {
      const customDisplayCol = model.columns?.find(
        (c) => c.id === fk_display_value_column_id,
      );
      if (customDisplayCol) {
        ast[getFieldKey(customDisplayCol)] = 1;
        await extractDependencies(context, customDisplayCol, dependencyFields);
      }
    }

    return { ast, dependencyFields, parsedQuery: dependencyFields };
  }

  if (extractOnlyRangeFields) {
    const ast: Ast = {
      ...(dependencyFieldsForRangeView || []).reduce((o, f) => {
        const col = model.columns.find((c) => c.id === f);
        return { ...o, [getFieldKey(col)]: 1 };
      }, {}),
    };

    await Promise.all(
      (dependencyFieldsForRangeView || []).map((f) =>
        extractDependencies(
          context,
          model.columns.find((c) => c.id === f),
          dependencyFields,
        ),
      ),
    );

    return { ast, dependencyFields, parsedQuery: dependencyFields };
  }

  let fields = query?.fields || query?.f;
  if (fields && fields !== '*') {
    fields = Array.isArray(fields) ? fields : fields.split(',');
    if (throwErrorIfInvalidParams) {
      const colAliasMap = await model.getColAliasMapping(context);
      const aliasColMap = await model.getAliasColObjMap(context);
      const invalidFields = fields.filter(
        (f) => !colAliasMap[f] && !aliasColMap[f],
      );
      if (invalidFields.length) {
        NcError.get(context).fieldNotFound(invalidFields.join(', '));
      }
    }
  } else {
    fields = null;
  }

  const columns = model.columns;

  // Collected with the broad strategy-result type; narrowed to `Ast` on return.
  const ast: Record<string, AstResult> = {};

  // Shared inputs for the per-column strategy chain (see getAstColumnStrategy).
  const astCtx: ColumnAstContext = {
    model,
    view,
    apiVersion,
    getHiddenColumn,
    extractOrderColumn,
    includePkByDefault,
    fields,
    allowedCols,
    rowColoringColumnIds,
    buttonFilterColumnIds,
    dependencyFieldsForRangeView,
    allowRequestedHiddenFields,
  };

  for (const col of columns) {
    // #14229: on a bounded (single-query) nested relation read, drop every
    // column that resolves by reading related rows, since each one re-enters
    // postProcessData. Everything else resolves within this one SELECT and is
    // kept (scalars/Rollup/Links-count/Formula/…). Root reads
    // (skipRelationExpansion=false) still expand relations fully.
    // Exception (targeted expansion): keep a column an outer lookup chain needs
    // (requiredColumnIds) so a deep lookup→lookup chain resolves without
    // expanding every unrelated relation column here.
    if (
      skipRelationExpansion &&
      (col.uidt === UITypes.LinkToAnotherRecord ||
        col.uidt === UITypes.Lookup ||
        // A V2 junction mo/bt/oo link is a `Links` column, but getProto serves
        // it under the bare title as a record read rather than a `_nc_lk_`
        // count (select-object skips its rollup), so it recurses like an LTAR.
        (col.uidt === UITypes.Links && isBtLikeV2Junction(col))) &&
      !requiredColumnIds?.has(col.id)
    ) {
      ast[getFieldKey(col)] = null;
      continue;
    }

    let value: number | boolean | { [key: string]: any } = 1;
    // TODO: also get from col.id
    const nestedFields =
      query?.nested?.[col.title]?.fields || query?.nested?.[col.title]?.f;
    // Outside the junction case above, a Links column expands into related rows
    // only via linksAsLtar; on a bounded read force it back to a plain count.
    const linksAsLtar = !skipRelationExpansion && query?.linksAsLtar === 'true';

    if (nestedFields && nestedFields !== '*') {
      if (
        col.uidt === UITypes.LinkToAnotherRecord ||
        (col.uidt === UITypes.Links && linksAsLtar)
      ) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );

        if (!colOpt) {
          logger.warn(
            `Skipping column ${col.title}: LTAR colOptions missing for column ${col.id}`,
          );
          ast[getFieldKey(col)] = null;
          continue;
        }

        const model = await colOpt.getRelatedTable(context);

        if (!model) {
          // Skip this column - related table not found
          // This allows data retrieval to continue even with broken relations
          logger.warn(
            `Skipping column ${col.title}: related table ${colOpt.fk_related_model_id} not found`,
          );
          ast[getFieldKey(col)] = null;
          continue;
        }

        const { refContext: refTableContext } = colOpt.getRelContext(context);

        const { ast: childAst } = await getAst(refTableContext, {
          model,
          query: query?.nested?.[col.title],
          fk_display_value_column_id: colOpt.fk_display_value_column_id,
          dependencyFields: (dependencyFields.nested[col.title] =
            dependencyFields.nested[col.title] || {
              nested: {},
              fieldsSet: new Set(),
            }),
          throwErrorIfInvalidParams,
          _depth: _depth + 1,
        });

        value = childAst;

        // todo: include field relative to the relation => pk / fk
      } else if (col.uidt === UITypes.Links) {
        value = 1;
      } else {
        value = (
          Array.isArray(nestedFields) ? nestedFields : nestedFields.split(',')
        ).reduce((o, f) => ({ ...o, [f]: 1 }), {});
      }
    } else if (
      col.uidt === UITypes.LinkToAnotherRecord ||
      (col.uidt === UITypes.Links && linksAsLtar)
    ) {
      const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );

      if (!colOpt) {
        logger.warn(
          `Skipping column ${col.title}: LTAR colOptions missing for column ${col.id}`,
        );
        ast[getFieldKey(col)] = null;
        continue;
      }

      const { refContext: refTableContext } = colOpt.getRelContext(context);

      const model = await colOpt.getRelatedTable(context);

      if (!model) {
        // Skip this column - related table not found
        // This allows data retrieval to continue even with broken relations
        logger.warn(
          `Skipping column ${col.title}: related table ${colOpt.fk_related_model_id} not found`,
        );
        ast[getFieldKey(col)] = null;
        continue;
      }

      value = (
        await getAst(refTableContext, {
          model,
          query: query?.nested?.[col.title],
          extractOnlyPrimaries: nestedFields !== '*',
          fk_display_value_column_id: colOpt.fk_display_value_column_id,
          dependencyFields: (dependencyFields.nested[col.title] =
            dependencyFields.nested[col.title] || {
              nested: {},
              fieldsSet: new Set(),
            }),
          throwErrorIfInvalidParams,
          _depth: _depth + 1,
        })
      ).ast;
    }
    const isInFields = !!(
      fields?.length &&
      (fields.includes(col.title) || fields.includes(col.id))
    );
    const isSortOrFilterColumn = !!(
      includeSortAndFilterColumns &&
      (sortColumnIds.includes(col.id) || filterColumnIds.includes(col.id))
    );

    // Decide inclusion via the ordered strategy chain (first match wins).
    const isRequested = resolveColumnAst(astCtx, {
      col,
      value,
      isInFields,
      isSortOrFilterColumn,
    });

    if (isRequested || col.pk)
      await extractDependencies(context, col, dependencyFields);

    ast[getFieldKey(col)] = isRequested;
  }

  // Narrow back to `Ast`: falsy entries are runtime-only "not requested" markers
  // that `nocoExecute` ignores; the exposed shape stays `1 | true | null | Ast`.
  return { ast: ast as Ast, dependencyFields, parsedQuery: dependencyFields };
};

const getViewRowColorFields = async (params: {
  context: NcContext;
  view: View;
  ncMeta?: MetaService;
}) => {
  if (params.view.row_coloring_mode === ROW_COLORING_MODE.SELECT) {
    const viewMeta = parseProp(params.view.meta) as ViewMetaRowColoring;
    return [viewMeta?.rowColoringInfo?.fk_column_id];
  } else if (params.view.row_coloring_mode === ROW_COLORING_MODE.FILTER) {
    const ncMeta = params.ncMeta ?? Noco.ncMeta;
    const rowColorConditions = await RowColorCondition.getByViewId(
      params.context,
      params.view.id,
    );
    const filters = await ncMeta.metaList2(
      params.context.workspace_id,
      params.context.base_id,
      MetaTable.FILTER_EXP,
      {
        xcCondition: (knex) =>
          knex.whereIn(
            'fk_row_color_condition_id',
            rowColorConditions.map((k) => k.id),
          ),
      },
    );
    return filters
      .filter((f) => f.fk_column_id)
      .map((f) => f.fk_column_id as string)
      .filter((value, index, array) => array.indexOf(value) === index);
  }
  return [] as string[];
};

/**
 * Returns the column IDs referenced by button visibility filters across all
 * button columns in the table.  This ensures hidden columns used in button
 * filter conditions are still included in the API response.
 */
const getButtonFilterFields = async (params: {
  context: NcContext;
  model: Model;
  view?: View;
  ncMeta?: MetaService;
}): Promise<string[]> => {
  const ncMeta = params.ncMeta ?? Noco.ncMeta;

  // Find all button columns in this table
  if (!params.model.columns?.length)
    await params.model.getColumns(params.context);

  let buttonColIds = params.model.columns
    .filter((col) => col.uidt === UITypes.Button)
    .map((col) => col.id);

  // If a view is provided, only include button columns visible in the view
  if (params.view && buttonColIds.length) {
    const viewColumns = await View.getColumns(params.context, params.view.id);
    const visibleColIds = new Set(
      viewColumns.filter((vc) => vc.show).map((vc) => vc.fk_column_id),
    );
    buttonColIds = buttonColIds.filter((id) => visibleColIds.has(id));
  }

  if (!buttonColIds.length) return [];

  // Fetch all filters that belong to these button columns
  const filters = await ncMeta.metaList2(
    params.context.workspace_id,
    params.context.base_id,
    MetaTable.FILTER_EXP,
    {
      xcCondition: (knex) => knex.whereIn('fk_button_col_id', buttonColIds),
    },
  );

  return filters
    .filter((f) => f.fk_column_id)
    .map((f) => f.fk_column_id as string)
    .filter((value, index, array) => array.indexOf(value) === index);
};

const extractDependencies = async (
  context: NcContext,
  column: Column,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
  _visited: Set<string> = new Set(),
) => {
  // Cycle guard: a Lookup chain that loops back on itself (A→B→A) would
  // recurse forever and either blow the JS stack or, worse, build a SELECT
  // QueryBuilder that contains itself — which is what trips the Knex
  // `columnize → wrap → toSQL → unwrapRaw → wrap` infinite loop seen in
  // production. Skip a column we've already walked.
  if (!column?.id) return;
  if (_visited.has(column.id)) {
    logger.warn(
      `extractDependencies cycle: column ${column.id} (${column.title}) ` +
        `already visited in this dependency walk. Breaking to avoid recursion.`,
    );
    return;
  }
  _visited.add(column.id);

  switch (column?.uidt) {
    case UITypes.Lookup:
      await extractLookupDependencies(
        context,
        column,
        dependencyFields,
        _visited,
      );
      break;
    case UITypes.LinkToAnotherRecord:
      await extractRelationDependencies(context, column, dependencyFields);
      break;
    default:
      dependencyFields.fieldsSet.add(column.title);
      break;
  }
};

const extractLookupDependencies = async (
  context: NcContext,
  lookUpColumn: Column<LookupColumn>,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
  _visited: Set<string> = new Set(),
) => {
  const lookupColumnOpts = await lookUpColumn.getColOptions(context);
  if (lookupColumnOpts?.error) return;
  const relationColumn = await lookupColumnOpts.getRelationColumn(context);
  if (!relationColumn) return;
  const relationColumnOpts =
    await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
  if (!relationColumnOpts) return;
  const { refContext } = relationColumnOpts.getRelContext(context);
  await extractRelationDependencies(context, relationColumn, dependencyFields);

  // Reuse the nested bucket for the relation column if one already exists. It
  // may have been seeded from the request query (e.g. the export's
  // `buildNestedLinkLimitQuery` puts a `{ limit }` object under every link
  // column's title) and therefore lack `nested`/`fieldsSet`. Normalize both —
  // `extractDependencies` writes straight to `fieldsSet.add(...)` and, unlike
  // `getAst`, never defaults it, so a missing set would crash.
  dependencyFields.nested[relationColumn.title] =
    dependencyFields.nested[relationColumn.title] || {};
  const nestedDependencyFields = dependencyFields.nested[relationColumn.title];
  nestedDependencyFields.nested = nestedDependencyFields.nested || {};
  nestedDependencyFields.fieldsSet =
    nestedDependencyFields.fieldsSet || new Set();

  await extractDependencies(
    refContext,
    await lookupColumnOpts.getLookupColumn(refContext),
    nestedDependencyFields,
    _visited,
  );
};

const extractRelationDependencies = async (
  context: NcContext,
  relationColumn: Column<LinkToAnotherRecordColumn>,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  const relationColumnOpts = await relationColumn.getColOptions(context);
  if (!relationColumnOpts) return;

  switch (relationColumnOpts.type) {
    case RelationTypes.HAS_MANY:
      dependencyFields.fieldsSet.add(
        await relationColumnOpts
          .getParentColumn(context)
          .then((col) => col.title),
      );
      break;
    case RelationTypes.BELONGS_TO:
    case RelationTypes.MANY_TO_MANY:
      dependencyFields.fieldsSet.add(
        await relationColumnOpts
          .getChildColumn(context)
          .then((col) => col.title),
      );
      break;
    case RelationTypes.ONE_TO_ONE:
      if (relationColumn.meta?.bt) {
        dependencyFields.fieldsSet.add(
          await relationColumnOpts
            .getChildColumn(context)
            .then((col) => col.title),
        );
      } else {
        dependencyFields.fieldsSet.add(
          await relationColumnOpts
            .getParentColumn(context)
            .then((col) => col.title),
        );
      }
      break;
  }
};

export type RequestQuery = {
  [fields in 'f' | 'fields']?: string | string[];
} & {
  nested?: {
    [field: string]: RequestQuery;
  };
  linksAsLtar?: string;
};

export interface DependantFields {
  fieldsSet?: Set<string>;
  nested?: { [key: string]: DependantFields };
}

export default getAst;
