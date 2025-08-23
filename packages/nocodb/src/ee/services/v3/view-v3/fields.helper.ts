import {
  type NcContext,
  ncIsNullOrUndefined,
  type NcRequest,
  type ViewCreateV3Type,
} from 'nocodb-sdk';
import type { MetaService } from '~/meta/meta.service';
import { Model } from '~/models';

export const handleFieldsRequestBody = async (
  context: NcContext,
  param: {
    req: NcRequest;
    tableId: string;
    modelColumns?: { id: string; pv: boolean; order: number }[];
    fields?: ViewCreateV3Type['fields'];
  },
  ncMeta?: MetaService,
) => {
  const result: Record<
    string,
    {
      width?: string;
      show?: boolean;
      order?: number;
    } & Record<string, any>
  > = {};
  if (ncIsNullOrUndefined(param.fields)) {
    return {};
  }
  const modelColumns =
    param.modelColumns ??
    (await (
      await Model.get(context, param.tableId, ncMeta)
    ).getColumns(context, ncMeta));

  // when given empty array, every column except pv is show = false
  if (Array.isArray(param.fields) && param.fields.length === 0) {
    for (const nonPvField of modelColumns.filter((col) => !col.pv)) {
      result[nonPvField.id] = {
        show: false,
      };
    }
  } else if (Array.isArray(param.fields) && param.fields.length > 0) {
    const pvColumn = modelColumns.find((col) => col.pv);
    // get pv field on request payload
    const pvFieldPayload = param.fields.find(
      (col) => col.field_id === pvColumn.id,
    );
    // if pvField exists in request payload, set only if it has width
    if (pvFieldPayload && pvFieldPayload.width) {
      result[pvFieldPayload.field_id] = {
        show: true,
        width: pvFieldPayload.width + 'px',
      };
    }

    // we get the order by array index
    const orderedFieldMap = param.fields
      .filter((col) => col.field_id !== pvColumn?.id)
      .reduce((acc, val, idx) => {
        const width =
          val.width && !isNaN(Number(val.width)) ? val.width + 'px' : undefined;
        acc[val.field_id] = {
          ...val,
          order: idx + 2,
          ...(width ? { width } : {}),
        };
        return acc;
      }, {});

    // get the next orders by array index + length
    // for the rest of the columns not mentioned in ordered field map
    const unorderedFieldMap = modelColumns
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER),
      )
      .map((k) => k.id)
      .filter((id) => !orderedFieldMap[id] && id !== pvColumn?.id)
      .reduce((cur, id, idx) => {
        cur[id] = {
          order: idx + (param.fields ?? []).length + 2,
          show: false,
        };
        return cur;
      }, {});
    Object.assign(result, orderedFieldMap, unorderedFieldMap);
  }
  return result;
};
