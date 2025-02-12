import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isOrderCol,
  isSystemColumn,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import { NcApiVersion } from 'nocodb-sdk';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
} from '~/models';
import type { NcContext } from '~/interface/config';
import {
  CalendarRange,
  GalleryView,
  GridViewColumn,
  KanbanView,
  KanbanViewColumn,
  View,
} from '~/models';
import { NcError } from '~/helpers/catchError';

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
    getHiddenColumn = query?.['getHiddenColumn'],
    throwErrorIfInvalidParams = false,
    extractOnlyRangeFields = false,
    apiVersion = NcApiVersion.V2,
    extractOrderColumn = false,
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
  },
): Promise<{
  ast: Ast;
  dependencyFields: DependantFields;
  parsedQuery: DependantFields;
}> => {
  // set default values of dependencyFields and nested
  dependencyFields.nested = dependencyFields.nested || {};
  dependencyFields.fieldsSet = dependencyFields.fieldsSet || new Set();

  let coverImageId;
  let dependencyFieldsForCalenderView;
  let kanbanGroupColumnId;
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

  if (!model.columns?.length) await model.getColumns(context);

  // extract only pk and pv
  if (extractOnlyPrimaries) {
    const ast: Ast = {
      ...(model.primaryKeys
        ? model.primaryKeys.reduce((o, pk) => ({ ...o, [pk.title]: 1 }), {})
        : {}),
      ...(model.displayValue ? { [model.displayValue.title]: 1 } : {}),
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
        return { ...o, [col.title]: 1 };
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
        NcError.fieldNotFound(invalidFields.join(', '));
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
  }

  const columns = model.columns;

  const ast: Ast = await columns.reduce(async (obj, col: Column) => {
    let value: number | boolean | { [key: string]: any } = 1;
    const nestedFields =
      query?.nested?.[col.title]?.fields || query?.nested?.[col.title]?.f;
    if (nestedFields && nestedFields !== '*') {
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        const model = await col
          .getColOptions<LinkToAnotherRecordColumn>(context)
          .then((colOpt) => colOpt.getRelatedTable(context));

        const { ast } = await getAst(context, {
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
      const model = await col
        .getColOptions<LinkToAnotherRecordColumn>(context)
        .then((colOpt) => colOpt.getRelatedTable(context));

      value = (
        await getAst(context, {
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

    const isForeignKey = col.uidt === UITypes.ForeignKey;
    const isInFields = fields?.length && fields.includes(col.title);

    // exclude system column and foreign key from API response for v3
    if ((col.system || isForeignKey) && apiVersion === NcApiVersion.V3) {
      isRequested = false;
    } else if (isCreatedOrLastModifiedByCol(col) && col.system) {
      isRequested = false;
    } else if (isOrderCol(col) && col.system) {
      isRequested = extractOrderColumn || getHiddenColumn;
    } else if (getHiddenColumn) {
      isRequested =
        !isSystemColumn(col) ||
        (isCreatedOrLastModifiedTimeCol(col) && col.system) ||
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
      isRequested = isInFields && value;
    } else {
      isRequested = value;
    }

    if (isRequested || col.pk)
      await extractDependencies(context, col, dependencyFields);

    return {
      ...(await obj),
      [col.title]: isRequested,
    };
  }, Promise.resolve({}));

  return { ast, dependencyFields, parsedQuery: dependencyFields };
};

const extractDependencies = async (
  context: NcContext,
  column: Column,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  switch (column.uidt) {
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
  await extractRelationDependencies(context, relationColumn, dependencyFields);
  await extractDependencies(
    context,
    await lookupColumnOpts.getLookupColumn(context),
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

type RequestQuery = {
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
