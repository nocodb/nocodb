import {
  isCreatedOrLastModifiedByCol,
  isCreatedOrLastModifiedTimeCol,
  isSystemColumn,
  RelationTypes,
  UITypes,
  ViewTypes,
} from 'nocodb-sdk';
import type {
  Column,
  LinkToAnotherRecordColumn,
  LookupColumn,
  Model,
} from '~/models';
import { NcError } from '~/helpers/catchError';
import { CalendarRange, GalleryView, KanbanView, View } from '~/models';

const getAst = async ({
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
}) => {
  // set default values of dependencyFields and nested
  dependencyFields.nested = dependencyFields.nested || {};
  dependencyFields.fieldsSet = dependencyFields.fieldsSet || new Set();

  let coverImageId;
  let dependencyFieldsForCalenderView;
  if (view && view.type === ViewTypes.GALLERY) {
    const gallery = await GalleryView.get(view.id);
    coverImageId = gallery.fk_cover_image_col_id;
  } else if (view && view.type === ViewTypes.KANBAN) {
    const kanban = await KanbanView.get(view.id);
    coverImageId = kanban.fk_cover_image_col_id;
  } else if (view && view.type === ViewTypes.CALENDAR) {
    // const calendar = await CalendarView.get(view.id);
    // coverImageId = calendar.fk_cover_image_col_id;
    const calenderRanges = await CalendarRange.read(view.id);
    if (calenderRanges) {
      dependencyFieldsForCalenderView = calenderRanges.ranges
        .flatMap((obj) =>
          [obj.fk_from_column_id, (obj as any).fk_to_column_id].filter(Boolean),
        )
        .map(String);
    }
  }

  if (!model.columns?.length) await model.getColumns();

  // extract only pk and pv
  if (extractOnlyPrimaries) {
    const ast = {
      ...(model.primaryKeys
        ? model.primaryKeys.reduce((o, pk) => ({ ...o, [pk.title]: 1 }), {})
        : {}),
      ...(model.displayValue ? { [model.displayValue.title]: 1 } : {}),
    };
    await Promise.all(
      model.primaryKeys.map((c) => extractDependencies(c, dependencyFields)),
    );

    await extractDependencies(model.displayValue, dependencyFields);

    return { ast, dependencyFields, parsedQuery: dependencyFields };
  }

  if (extractOnlyRangeFields) {
    const ast = {
      ...(dependencyFieldsForCalenderView || []).reduce((o, f) => {
        const col = model.columns.find((c) => c.id === f);
        return { ...o, [col.title]: 1 };
      }, {}),
    };

    await Promise.all(
      (dependencyFieldsForCalenderView || []).map((f) =>
        extractDependencies(
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
      const colAliasMap = await model.getColAliasMapping();
      const aliasColMap = await model.getAliasColObjMap();
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
    allowedCols = (await View.getColumns(view.id)).reduce(
      (o, c) => ({
        ...o,
        [c.fk_column_id]: c.show,
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

  const ast = await model.columns.reduce(async (obj, col: Column) => {
    let value: number | boolean | { [key: string]: any } = 1;
    const nestedFields =
      query?.nested?.[col.title]?.fields || query?.nested?.[col.title]?.f;
    if (nestedFields && nestedFields !== '*') {
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        const model = await col
          .getColOptions<LinkToAnotherRecordColumn>()
          .then((colOpt) => colOpt.getRelatedTable());

        const { ast } = await getAst({
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
        .getColOptions<LinkToAnotherRecordColumn>()
        .then((colOpt) => colOpt.getRelatedTable());

      value = (
        await getAst({
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

    if (isCreatedOrLastModifiedByCol(col) && col.system) {
      isRequested = false;
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
          col.pv) &&
        (!fields?.length || fields.includes(col.title)) &&
        value;
    } else if (fields?.length) {
      isRequested = fields.includes(col.title) && value;
    } else {
      isRequested = value;
    }

    if (isRequested || col.pk) await extractDependencies(col, dependencyFields);

    return {
      ...(await obj),
      [col.title]: isRequested,
    };
  }, Promise.resolve({}));

  return { ast, dependencyFields, parsedQuery: dependencyFields };
};

const extractDependencies = async (
  column: Column,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  switch (column.uidt) {
    case UITypes.Lookup:
      await extractLookupDependencies(column, dependencyFields);
      break;
    case UITypes.LinkToAnotherRecord:
      await extractRelationDependencies(column, dependencyFields);
      break;
    default:
      dependencyFields.fieldsSet.add(column.title);
      break;
  }
};

const extractLookupDependencies = async (
  lookUpColumn: Column<LookupColumn>,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  const lookupColumnOpts = await lookUpColumn.getColOptions();
  const relationColumn = await lookupColumnOpts.getRelationColumn();
  await extractRelationDependencies(relationColumn, dependencyFields);
  await extractDependencies(
    await lookupColumnOpts.getLookupColumn(),
    (dependencyFields.nested[relationColumn.title] = dependencyFields.nested[
      relationColumn.title
    ] || {
      nested: {},
      fieldsSet: new Set(),
    }),
  );
};

const extractRelationDependencies = async (
  relationColumn: Column<LinkToAnotherRecordColumn>,
  dependencyFields: DependantFields = {
    nested: {},
    fieldsSet: new Set(),
  },
) => {
  const relationColumnOpts = await relationColumn.getColOptions();

  switch (relationColumnOpts.type) {
    case RelationTypes.HAS_MANY:
      dependencyFields.fieldsSet.add(
        await relationColumnOpts.getParentColumn().then((col) => col.title),
      );
      break;
    case RelationTypes.BELONGS_TO:
    case RelationTypes.MANY_TO_MANY:
      dependencyFields.fieldsSet.add(
        await relationColumnOpts.getChildColumn().then((col) => col.title),
      );
      break;
    case RelationTypes.ONE_TO_ONE:
      if (relationColumn.meta?.bt) {
        dependencyFields.fieldsSet.add(
          await relationColumnOpts.getChildColumn().then((col) => col.title),
        );
      } else {
        dependencyFields.fieldsSet.add(
          await relationColumnOpts.getParentColumn().then((col) => col.title),
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
  nested?: DependantFields;
}

export default getAst;
