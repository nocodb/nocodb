import View from '../../../../../models/View';
import { isSystemColumn, UITypes } from 'nocodb-sdk';
import type Model from '../../../../../models/Model';
import type LinkToAnotherRecordColumn from '../../../../../models/LinkToAnotherRecordColumn';

const getAst = async ({
  query,
  extractOnlyPrimaries = false,
  includePkByDefault = true,
  model,
  view,
}: {
  query?: RequestQuery;
  extractOnlyPrimaries?: boolean;
  includePkByDefault?: boolean;
  model: Model;
  view?: View;
}) => {
  if (!model.columns?.length) await model.getColumns();

  // extract only pk and pv
  if (extractOnlyPrimaries) {
    return {
      ...(model.primaryKeys
        ? model.primaryKeys.reduce((o, pk) => ({ ...o, [pk.title]: 1 }), {})
        : {}),
      ...(model.displayValue ? { [model.displayValue.title]: 1 } : {}),
    };
  }

  let fields = query?.fields || query?.f;
  if (fields && fields !== '*') {
    fields = Array.isArray(fields) ? fields : fields.split(',');
  } else {
    fields = null;
  }

  let allowedCols = null;
  if (view)
    allowedCols = (await View.getColumns(view.id)).reduce(
      (o, c) => ({
        ...o,
        [c.fk_column_id]: c.show,
      }),
      {}
    );

  return model.columns.reduce(async (obj, col) => {
    let value: number | boolean | { [key: string]: any } = 1;
    const nestedFields =
      query?.nested?.[col.title]?.fields || query?.nested?.[col.title]?.f;
    if (nestedFields && nestedFields !== '*') {
      if (col.uidt === UITypes.LinkToAnotherRecord) {
        const model = await col
          .getColOptions<LinkToAnotherRecordColumn>()
          .then((colOpt) => colOpt.getRelatedTable());

        value = await getAst({
          model,
          query: query?.nested?.[col.title],
        });
      } else {
        value = (Array.isArray(fields) ? fields : fields.split(',')).reduce(
          (o, f) => ({ ...o, [f]: 1 }),
          {}
        );
      }
    } else if (col.uidt === UITypes.LinkToAnotherRecord) {
      const model = await col
        .getColOptions<LinkToAnotherRecordColumn>()
        .then((colOpt) => colOpt.getRelatedTable());

      value = await getAst({
        model,
        query: query?.nested?.[col.title],
        extractOnlyPrimaries: nestedFields !== '*',
      });
    }

    return {
      ...(await obj),
      [col.title]:
        allowedCols && (!includePkByDefault || !col.pk)
          ? allowedCols[col.id] &&
            (!isSystemColumn(col) || view.show_system_fields) &&
            (!fields?.length || fields.includes(col.title)) &&
            value
          : fields?.length
          ? fields.includes(col.title) && value
          : value,
    };
  }, Promise.resolve({}));
};

type RequestQuery = {
  [fields in 'f' | 'fields']?: string | string[];
} & {
  nested?: {
    [field: string]: RequestQuery;
  };
};

export default getAst;
