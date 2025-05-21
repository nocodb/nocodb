import { convertMS2Duration, UITypes } from 'nocodb-sdk';
import type LinkToAnotherRecordColumn from '~/models/LinkToAnotherRecordColumn';
import type LookupColumn from '~/models/LookupColumn';
import type { NcContext } from '~/interface/config';
import type Column from '~/models/Column';
import { NcError } from '~/helpers/catchError';
import { Model, View } from '~/models';
import Base from '~/models/Base';

export interface PathParams {
  baseName: string;
  tableName: string;
  viewName?: string;
}

export interface OldPathParams {
  baseId: string;
  tableName: string;
  viewName?: string;
}

export async function getViewAndModelByAliasOrId(
  context: NcContext,
  param: {
    baseName: string;
    tableName: string;
    viewName?: string;
  },
) {
  const base = await Base.getWithInfoByTitleOrId(context, param.baseName);

  const model = await Model.getByAliasOrId(context, {
    base_id: base.id,
    aliasOrId: param.tableName,
  });

  if (!model) NcError.tableNotFound(param.tableName);

  const view =
    param.viewName &&
    (await View.getByTitleOrId(context, {
      titleOrId: param.viewName,
      fk_model_id: model.id,
    }));
  if (param.viewName && !view) NcError.viewNotFound(param.viewName);

  return { model, view };
}

export async function serializeCellValue(
  context: NcContext,
  {
    value,
    column,
    siteUrl,
  }: {
    column?: Column;
    value: any;
    siteUrl: string;
  },
) {
  if (!column) {
    return value;
  }

  if (!value) return value;

  switch (column?.uidt) {
    case UITypes.Attachment: {
      let data = value;
      try {
        if (typeof value === 'string') {
          data = JSON.parse(value);
        }

        if (!Array.isArray(data)) {
          data = [data];
        }
      } catch {
        data = undefined;
      }

      return (data || [])
        .filter((attachment) => attachment)
        .map(
          (attachment) =>
            `${attachment.title || 'Attachment'}(${encodeURI(
              attachment.signedPath
                ? `${siteUrl}/${attachment.signedPath}`
                : attachment.signedUrl,
            )})`,
        )
        .join(', ');
    }
    case UITypes.User:
    case UITypes.CreatedBy:
    case UITypes.LastModifiedBy: {
      let data = value;
      try {
        if (typeof value === 'string') {
          data = JSON.parse(value);
        }
      } catch {}

      return (data ? (Array.isArray(data) ? data : [data]) : [])
        .map((user) => `${user.email}`)
        .join(', ');
    }
    case UITypes.Lookup:
      {
        const colOptions = await column.getColOptions<LookupColumn>(context);
        const lookupColumn = await colOptions.getLookupColumn(context);
        return (
          await Promise.all(
            [...(Array.isArray(value) ? value : [value])].map(async (v) =>
              serializeCellValue(context, {
                value: v,
                column: lookupColumn,
                siteUrl,
              }),
            ),
          )
        ).join(', ');
      }
      break;
    case UITypes.LinkToAnotherRecord:
      {
        const colOptions =
          await column.getColOptions<LinkToAnotherRecordColumn>(context);
        const relatedModel = await colOptions.getRelatedTable(context);
        await relatedModel.getColumns(context);
        return [...(Array.isArray(value) ? value : [value])]
          .map((v) => {
            return v[relatedModel.displayValue?.title];
          })
          .join(', ');
      }
      break;
    case UITypes.Decimal:
      {
        if (isNaN(Number(value))) return null;

        return Number(value).toFixed(column.meta?.precision ?? 1);
      }
      break;
    case UITypes.Duration: {
      if (column.meta?.duration === undefined) {
        return value;
      }
      return convertMS2Duration(value, column.meta.duration);
    }
    default:
      if (value && typeof value === 'object') {
        return JSON.stringify(value);
      }
      return value;
  }
}

export async function getColumnByIdOrName(
  context: NcContext,
  columnNameOrId: string,
  model: Model,
) {
  const column = (await model.getColumns(context)).find(
    (c) =>
      c.title === columnNameOrId ||
      c.id === columnNameOrId ||
      c.column_name === columnNameOrId,
  );

  if (!column) NcError.fieldNotFound(columnNameOrId);

  return column;
}
