import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isLinksOrLTAR,
  isOrderCol,
  isSystemColumn,
  NcApiVersion,
  parseProp,
  RelationTypes,
  ROW_COLORING_MODE,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type { NcContext } from '~/interface/config';
import type { MetaService } from '~/meta/meta.service';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
} from '~/models';
import type { ViewMetaRowColoring } from '~/models/View';
import { MetaTable } from '~/cli';
import { NcError } from '~/helpers/catchError';
import {
  CalendarRange,
  Filter,
  GalleryView,
  GridViewColumn,
  KanbanView,
  KanbanViewColumn,
  View,
} from '~/models';
import RowColorCondition from '~/models/RowColorCondition';
import Noco from '~/Noco';

type Ast = {
  [key: string]: 1 | true | null | Ast;
};

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
    skipSubstitutingColumnIds = false,
  }: {
    query?: RequestQuery;
    extractOnlyPrimaries?: boolean;
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
    skipSubstitutingColumnIds?: boolean;
  },
): Promise<{
  ast: Ast;
  dependencyFields: DependantFields;
  parsedQuery: DependantFields;
}> => {
  // set default values of dependencyFields and nested
  dependencyFields.nested = dependencyFields.nested || {};
  dependencyFields.fieldsSet = dependencyFields.fieldsSet || new Set();

  const getFieldKey = (col: Column) => {
    return skipSubstitutingColumnIds ? col.id : col.title;
  };

  let coverImageId;
  let dependencyFieldsForCalenderView;
  let kanbanGroupColumnId;
  let sortColumnIds: string[] = [];
  let filterColumnIds: string[] = [];
  if (view && view.type === ViewTypes.GALLERY) {
    const gallery = await GalleryView.get(context, view.id);
    coverImageId = gallery.fk_cover_image_col_id;
  } else if (view && view.type === ViewTypes.KANBAN) {
    const kanban = await KanbanView.get(context, view.id);
    coverImageId = kanban.fk_cover_image_col_id;
    kanbanGroupColumnId = kanban.fk_grp_col_id;
  } else if (view && view.type === ViewTypes.CALENDAR) {
    // const calendar = await CalendarView.get(view.id);
    // coverImageId = calendar.fk_cover_image_col_id;
    const calenderRanges = await CalendarRange.read(context, view.id);
    if (calenderRanges) {
      dependencyFieldsForCalenderView = calenderRanges.ranges
        .flatMap((obj) =>
          [obj.fk_from_column_id, (obj as any).fk_to_column_id].filter(Boolean),
        )
        .map(String);
    }
  }

  if (view && includeSortAndFilterColumns) {
    const sorts = await view.getSorts(context);
    const filters = await Filter.allViewFilterList(context, {
      viewId: view.id,
    });
    sortColumnIds = sorts.map((s) => s.fk_column_id);
    filterColumnIds = filters.map((f) => f.fk_column_id);
  }

  if (!model.columns?.length) await model.getColumns(context);

  const rowColoringColumnIds = new Set<string>();
  if (view && includeRowColorColumns) {
    const addingColumns = await getViewRowColorFields({ context, view });
    for (const addColumn of addingColumns) {
      rowColoringColumnIds.add(addColumn);
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

    return { ast, dependencyFields, parsedQuery: dependencyFields };
  }

  if (extractOnlyRangeFields) {
    const ast: Ast = {
      ...(dependencyFieldsForCalenderView || []).reduce((o, f) => {
        const col = model.columns.find((c) => c.id === f);
        return { ...o, [getFieldKey(col)]: 1 };
      }, {}),
    };

    await Promise.all(
      (dependencyFieldsForCalenderView || []).map((f) =>
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

  let allowedCols = null;
  if (view) {
    allowedCols = (await View.getColumns(context, view.id)).reduce(
      (o, c) => ({
        ...o,
        [c.fk_column_id]:
          c.show ||
          (c instanceof GridViewColumn && c.group_by) ||
          (c instanceof KanbanViewColumn &&
            c.fk_column_id === kanbanGroupColumnId),
      }),
      {},
    );
    if (coverImageId) {
      allowedCols[coverImageId] = 1;
    }
    if (dependencyFieldsForCalenderView) {
      dependencyFieldsForCalenderView.forEach((id) => {
        allowedCols[id] = 1;
      });
    }
    if (includeSortAndFilterColumns) {
      sortColumnIds.forEach((id) => (allowedCols[id] = 1));
      filterColumnIds.forEach((id) => (allowedCols[id] = 1));
    }
  }

  const columns = model.columns;

  const ast: Ast = await columns.reduce(async (obj, col: Column) => {
    let value: number | boolean | { [key: string]: any } = 1;
    // TODO: also get from col.id
    const nestedFields =
      query?.nested?.[col.title]?.fields || query?.nested?.[col.title]?.f;
    if (nestedFields && nestedFields !== '*') {
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
          context,
        );
        const model = await colOpt.getRelatedTable(context);

        const { refContext: refTableContext } = colOpt.getRelContext(context);

        const { ast } = await getAst(refTableContext, {
          model,
          query: query?.nested?.[col.title],
          dependencyFields: (dependencyFields.nested[col.title] =
            dependencyFields.nested[col.title] || {
              nested: {},
              fieldsSet: new Set(),
            }),
          throwErrorIfInvalidParams,
        });

        value = ast;

        // todo: include field relative to the relation => pk / fk
      } else if (col.uidt === UITypes.Links) {
        value = 1;
      } else {
        value = (
          Array.isArray(nestedFields) ? nestedFields : nestedFields.split(',')
        ).reduce((o, f) => ({ ...o, [f]: 1 }), {});
      }
    } else if (col.uidt === UITypes.LinkToAnotherRecord) {
      const colOpt = await col.getColOptions<LinkToAnotherRecordColumn>(
        context,
      );

      const { refContext: refTableContext } = colOpt.getRelContext(context);

      const model = await colOpt.getRelatedTable(context);

      value = (
        await getAst(refTableContext, {
          model,
          query: query?.nested?.[col.title],
          extractOnlyPrimaries: nestedFields !== '*',
          dependencyFields: (dependencyFields.nested[col.title] =
            dependencyFields.nested[col.title] || {
              nested: {},
              fieldsSet: new Set(),
            }),
          throwErrorIfInvalidParams,
        })
      ).ast;
    }
    let isRequested;

    const isInFields =
      fields?.length && (fields.includes(col.title) || fields.includes(col.id));
    const isSortOrFilterColumn =
      includeSortAndFilterColumns &&
      (sortColumnIds.includes(col.id) || filterColumnIds.includes(col.id));

    if (isSortOrFilterColumn) {
      isRequested = true;
    } else if (rowColoringColumnIds.has(col.id)) {
      isRequested = true;
    }
    // exclude system column and foreign key from API response for v3
    else if (
      col.system &&
      ![UITypes.CreatedTime, UITypes.LastModifiedTime].includes(col.uidt) &&
      apiVersion === NcApiVersion.V3
    ) {
      isRequested = false;
    } else if (isCreatedOrLastModifiedByCol(col) && col.system) {
      isRequested = false;
    } else if (isOrderCol(col) && col.system) {
      isRequested = extractOrderColumn || getHiddenColumn;
    } else if (getHiddenColumn) {
      isRequested =
        !isSystemColumn(col) ||
        (isCreatedOrLastModifiedTimeCol(col) && col.system) ||
        // include all non-has-many system links(self-link) columns since has-many is part of mm relation and which is not required
        (isLinksOrLTAR(col) &&
          col.system &&
          [
            RelationTypes.BELONGS_TO,
            RelationTypes.MANY_TO_MANY,
            RelationTypes.ONE_TO_ONE,
          ].includes(
            (col.colOptions as LinkToAnotherRecordColumn)
              ?.type as RelationTypes,
          )) ||
        col.pk;
    } else if (allowedCols && (!includePkByDefault || !col.pk)) {
      isRequested =
        allowedCols[col.id] &&
        (!isSystemColumn(col) ||
          (!view && isCreatedOrLastModifiedTimeCol(col)) ||
          view.show_system_fields ||
          (dependencyFieldsForCalenderView ?? []).includes(col.id) ||
          col.pv) &&
        (!fields?.length || isInFields) &&
        value;
    } else if (fields?.length) {
      // For APIv3, always extract primary key dependencies even if not explicitly requested
      // This is needed because APIv3 always returns the primary key as 'id' at root level
      isRequested =
        (isInFields && value) || (apiVersion === NcApiVersion.V3 && col.pk);
    } else {
      isRequested = value;
    }

    if (isRequested || col.pk)
      await extractDependencies(context, col, dependencyFields);

    return {
      ...(await obj),
      [getFieldKey(col)]: isRequested,
    };
  }, Promise.resolve({}));

  return { ast, dependencyFields, parsedQuery: dependencyFields };
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

const extractDependencies = async (
  context: NcContext,
  column: Column,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  switch (column?.uidt) {
    case UITypes.Lookup:
      await extractLookupDependencies(context, column, dependencyFields);
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
) => {
  const lookupColumnOpts = await lookUpColumn.getColOptions(context);
  const relationColumn = await lookupColumnOpts.getRelationColumn(context);
  const relationColumnOpts =
    await relationColumn.getColOptions<LinkToAnotherRecordColumn>(context);
  const { refContext } = relationColumnOpts.getRelContext(context);
  await extractRelationDependencies(
    refContext,
    relationColumn,
    dependencyFields,
  );
  await extractDependencies(
    context,
    await lookupColumnOpts.getLookupColumn(refContext),
    (dependencyFields.nested[relationColumn.title] = dependencyFields.nested[
      relationColumn.title
    ] || {
      nested: {},
      fieldsSet: new Set(),
    }),
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
};

export interface DependantFields {
  fieldsSet?: Set<string>;
  nested?: { [key: string]: DependantFields };
}

export default getAst;
